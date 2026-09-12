// Aviso da app — reservado a decisões que a app tomou por ti (carga que
// mudou, exercício substituído, semana de descarga). Sempre com explicação,
// nunca só um ícone. Fase 1: só o componente, não ligado a nenhum ecrã ainda.

import type { ReactNode } from "react";

export function AvisoApp({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="apex-aviso" role="status">
      <span className="apex-tipo-etiqueta apex-aviso__titulo">{titulo}</span>
      <p className="apex-tipo-corpo apex-aviso__texto">{children}</p>
    </div>
  );
}
