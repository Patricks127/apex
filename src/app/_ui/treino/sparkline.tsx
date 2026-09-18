import { escalarPontos, pathLinha } from "@/lib/treino/grafico";
import type { PontoTendencia, Direcao } from "@/lib/treino/tendencia-volume";

const COR_DIRECAO: Record<Exclude<Direcao, "sem_dados">, string> = {
  subida: "var(--apex-positivo)",
  estavel: "var(--apex-alerta)",
  descida: "var(--apex-erro)",
};

const LARGURA = 56;
const ALTURA = 26;

/**
 * Sparkline de tendência — verde a subir, laranja estável, vermelho a
 * descer. Sem dados suficientes (ver direcaoTendencia): traço neutro
 * tracejado, nunca uma linha desenhada a partir de pontos inventados.
 */
export function Sparkline({ tendencia, direcao }: { tendencia: PontoTendencia[]; direcao: Direcao }) {
  if (direcao === "sem_dados") {
    return (
      <svg width={LARGURA} height={ALTURA} viewBox={`0 0 ${LARGURA} ${ALTURA}`} aria-label="Sem dados suficientes para tendência">
        <line
          x1="4"
          y1={ALTURA / 2}
          x2={LARGURA - 4}
          y2={ALTURA / 2}
          stroke="var(--apex-cinza-linha)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 4"
        />
      </svg>
    );
  }

  const coords = escalarPontos(
    tendencia.map((p) => p.volumeKg),
    LARGURA,
    ALTURA,
    4,
  );
  const path = pathLinha(coords);
  const cor = COR_DIRECAO[direcao];

  return (
    <svg
      width={LARGURA}
      height={ALTURA}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      role="img"
      aria-label={`Tendência de volume: ${direcao === "subida" ? "a subir" : direcao === "descida" ? "a descer" : "estável"}`}
    >
      <path d={path} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
