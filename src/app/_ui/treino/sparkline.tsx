import type { PontoAdesaoSemanal, EstadoAdesao } from "@/lib/treino/adesao-semanal";

const COR_ESTADO: Record<Exclude<EstadoAdesao, "sem_dados">, string> = {
  boa: "var(--apex-positivo)",
  a_descer: "var(--apex-alerta)",
  baixa: "var(--apex-erro)",
};

const LARGURA = 56;
const ALTURA = 26;
const PADDING = 4;

/**
 * Sparkline de consistência — treinos feitos vs. previstos, últimas ~6
 * semanas de calendário. Ao contrário de um gráfico de progresso (que
 * escala ao próprio intervalo dos valores, para mostrar variação), aqui a
 * escala é uma janela FIXA 0–100% (ou até ao máximo real, se ultrapassar
 * 100%) — a posição vertical tem de refletir o NÍVEL absoluto de adesão,
 * não só a sua variação relativa (20%→40% não pode parecer "ótimo" só
 * porque duplicou).
 *
 * Cor pelo ESTADO real (ver adesao-semanal.ts: estadoAdesao), não só pela
 * direção — verde quando bom (estável ou a subir, e não baixo), laranja a
 * descer, vermelho quando o nível atual já está abaixo do limiar de
 * atenção. Sem dados suficientes: traço neutro tracejado, nunca uma linha
 * desenhada a partir de pontos inventados.
 */
export function Sparkline({ pontos, estado }: { pontos: PontoAdesaoSemanal[]; estado: EstadoAdesao }) {
  if (estado === "sem_dados" || pontos.length === 0) {
    return (
      <svg width={LARGURA} height={ALTURA} viewBox={`0 0 ${LARGURA} ${ALTURA}`} aria-label="Sem dados suficientes para tendência de adesão">
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

  const referencia = Math.max(1, ...pontos.map((p) => p.pct));
  const passoX = pontos.length > 1 ? (LARGURA - PADDING * 2) / (pontos.length - 1) : 0;
  const coords = pontos.map((p, i) => ({
    x: pontos.length > 1 ? PADDING + i * passoX : LARGURA / 2,
    y: PADDING + (ALTURA - PADDING * 2) * (1 - Math.min(p.pct, referencia) / referencia),
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const cor = COR_ESTADO[estado];
  const direcaoLabel = estado === "boa" ? "boa" : estado === "a_descer" ? "a descer" : "baixa";

  return (
    <svg
      width={LARGURA}
      height={ALTURA}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      role="img"
      aria-label={`Adesão das últimas semanas: ${direcaoLabel}`}
    >
      <path d={path} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
