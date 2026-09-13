"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { atualizarScopes, revogarAcesso, type EstadoScopes } from "@/app/actions/ligacoes";
import { PermissoesClaro } from "./permissoes-claro";

export function OMeuPt({
  linkId,
  ptNome,
  ptCode,
  evolucao,
  videos,
  metricas,
  mensagensPorLer,
  feedbackRecente,
}: {
  linkId: string;
  ptNome: string;
  ptCode: string | null;
  evolucao: boolean;
  videos: boolean;
  metricas: boolean;
  mensagensPorLer: number;
  feedbackRecente: number;
}) {
  const [estado, acao, pendente] = useActionState(atualizarScopes, {} as EstadoScopes);
  const [permissoesAbertas, setPermissoesAbertas] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: "var(--apex-tinta)" }}>
          {ptNome}
        </span>
        {ptCode ? (
          <span className="apex-tipo-etiqueta apex-tabular" style={{ color: "var(--apex-cinza-texto)" }}>
            {ptCode}
          </span>
        ) : null}
      </div>

      <Link href="/chat" className="apex-linha-exercicio" style={{ textDecoration: "none" }}>
        <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>Mensagens</span>
        <span className="apex-tabular" style={{ color: mensagensPorLer > 0 ? "var(--apex-tinta)" : "var(--apex-cinza-texto)" }}>
          {mensagensPorLer > 0 ? `${mensagensPorLer} por ler` : "Tudo lido"}
        </span>
      </Link>

      <Link href="/videos" className="apex-linha-exercicio" style={{ textDecoration: "none" }}>
        <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>Vídeos</span>
        <span className="apex-tabular" style={{ color: feedbackRecente > 0 ? "var(--apex-tinta)" : "var(--apex-cinza-texto)" }}>
          {feedbackRecente > 0 ? `${feedbackRecente} com feedback recente` : "Sem feedback recente"}
        </span>
      </Link>

      <button
        type="button"
        onClick={() => setPermissoesAbertas((v) => !v)}
        className="apex-tipo-secundario self-start"
        style={{ color: "var(--apex-cinza-texto)" }}
      >
        {permissoesAbertas ? "Esconder permissões" : "Gerir permissões"}
      </button>

      {permissoesAbertas ? (
        <div className="flex flex-col gap-4">
          <form action={acao} className="flex flex-col gap-4">
            <input type="hidden" name="link_id" value={linkId} />
            <PermissoesClaro evolucao={evolucao} videos={videos} metricas={metricas} />

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pendente}
                className="apex-botao apex-botao--claro"
                style={{ width: "auto", padding: "10px 20px" }}
              >
                {pendente ? "A guardar…" : "Guardar permissões"}
              </button>
              {estado.ok ? <span className="apex-tipo-secundario" style={{ color: "var(--apex-tinta)" }}>Guardado</span> : null}
              {estado.erro ? <span className="apex-tipo-secundario" style={{ color: "var(--apex-erro)" }}>{estado.erro}</span> : null}
            </div>
          </form>

          <form action={revogarAcesso} className="border-t pt-4" style={{ borderColor: "var(--apex-cinza-linha)" }}>
            <input type="hidden" name="link_id" value={linkId} />
            <button
              type="submit"
              onClick={(e) => {
                if (!window.confirm("Revogar o acesso deste PT? Ele deixa de ver os teus dados. O histórico não é apagado.")) {
                  e.preventDefault();
                }
              }}
              className="apex-tipo-secundario"
              style={{ color: "var(--apex-erro)" }}
            >
              Revogar acesso
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
