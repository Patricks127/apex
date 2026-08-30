"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Tipos partilhados
// ---------------------------------------------------------------------------

export type EstadoLigar = {
  erro?: string;
};

export type EstadoScopes = {
  ok?: boolean;
  erro?: string;
};

export type ResultadoProcura = {
  resultados: Array<{ id: string; name: string; pt_code: string | null; city: string | null }>;
  erro?: string;
};

const BLOQUEIO_RLS =
  "Não foi possível concluir. As políticas de segurança da base de dados podem estar a bloquear esta operação.";

// ---------------------------------------------------------------------------
// Helper: perfil do utilizador autenticado (role vem SEMPRE da BD, nunca do cliente)
// ---------------------------------------------------------------------------

async function contexto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, perfil: null } as const;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, name, role, pt_code")
    .eq("id", user.id)
    .single();

  return { supabase, user, perfil } as const;
}

// ---------------------------------------------------------------------------
// 1. Código de PT
// ---------------------------------------------------------------------------

function gerarCodigo(nome: string): string {
  const letras = (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remover marcas de acento
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  const base = letras.length >= 2 ? letras : "PT";
  const digitos = String(Math.floor(1000 + Math.random() * 9000));
  return `${base}-${digitos}`;
}

export async function garantirCodigoPt(): Promise<{ codigo: string } | { erro: string }> {
  const { supabase, perfil } = await contexto();
  if (!perfil) return { erro: "Sessão inválida." };
  if (perfil.role !== "pt") return { erro: "Apenas os personal trainers têm código." };
  if (perfil.pt_code) return { codigo: perfil.pt_code };

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const codigo = gerarCodigo(perfil.name ?? "");
    const { data, error } = await supabase
      .from("profiles")
      .update({ pt_code: codigo })
      .eq("id", perfil.id)
      .is("pt_code", null)
      .select("pt_code");

    if (!error && data && data.length === 1) {
      revalidatePath("/painel");
      return { codigo: data[0].pt_code as string };
    }

    if (!error && (!data || data.length === 0)) {
      // Já foi definido noutro pedido concorrente — devolver o que está lá.
      const { data: atual } = await supabase
        .from("profiles")
        .select("pt_code")
        .eq("id", perfil.id)
        .single();
      if (atual?.pt_code) return { codigo: atual.pt_code as string };
    }

    if (error && error.code !== "23505") {
      return { erro: BLOQUEIO_RLS };
    }
    // 23505 => colisão de código; nova tentativa
  }

  return { erro: "Não foi possível gerar um código único. Tenta novamente." };
}

// ---------------------------------------------------------------------------
// 2. Procurar PTs por nome
// ---------------------------------------------------------------------------

export async function procurarPts(
  _anterior: ResultadoProcura,
  formData: FormData,
): Promise<ResultadoProcura> {
  const q = String(formData.get("q") ?? "").trim();
  const { supabase, perfil } = await contexto();

  if (!perfil) return { resultados: [], erro: "Sessão inválida." };
  if (perfil.role !== "atleta") return { resultados: [], erro: "Apenas atletas podem procurar PT." };
  if (q.length < 2) return { resultados: [], erro: "Escreve pelo menos 2 letras." };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, pt_code, city")
    .eq("role", "pt")
    .not("pt_code", "is", null)
    .ilike("name", `%${q}%`)
    .limit(10);

  if (error) return { resultados: [], erro: BLOQUEIO_RLS };
  return { resultados: (data ?? []) as ResultadoProcura["resultados"] };
}

// ---------------------------------------------------------------------------
// 3. Resolver um código (aceita "apex.fit/pt/RUI-8842", URL completo ou só o código)
// ---------------------------------------------------------------------------

function normalizarCodigo(entrada: string): string {
  let s = entrada.trim();
  const barra = s.lastIndexOf("/");
  if (barra >= 0) s = s.slice(barra + 1);
  s = s.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (/^[A-Z]{2,4}\d{4}$/.test(s)) s = s.replace(/(\d{4})$/, "-$1");
  return /^[A-Z]{2,4}-\d{4}$/.test(s) ? s : "";
}

export type ResultadoResolver = {
  pt?: { id: string; name: string; pt_code: string | null };
  erro?: string;
};

// Verifica um código (ou link) e devolve o PT, para mostrar o painel de permissões.
export async function resolverPt(
  _anterior: ResultadoResolver,
  formData: FormData,
): Promise<ResultadoResolver> {
  const bruto = String(formData.get("valor") ?? "");
  const { supabase, perfil } = await contexto();
  if (!perfil) return { erro: "Sessão inválida." };
  if (perfil.role !== "atleta") return { erro: "Apenas atletas podem ligar-se a um PT." };

  const codigo = normalizarCodigo(bruto);
  if (!codigo) return { erro: "Código inválido. Exemplo: RUI-8842." };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, pt_code")
    .eq("pt_code", codigo)
    .eq("role", "pt")
    .maybeSingle();

  if (error) return { erro: BLOQUEIO_RLS };
  if (!data) return { erro: "Não encontrámos nenhum PT com esse código." };
  if (data.id === perfil.id) return { erro: "Não te podes ligar a ti próprio." };

  return { pt: data as ResultadoResolver["pt"] };
}

// ---------------------------------------------------------------------------
// 4. Enviar pedido de ligação (atleta -> PT)
// ---------------------------------------------------------------------------

export async function enviarPedidoLigacao(
  _anterior: EstadoLigar,
  formData: FormData,
): Promise<EstadoLigar> {
  const ptCodeRaw = String(formData.get("pt_code") ?? "").trim();
  const ptIdRaw = String(formData.get("pt_id") ?? "").trim();
  const scope_evolucao = formData.get("scope_evolucao") != null;
  const scope_videos = formData.get("scope_videos") != null;
  const scope_metricas = formData.get("scope_metricas") != null;

  const { supabase, user, perfil } = await contexto();
  if (!user || !perfil) return { erro: "Sessão inválida." };
  if (perfil.role !== "atleta") {
    return { erro: "Apenas atletas podem enviar pedidos de ligação." };
  }

  // Resolver o PT alvo
  let ptId = "";
  if (ptIdRaw) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", ptIdRaw)
      .eq("role", "pt")
      .maybeSingle();
    if (!data) return { erro: "Personal trainer não encontrado." };
    ptId = data.id;
  } else {
    const codigo = normalizarCodigo(ptCodeRaw);
    if (!codigo) return { erro: "Código inválido. Exemplo: RUI-8842." };
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("pt_code", codigo)
      .eq("role", "pt")
      .maybeSingle();
    if (!data) return { erro: "Não encontrámos nenhum PT com esse código." };
    ptId = data.id;
  }

  if (ptId === perfil.id) return { erro: "Não te podes ligar a ti próprio." };

  // Um atleta só pode ter 1 PT ativo / 1 pedido pendente de cada vez
  const { data: existentes, error: erroExistentes } = await supabase
    .from("pt_links")
    .select("id, status")
    .eq("student_id", perfil.id)
    .in("status", ["ativo", "pendente"]);
  if (erroExistentes) return { erro: BLOQUEIO_RLS };
  if (existentes && existentes.length > 0) {
    const temAtivo = existentes.some((l) => l.status === "ativo");
    return {
      erro: temAtivo
        ? "Já tens um PT ligado. Revoga esse acesso no painel antes de ligar outro."
        : "Já tens um pedido pendente. Espera pela resposta ou cancela-o no painel.",
    };
  }

  const scopes = {
    scope_treinos: true,
    scope_evolucao,
    scope_videos,
    scope_metricas,
  };

  const { error } = await supabase.from("pt_links").insert({
    pt_id: ptId,
    student_id: perfil.id,
    status: "pendente",
    requested_by: user.id,
    ...scopes,
  });

  if (error) {
    if (error.code === "23505") {
      // Já existe uma linha (pt_id, student_id) revogada/recusada — reabrir como pedido.
      const { error: erroReabrir } = await supabase
        .from("pt_links")
        .update({ status: "pendente", requested_by: user.id, ...scopes })
        .eq("pt_id", ptId)
        .eq("student_id", perfil.id)
        .in("status", ["revogado", "recusado"]);
      if (erroReabrir) return { erro: BLOQUEIO_RLS };
    } else {
      return { erro: BLOQUEIO_RLS };
    }
  }

  revalidatePath("/painel");
  redirect("/painel");
}

// ---------------------------------------------------------------------------
// 5. PT responde a um pedido (aceitar / recusar)
// ---------------------------------------------------------------------------

export async function responderPedido(formData: FormData): Promise<void> {
  const linkId = String(formData.get("link_id") ?? "");
  const accao = String(formData.get("accao") ?? "");
  const { supabase, perfil } = await contexto();
  if (!perfil) redirect("/entrar");
  if (perfil.role !== "pt") return;

  const { data: link } = await supabase
    .from("pt_links")
    .select("id, pt_id, student_id, status")
    .eq("id", linkId)
    .maybeSingle();

  if (!link || link.pt_id !== perfil.id || link.status !== "pendente") {
    revalidatePath("/painel");
    return;
  }

  if (accao === "recusar") {
    await supabase
      .from("pt_links")
      .update({ status: "recusado" })
      .eq("id", linkId)
      .eq("pt_id", perfil.id)
      .eq("status", "pendente");
    revalidatePath("/painel");
    return;
  }

  if (accao === "aceitar") {
    // O aluno não pode ficar com dois PT ativos
    const { data: outrosAtivos } = await supabase
      .from("pt_links")
      .select("id")
      .eq("student_id", link.student_id)
      .eq("status", "ativo");
    if (outrosAtivos && outrosAtivos.length > 0) {
      revalidatePath("/painel");
      return;
    }
    await supabase
      .from("pt_links")
      .update({ status: "ativo" })
      .eq("id", linkId)
      .eq("pt_id", perfil.id)
      .eq("status", "pendente");
    revalidatePath("/painel");
  }
}

// ---------------------------------------------------------------------------
// 6. Atleta altera os scopes (só o student_id pode)
// ---------------------------------------------------------------------------

export async function atualizarScopes(
  _anterior: EstadoScopes,
  formData: FormData,
): Promise<EstadoScopes> {
  const linkId = String(formData.get("link_id") ?? "");
  const scope_evolucao = formData.get("scope_evolucao") != null;
  const scope_videos = formData.get("scope_videos") != null;
  const scope_metricas = formData.get("scope_metricas") != null;

  const { supabase, perfil } = await contexto();
  if (!perfil) return { erro: "Sessão inválida." };

  const { data: link } = await supabase
    .from("pt_links")
    .select("id, student_id, status")
    .eq("id", linkId)
    .maybeSingle();

  if (!link || link.student_id !== perfil.id) return { erro: "Sem permissão." };
  if (!["ativo", "pendente"].includes(link.status)) {
    return { erro: "Esta ligação já não está ativa." };
  }

  const { error } = await supabase
    .from("pt_links")
    .update({
      scope_treinos: true, // treinos é sempre obrigatório
      scope_evolucao,
      scope_videos,
      scope_metricas,
    })
    .eq("id", linkId)
    .eq("student_id", perfil.id);

  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/painel");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 7. Atleta revoga o acesso (ou cancela o pedido pendente) — sem apagar dados
// ---------------------------------------------------------------------------

export async function revogarAcesso(formData: FormData): Promise<void> {
  const linkId = String(formData.get("link_id") ?? "");
  const { supabase, perfil } = await contexto();
  if (!perfil) redirect("/entrar");

  const { data: link } = await supabase
    .from("pt_links")
    .select("id, student_id, status")
    .eq("id", linkId)
    .maybeSingle();

  if (!link || link.student_id !== perfil.id) {
    revalidatePath("/painel");
    return;
  }
  if (!["ativo", "pendente"].includes(link.status)) {
    revalidatePath("/painel");
    return;
  }

  await supabase
    .from("pt_links")
    .update({ status: "revogado" })
    .eq("id", linkId)
    .eq("student_id", perfil.id);

  revalidatePath("/painel");
}
