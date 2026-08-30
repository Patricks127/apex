"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registar, type EstadoRegisto } from "@/app/actions/auth";
import { AvisoErro, BotaoSubmeter, Campo } from "@/app/_ui/campos";

const ESTADO_INICIAL: EstadoRegisto = {};

export function FormularioRegisto() {
  const [estado, acao, pendente] = useActionState(registar, ESTADO_INICIAL);

  if (estado.confirmarEmail) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-zinc-100">Confirma o teu email</h1>
        <p className="text-sm text-zinc-400">
          Enviámos uma mensagem para{" "}
          <span className="text-zinc-200">{estado.valores?.email}</span>. Abre a
          ligação que recebeste para ativar a conta e depois inicia sessão.
        </p>
        <Link
          href="/entrar"
          className="mt-2 text-sm font-medium text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
        >
          Ir para o início de sessão
        </Link>
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-100">Criar conta</h1>
        <p className="text-sm text-zinc-400">Junta-te à APEX.</p>
      </div>

      {estado.mensagem ? <AvisoErro>{estado.mensagem}</AvisoErro> : null}

      <Campo
        etiqueta="Nome"
        name="nome"
        type="text"
        autoComplete="name"
        required
        defaultValue={estado.valores?.nome}
        erro={estado.erros?.nome}
      />

      <Campo
        etiqueta="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={estado.valores?.email}
        erro={estado.erros?.email}
      />

      <Campo
        etiqueta="Telemóvel (opcional)"
        name="telemovel"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        defaultValue={estado.valores?.telemovel}
        erro={estado.erros?.telemovel}
      />

      <Campo
        etiqueta="Palavra-passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Pelo menos 8 caracteres."
        erro={estado.erros?.password}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-300">Sou…</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <OpcaoPapel
            value="atleta"
            titulo="Atleta"
            descricao="Quero treinar"
            checkedPorDefeito={estado.valores?.papel !== "pt"}
          />
          <OpcaoPapel
            value="pt"
            titulo="Personal Trainer"
            descricao="Acompanho atletas"
            checkedPorDefeito={estado.valores?.papel === "pt"}
          />
        </div>
        {estado.erros?.papel ? (
          <span className="text-xs text-red-400" role="alert">
            {estado.erros.papel}
          </span>
        ) : null}
      </fieldset>

      <BotaoSubmeter pendente={pendente}>Criar conta</BotaoSubmeter>

      <p className="text-sm text-zinc-500">
        Já tens conta?{" "}
        <Link
          href="/entrar"
          className="font-medium text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
        >
          Iniciar sessão
        </Link>
      </p>
    </form>
  );
}

function OpcaoPapel({
  value,
  titulo,
  descricao,
  checkedPorDefeito,
}: {
  value: string;
  titulo: string;
  descricao: string;
  checkedPorDefeito: boolean;
}) {
  return (
    <label className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 p-3 transition has-[:checked]:border-zinc-300 has-[:checked]:bg-zinc-800">
      <input
        type="radio"
        name="papel"
        value={value}
        defaultChecked={checkedPorDefeito}
        className="sr-only"
      />
      <span className="block text-sm font-semibold text-zinc-100">{titulo}</span>
      <span className="block text-xs text-zinc-500">{descricao}</span>
    </label>
  );
}
