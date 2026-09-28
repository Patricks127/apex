"use client";

import { useActionState } from "react";
import { atualizarScopes, revogarAcesso, type EstadoScopes } from "@/app/actions/ligacoes";
import { PermissoesClaro } from "@/app/painel/permissoes-claro";

/**
 * O que o PT pode ver (scopes da ligação) e revogar a ligação. Vivia num
 * "Gerir permissões" dentro do cartão do PT no painel; agora é Perfil →
 * Definições (Fase 3, pontos 19/21). As MESMAS ações de sempre
 * (atualizarScopes/revogarAcesso — validam no servidor que a ligação é do
 * próprio aluno) e a mesma RLS; só mudou de sítio.
 */
export function PermissoesPt({
  linkId,
  evolucao,
  videos,
  metricas,
}: {
  linkId: string;
  evolucao: boolean;
  videos: boolean;
  metricas: boolean;
}) {
  const [estado, acao, pendente] = useActionState(atualizarScopes, {} as EstadoScopes);

  return (
    <div className="flex flex-col gap-4">
      <form action={acao} className="flex flex-col gap-4">
        <input type="hidden" name="link_id" value={linkId} />
        <PermissoesClaro evolucao={evolucao} videos={videos} metricas={metricas} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pendente} className="apex-botao apex-botao--claro" style={{ width: "auto" }}>
            {pendente ? "A guardar…" : "Guardar permissões"}
          </button>
          {estado.ok ? (
            <span className="apex-tipo-secundario" style={{ color: "var(--apex-tinta)" }} role="status">
              Guardado
            </span>
          ) : null}
          {estado.erro ? (
            <span className="apex-tipo-secundario" style={{ color: "var(--apex-erro)" }} role="alert">
              {estado.erro}
            </span>
          ) : null}
        </div>
      </form>

      <form action={revogarAcesso} className="border-t pt-2" style={{ borderColor: "var(--apex-cinza-linha)" }}>
        <input type="hidden" name="link_id" value={linkId} />
        <button
          type="submit"
          onClick={(e) => {
            if (!window.confirm("Revogar o acesso deste PT? Ele deixa de ver os teus dados. O histórico não é apagado.")) {
              e.preventDefault();
            }
          }}
          className="apex-tipo-secundario apex-link-toque"
          style={{ color: "var(--apex-erro)" }}
        >
          Revogar acesso do PT
        </button>
      </form>
    </div>
  );
}
