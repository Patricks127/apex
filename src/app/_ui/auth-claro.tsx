// Moldura e campos dos ecrãs de entrada (/entrar, /registar) em MODO CLARO —
// o sistema de design da app (referencia/SISTEMA-DESIGN.md): preto sobre
// branco, cantos 2px, Archivo. Substituem, nestes dois ecrãs, a moldura e os
// campos escuros de `cartao-auth.tsx`/`campos.tsx` — que continuam a servir
// /onboarding e /ligar até esses passarem também a claro (a troca direta
// deixava-os com texto branco sobre fundo branco).

import type { ComponentProps, ReactNode } from "react";

/**
 * Página de entrada: a barra da marca (APEX + traço de 3px, a mesma do
 * cabeçalho de ecrã do resto da app) e o conteúdo alinhado ao topo — no
 * telemóvel, centrar na vertical fazia o formulário saltar quando o teclado
 * abria. Safe area de cima: vem de .apex-ecra-claro; a de baixo, do rodapé.
 */
export function PaginaAuth({ children }: { children: ReactNode }) {
  return (
    <main className="apex-ecra-claro mx-auto flex w-full max-w-sm flex-col gap-8 px-5 pt-4 pb-8">
      <div className="apex-cabecalho">
        <span className="apex-tipo-nome-exercicio apex-cabecalho__marca" style={{ letterSpacing: "0.08em" }}>
          APEX
        </span>
      </div>
      {children}
    </main>
  );
}

export function TituloAuth({ titulo, subtitulo }: { titulo: string; subtitulo?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="apex-tipo-titulo-ecra" style={{ color: "var(--apex-tinta)" }}>
        {titulo}
      </h1>
      {subtitulo ? (
        <p className="apex-tipo-corpo" style={{ color: "var(--apex-cinza-texto)" }}>
          {subtitulo}
        </p>
      ) : null}
    </div>
  );
}

export function CampoClaro({
  etiqueta,
  erro,
  hint,
  ...props
}: ComponentProps<"input"> & {
  etiqueta: string;
  erro?: string;
  hint?: ReactNode;
}) {
  return (
    <label className="apex-campo">
      <span className="apex-campo__etiqueta apex-tipo-secundario">{etiqueta}</span>
      <input {...props} aria-invalid={erro ? true : undefined} className="apex-campo__entrada" />
      {hint ? <span className="apex-tipo-etiqueta apex-campo__hint">{hint}</span> : null}
      {erro ? (
        <span className="apex-tipo-etiqueta apex-campo__erro" role="alert">
          {erro}
        </span>
      ) : null}
    </label>
  );
}

export function BotaoSubmeterClaro({ pendente, children }: { pendente: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pendente} className="apex-botao apex-botao--claro">
      {pendente ? "Aguarda…" : children}
    </button>
  );
}

export function AvisoErroClaro({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="apex-aviso-erro apex-tipo-secundario">
      {children}
    </p>
  );
}
