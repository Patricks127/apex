import { calcularDiscosPorLado, type Disco } from "@/lib/treino/discos";
import { formatarNumero } from "@/lib/formato";

// Diâmetro por denominação — maior peso, maior disco (como os físicos).
const TAMANHO_PX: Record<number, number> = { 20: 68, 15: 60, 10: 52, 5: 44, 2.5: 34, 1.25: 26 };
const BRANCO = "#F2F2F0";

// "1,25" — fonte única em src/lib/formato.ts
const formatarKg = (kg: number) => formatarNumero(kg);

/** Discos a pôr de um lado da barra — só aparece quando o exercício usa
 *  barra (ver usaBarraPorExercicio, resolvido no servidor). */
export function CalculadoraDiscos({ pesoTotal }: { pesoTotal: number | null }) {
  const discos = calcularDiscosPorLado(pesoTotal);
  if (discos.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-texto-fraco)" }}>
        Discos por lado (barra 20 kg)
      </span>
      <div className="apex-discos">
        {discos.map((d: Disco, i) => {
          const tam = TAMANHO_PX[d.kg] ?? 30;
          return (
            <div
              key={i}
              className="apex-disco"
              style={{
                width: tam,
                height: tam,
                background: d.cor,
                color: d.cor === BRANCO ? "var(--apex-fundo-treino)" : "var(--apex-texto-treino)",
              }}
            >
              {formatarKg(d.kg)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
