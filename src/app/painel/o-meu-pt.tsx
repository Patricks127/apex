"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  atualizarScopes,
  revogarAcesso,
  type EstadoScopes,
} from "@/app/actions/ligacoes";
import { PainelPermissoes } from "@/app/_ui/permissoes";

export function OMeuPt({
  linkId,
  ptNome,
  ptCode,
  evolucao,
  videos,
  metricas,
}: {
  linkId: string;
  ptNome: string;
  ptCode: string | null;
  evolucao: boolean;
  videos: boolean;
  metricas: boolean;
}) {
  const [estado, acao, pendente] = useActionState(
    atualizarScopes,
    {} as EstadoScopes,
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-400">O teu PT</h2>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
          Ligado
        </span>
      </div>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{ptNome}</p>
      {ptCode ? (
        <p className="font-mono text-xs text-zinc-500">{ptCode}</p>
      ) : null}

      <Link
        href="/chat"
        className="mt-3 inline-block rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
      >
        Abrir conversa
      </Link>

      <form action={acao} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="link_id" value={linkId} />
        <PainelPermissoes
          evolucao={evolucao}
          videos={videos}
          metricas={metricas}
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pendente}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-60"
          >
            {pendente ? "A guardar…" : "Guardar permissões"}
          </button>
          {estado.ok ? (
            <span className="text-sm text-emerald-400">Guardado</span>
          ) : null}
          {estado.erro ? (
            <span className="text-sm text-red-400">{estado.erro}</span>
          ) : null}
        </div>
      </form>

      <form
        action={revogarAcesso}
        className="mt-4 border-t border-zinc-800 pt-4"
      >
        <input type="hidden" name="link_id" value={linkId} />
        <button
          type="submit"
          onClick={(e) => {
            if (
              !window.confirm(
                "Revogar o acesso deste PT? Ele deixa de ver os teus dados. O histórico não é apagado.",
              )
            ) {
              e.preventDefault();
            }
          }}
          className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
        >
          Revogar acesso
        </button>
      </form>
    </section>
  );
}
