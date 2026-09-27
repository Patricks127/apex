import { imcAtual } from "@/lib/treino/imc";
import type { MetricaCorporal } from "@/lib/treino/progresso-dados";
import { formatarKg, formatarNumero } from "@/lib/formato";
import { formatarData } from "@/lib/fuso";

const COR = { tinta: "var(--apex-tinta)", fraco: "var(--apex-cinza-texto)" } as const;

/** IMC calculado (peso / altura²) do registo mais recente de cada um —
 *  nunca registado à mão (src/lib/treino/imc.ts). Sem peso ou sem altura,
 *  o atleta vê o que falta; o PT (perspetiva "pt") não vê nada — não é ele
 *  quem regista. Mesmo dado que já passa pela RLS de body_metrics (PT só
 *  com scope "metricas"): nada de novo exposto. */
export function BlocoImc({
  metricas,
  perspetiva = "atleta",
}: {
  metricas: MetricaCorporal[];
  perspetiva?: "atleta" | "pt";
}) {
  const r = imcAtual(metricas);
  const temPeso = metricas.some((m) => m.metric === "weight_kg");
  const temAltura = metricas.some((m) => m.metric === "height_cm");

  if (!r) {
    if (perspetiva === "pt") return null;
    return (
      <p className="apex-tipo-secundario mt-3" style={{ color: COR.fraco }}>
        IMC: {temPeso ? "regista a tua altura" : temAltura ? "regista o teu peso" : "regista o peso e a altura"} para o
        calcular.
      </p>
    );
  }
  return (
    <div className="apex-cartao apex-cartao--compacto mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
          IMC
        </span>
        <span className="apex-tipo-numero-dados apex-tabular" style={{ color: COR.tinta }}>
          {formatarNumero(r.imc, 1)}
        </span>
      </div>
      <span className="apex-tipo-etiqueta" style={{ color: COR.fraco, fontWeight: 500 }}>
        Calculado do peso ({formatarKg(r.pesoKg)}, {formatarData(r.pesoEm, { day: "numeric", month: "short" })}) e da
        altura ({formatarNumero(r.alturaCm)} cm). Não distingue músculo de gordura.
      </span>
    </div>
  );
}
