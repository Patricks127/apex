"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VERSAO_TERMOS_PRIVACIDADE, VERSAO_AVISO_SAUDE } from "@/lib/legal";

// Papéis aceites — têm de coincidir com o enum user_role da base de dados.
const PAPEIS = ["atleta", "pt"] as const;
type Papel = (typeof PAPEIS)[number];

// ---------------------------------------------------------------------------
// Registo
// ---------------------------------------------------------------------------

export type EstadoRegisto = {
  erros?: {
    nome?: string;
    email?: string;
    telemovel?: string;
    password?: string;
    papel?: string;
    termos?: string;
    saude?: string;
  };
  mensagem?: string;
  // Registo concluído mas falta confirmar o email (sem sessão iniciada).
  confirmarEmail?: boolean;
  // Repovoar o formulário após erro (a password nunca é devolvida).
  valores?: {
    nome?: string;
    email?: string;
    telemovel?: string;
    papel?: string;
  };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEMOVEL_RE = /^\+?[0-9]{9,15}$/;

export async function registar(
  _estadoAnterior: EstadoRegisto,
  formData: FormData,
): Promise<EstadoRegisto> {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telemovelBruto = String(formData.get("telemovel") ?? "").trim();
  const telemovel = telemovelBruto.replace(/[\s-]/g, "");
  const password = String(formData.get("password") ?? "");
  const papel = String(formData.get("papel") ?? "");
  const aceitaTermos = formData.get("aceita_termos") === "on";
  const aceitaSaude = formData.get("aceita_saude") === "on";

  const valores = { nome, email, telemovel: telemovelBruto, papel };
  const erros: NonNullable<EstadoRegisto["erros"]> = {};

  if (nome.length < 2 || nome.length > 80) {
    erros.nome = "Indica o teu nome (entre 2 e 80 caracteres).";
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    erros.email = "Indica um email válido.";
  }
  if (telemovel && !TELEMOVEL_RE.test(telemovel)) {
    erros.telemovel = "Indica um número de telemóvel válido.";
  }
  if (password.length < 8 || password.length > 72) {
    erros.password = "A palavra-passe tem de ter entre 8 e 72 caracteres.";
  }
  if (!PAPEIS.includes(papel as Papel)) {
    erros.papel = "Escolhe se és atleta ou personal trainer.";
  }
  // Duas aceitações SEPARADAS, de propósito: os Termos+Privacidade não
  // substituem o aviso de saúde ter a sua própria aceitação explícita.
  if (!aceitaTermos) {
    erros.termos = "Tens de ler e aceitar os Termos e a Política de Privacidade.";
  }
  if (!aceitaSaude) {
    erros.saude = "Tens de confirmar que compreendes o aviso de saúde.";
  }

  if (Object.keys(erros).length > 0) {
    return { erros, valores };
  }

  const supabase = await createClient();

  const origem = await urlBase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Lido pelos triggers de auth.users: handle_new_user (perfil) e
      // handle_new_user_legal_acceptance (migração 015 — regista data/hora/
      // versão das duas aceitações, já validadas como obrigatórias acima).
      data: {
        name: nome,
        role: papel,
        phone: telemovel || null,
        terms_accepted: "true",
        terms_version: VERSAO_TERMOS_PRIVACIDADE,
        health_accepted: "true",
        health_version: VERSAO_AVISO_SAUDE,
      },
      emailRedirectTo: `${origem}/painel`,
    },
  });

  if (error) {
    // Mensagem genérica — não revelar se o email já existe.
    return {
      mensagem: "Não foi possível concluir o registo. Tenta novamente.",
      valores,
    };
  }

  // Com confirmação de email ativa, o Supabase devolve um utilizador sem
  // sessão e com `identities` vazio quando o email já estava registado.
  // Tratamos todos esses casos da mesma forma para não expor essa informação.
  if (data.session) {
    redirect("/painel");
  }

  return { confirmarEmail: true, valores: { ...valores, papel } };
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export type EstadoEntrada = {
  erros?: {
    email?: string;
    password?: string;
  };
  mensagem?: string;
  valores?: {
    email?: string;
  };
};

export async function entrar(
  _estadoAnterior: EstadoEntrada,
  formData: FormData,
): Promise<EstadoEntrada> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const erros: NonNullable<EstadoEntrada["erros"]> = {};
  if (!email) erros.email = "Indica o teu email.";
  if (!password) erros.password = "Indica a tua palavra-passe.";
  if (Object.keys(erros).length > 0) {
    return { erros, valores: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensagem genérica e igual para todos os casos (credenciais erradas,
    // email não confirmado, conta inexistente) — não revelar se o email existe.
    return {
      mensagem:
        "Email ou palavra-passe incorretos. Se te registaste há pouco, confirma primeiro o teu email.",
      valores: { email },
    };
  }

  redirect("/painel");
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

export async function sair(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

// ---------------------------------------------------------------------------

async function urlBase(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
