"use client";

import Link from "next/link";
import { useActionState } from "react";
import { entrar, type EstadoEntrada } from "@/app/actions/auth";
import { AvisoErroClaro, BotaoSubmeterClaro, CampoClaro, TituloAuth } from "@/app/_ui/auth-claro";

const ESTADO_INICIAL: EstadoEntrada = {};

export function FormularioEntrada() {
  const [estado, acao, pendente] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      <TituloAuth titulo="Iniciar sessão" subtitulo="Bem-vindo de volta à APEX." />

      {estado.mensagem ? <AvisoErroClaro>{estado.mensagem}</AvisoErroClaro> : null}

      <CampoClaro
        etiqueta="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={estado.valores?.email}
        erro={estado.erros?.email}
      />

      <CampoClaro
        etiqueta="Palavra-passe"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        erro={estado.erros?.password}
      />

      <BotaoSubmeterClaro pendente={pendente}>Entrar</BotaoSubmeterClaro>

      <p className="apex-tipo-secundario" style={{ color: "var(--apex-cinza-texto)" }}>
        Ainda não tens conta?{" "}
        <Link
          href="/registar"
          className="apex-link-toque underline underline-offset-4"
          style={{ color: "var(--apex-tinta)", fontWeight: 700 }}
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}
