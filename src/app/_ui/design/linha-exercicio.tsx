// Linha de exercício (ecrã do dia, modo claro). Nome + etiqueta por baixo,
// valor à direita alinhado por tabular, separador de 1px em baixo.
// Fase 1: só o componente, não ligado a nenhum ecrã ainda.

import type { ReactNode } from "react";

export function LinhaExercicio({
  nome,
  etiqueta,
  valor,
}: {
  nome: string;
  etiqueta?: string;
  valor?: ReactNode;
}) {
  return (
    <div className="apex-linha-exercicio">
      <div className="apex-linha-exercicio__principal">
        <span className="apex-tipo-nome-exercicio apex-linha-exercicio__nome">{nome}</span>
        {etiqueta ? (
          <span className="apex-tipo-etiqueta apex-linha-exercicio__etiqueta">{etiqueta}</span>
        ) : null}
      </div>
      {valor !== undefined ? (
        <span className="apex-tipo-nome-exercicio apex-tabular apex-linha-exercicio__valor">
          {valor}
        </span>
      ) : null}
    </div>
  );
}
