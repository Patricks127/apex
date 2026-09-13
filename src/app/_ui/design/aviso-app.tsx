// Aviso da app — reservado a decisões que a app tomou por ti (carga que
// mudou, exercício substituído, semana de descarga). Sempre com explicação,
// nunca só um ícone.

import type { ReactNode } from "react";

export function AvisoApp({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="apex-aviso" role="status">
      <span className="apex-tipo-etiqueta apex-aviso__titulo">{titulo}</span>
      {/* div, não <p>: alguns usos (ex.: /plano) passam uma lista de razões,
          e um <ul> dentro de <p> é HTML inválido — fecha o <p> mais cedo. */}
      <div className="apex-tipo-corpo apex-aviso__texto">{children}</div>
    </div>
  );
}
