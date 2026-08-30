// Elementos de formulário partilhados pelos ecrãs de autenticação.
// Tema escuro, simples e limpo.

import type { ComponentProps, ReactNode } from "react";

export function Campo({
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
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-300">{etiqueta}</span>
      <input
        {...props}
        aria-invalid={erro ? true : undefined}
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400 aria-[invalid]:border-red-500"
      />
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
      {erro ? (
        <span className="text-xs text-red-400" role="alert">
          {erro}
        </span>
      ) : null}
    </label>
  );
}

export function BotaoSubmeter({
  pendente,
  children,
}: {
  pendente: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pendente}
      className="mt-2 rounded-lg bg-zinc-100 px-4 py-2.5 font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pendente ? "Aguarda…" : children}
    </button>
  );
}

export function AvisoErro({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
    >
      {children}
    </p>
  );
}
