/* ============================================================
   Matemática pura por trás dos gráficos SVG de /progresso — escala de
   valores para coordenadas, e o path de uma linha. Sem React, sem DOM;
   testável isoladamente (o mesmo motivo por trás de linha-tempo.ts/
   discos.ts).
   ============================================================ */

export type PontoGrafico = { x: number; y: number };

/**
 * Mapeia uma série de valores para coordenadas SVG dentro de
 * `largura`×`altura`, com `padding` para os pontos não ficarem colados às
 * bordas (e o círculo/rótulo de um marco não ser cortado). Eixo Y invertido
 * — SVG cresce para baixo, o gráfico cresce para cima. Uma série de um só
 * ponto fica centrada horizontalmente; todos os valores iguais ficam a
 * meia altura (não há span para distribuir).
 */
export function escalarPontos(
  valores: number[],
  largura: number,
  altura: number,
  padding = 20,
): PontoGrafico[] {
  if (valores.length === 0) return [];
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min;
  const passoX = valores.length > 1 ? (largura - padding * 2) / (valores.length - 1) : 0;
  return valores.map((v, i) => ({
    x: valores.length > 1 ? padding + i * passoX : largura / 2,
    // span 0 (todos os valores iguais) → sem variação para distribuir,
    // fica uma reta a meia altura em vez de colada ao fundo.
    y: span === 0 ? padding + (altura - padding * 2) / 2 : padding + (altura - padding * 2) * (1 - (v - min) / span),
  }));
}

/** Path SVG (`<path d=...>`) que liga os pontos por retas. */
export function pathLinha(pontos: PontoGrafico[]): string {
  if (pontos.length === 0) return "";
  return pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/** Altura de cada barra (px) proporcional ao valor máximo da série. */
export function escalarBarras(valores: number[], alturaMax: number): number[] {
  if (valores.length === 0) return [];
  const max = Math.max(...valores, 1);
  return valores.map((v) => (v / max) * alturaMax);
}
