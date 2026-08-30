"use client";

import Link from "next/link";
import { useActionState } from "react";
import { entrar, type EstadoEntrada } from "@/app/actions/auth";
import { AvisoErro, BotaoSubmeter, Campo } from "@/app/_ui/campos";

const ESTADO_INICIAL: EstadoEntrada = {};

export function FormularioEntrada() {
  const [estado, acao, pendente] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-100">Iniciar sessão</h1>
        <p className="text-sm text-zinc-400">Bem-vindo de volta à APEX.</p>
      </div>

      {estado.mensagem ? <AvisoErro>{estado.mensagem}</AvisoErro> : null}

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
        etiqueta="Palavra-passe"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        erro={estado.erros?.password}
      />

      <BotaoSubmeter pendente={pendente}>Entrar</BotaoSubmeter>

      <p className="text-sm text-zinc-500">
        Ainda não tens conta?{" "}
        <Link
          href="/registar"
          className="font-medium text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}
