// Cabeçalho de ecrã — barra com a marca à esquerda, contexto à direita
// (ex.: "S3 / SEG"), borda inferior 3px. Fase 1: só o componente, não ligado
// a nenhum ecrã ainda.

import type { ReactNode } from "react";

export function CabecalhoEcra({
  marca = "APEX",
  direita,
}: {
  marca?: string;
  direita?: ReactNode;
}) {
  return (
    <div className="apex-cabecalho">
      <span className="apex-tipo-etiqueta apex-cabecalho__marca">{marca}</span>
      {direita !== undefined ? (
        <span className="apex-tipo-secundario apex-tabular apex-cabecalho__direita">{direita}</span>
      ) : null}
    </div>
  );
}
