/* ============================================================
   Marcos numa série cronológica — para o azul reservado do sistema de
   design (SISTEMA-DESIGN.md: "preto e branco, o azul só a marcar marcos").

   Genérico de propósito: serve tanto para "novo recorde pessoal" (por
   levantamento, no gráfico de força) como para qualquer outra série
   agrupada por chave onde faça sentido destacar o melhor valor até agora.
   Semana de descarga é outro tipo de marco, mas essa vem já calculada de
   `workout_sessions.is_deload` — não há nada para derivar aqui.
   ============================================================ */

/**
 * Marca cada ponto com `novoRecorde: true` quando o seu valor é o mais alto
 * visto até então para a mesma chave, percorrendo os pontos por ordem
 * cronológica (não pela ordem em que chegam). O primeiro ponto de uma
 * chave é sempre um marco — é o primeiro recorde conhecido, por definição.
 */
export function marcarNovosRecordes<T>(
  pontos: T[],
  chave: (p: T) => string,
  valor: (p: T) => number,
  quando: (p: T) => string,
): (T & { novoRecorde: boolean })[] {
  const ordenados = [...pontos].sort((a, b) => quando(a).localeCompare(quando(b)));
  const melhorAte = new Map<string, number>();
  return ordenados.map((p) => {
    const k = chave(p);
    const v = valor(p);
    const anterior = melhorAte.get(k);
    const novoRecorde = anterior === undefined || v > anterior;
    melhorAte.set(k, novoRecorde ? v : (anterior as number));
    return { ...p, novoRecorde };
  });
}
