/* ============================================================
   Agregação de volume por semana de programa (workout_sessions.week_number
   — não semana de calendário; é assim que o resto da app já pensa a
   progressão). Puro: recebe as sessões já lidas da BD.
   ============================================================ */

export type SessaoVolume = {
  weekNumber: number | null;
  volumeKg: number;
  isDeload: boolean;
  /** para saber se a semana ainda está em curso (leituras.ts) */
  performedAt?: string;
};

export type SemanaVolume = {
  weekNumber: number;
  volumeKg: number;
  /** true se ALGUMA sessão dessa semana foi gravada em descarga. */
  isDeload: boolean;
  nSessoes: number;
  /** data da sessão mais recente da semana (null se nenhuma a trouxe) */
  ultimaSessao: string | null;
};

/** Soma o volume por semana de programa. Sessões sem `weekNumber` (planos
 *  antigos, antes da coluna existir) ficam de fora — não há semana para
 *  as agrupar. */
export function agruparVolumePorSemana(sessoes: SessaoVolume[]): SemanaVolume[] {
  const porSemana = new Map<number, SemanaVolume>();
  for (const s of sessoes) {
    if (s.weekNumber == null) continue;
    const atual = porSemana.get(s.weekNumber) ?? {
      weekNumber: s.weekNumber,
      volumeKg: 0,
      isDeload: false,
      nSessoes: 0,
      ultimaSessao: null,
    };
    atual.volumeKg += s.volumeKg;
    atual.isDeload = atual.isDeload || s.isDeload;
    atual.nSessoes += 1;
    if (s.performedAt && (!atual.ultimaSessao || s.performedAt > atual.ultimaSessao)) atual.ultimaSessao = s.performedAt;
    porSemana.set(s.weekNumber, atual);
  }
  return [...porSemana.values()].sort((a, b) => a.weekNumber - b.weekNumber);
}
