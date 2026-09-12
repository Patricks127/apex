// Botão do sistema de design (fase 1: fundação — ver referencia/SISTEMA-DESIGN.md).
// Duas variantes deliberadas: "claro" (navegar/decidir) e "treino" (ao vivo,
// alvo de toque ≥64px para mãos molhadas). Nenhum ecrã existente usa isto
// ainda — só /estilo.

import type { ComponentProps } from "react";

export function Botao({
  variante = "claro",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: "claro" | "treino" }) {
  const classeVariante = variante === "treino" ? "apex-botao--treino" : "apex-botao--claro";
  return (
    <button
      {...props}
      className={["apex-botao", classeVariante, className].filter(Boolean).join(" ")}
    />
  );
}
