/* ============================================================
   Períodos dos gráficos de evolução (/progresso e ficha do aluno): UM
   seletor por página, aplicado a todos os gráficos e às frases de leitura.
   Puro, testado (periodos.test.ts).
   ============================================================ */

export type PeriodoId = "7d" | "30d" | "3m" | "6m" | "1a";

export const PERIODOS: { id: PeriodoId; rotulo: string; nome: string; dias: number; semanas: number }[] = [
  // `semanas` = janelas de calendário do gráfico de adesão (a última é a
  // semana em curso): 7 dias → a última semana completa + a atual.
  { id: "7d", rotulo: "7 d", nome: "7 dias", dias: 7, semanas: 2 },
  { id: "30d", rotulo: "30 d", nome: "30 dias", dias: 30, semanas: 5 },
  { id: "3m", rotulo: "3 m", nome: "3 meses", dias: 91, semanas: 13 },
  { id: "6m", rotulo: "6 m", nome: "6 meses", dias: 182, semanas: 26 },
  { id: "1a", rotulo: "1 ano", nome: "1 ano", dias: 365, semanas: 52 },
];

/** 3 meses: o histórico da maioria ainda é curto — 30 dias escondia quase
 *  tudo; 1 ano achatava as linhas. */
export const PERIODO_OMISSAO: PeriodoId = "3m";

export const periodo = (id: PeriodoId) => PERIODOS.find((p) => p.id === id)!;

/** Instante em que o período começa (agora − N dias). */
export function inicioPeriodo(id: PeriodoId, agora: Date = new Date()): number {
  return agora.getTime() - periodo(id).dias * 86_400_000;
}

/** Só os itens dentro do período (data ≥ início). */
export function filtrarPeriodo<T>(itens: T[], data: (t: T) => string, id: PeriodoId, agora: Date = new Date()): T[] {
  const inicio = inicioPeriodo(id, agora);
  return itens.filter((t) => Date.parse(data(t)) >= inicio);
}

/** Intervalo mínimo entre o primeiro e o último ponto para haver
 *  tendência: 7 dias, exceto no período de 7 dias (aí 3 — senão nunca
 *  haveria frase nesse período). */
export const minDiasTendencia = (id: PeriodoId) => (id === "7d" ? 3 : 7);
