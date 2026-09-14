/* ============================================================
   Estimativa automática de 1RM a partir do treino ao vivo.

   PASSO 7 (progresso), migração 016 (personal_records.source).

   Só estima para a variante "principal" (estilo competição, barra livre)
   de cada um dos 4 levantamentos do motor — não para acessórios (halteres,
   máquina, pega fechada...), que não são comparáveis ao 1RM de barra livre
   que o motor usa para prescrever cargas (baseLifts/referenceLoads).

   Fórmula: RIR = 10 − RPE (tabela padrão de autorregulação, Tuchscherer/
   Helms), reps efetivas = reps + RIR, 1RM ≈ carga × (1 + efetivas/30)
   (Epley). Direção validada na literatura de treino baseado em RPE — a
   combinação das duas não é a equação exata de nenhum estudo específico,
   é heurística comum em apps de autorregulação.

   Guarda-costas (pedidos explicitamente, não afinação nossa):
     1. Só fiável a reps baixas — a fórmula de Epley infla a extrapolação
        acima de ~8 reps. Reps efetivas >8 → não estima (não é um teste de
        força, é um treino de volume).
     2. O resultado é sempre `source: 'auto'` — nunca substitui um 1RM
        manual nas cargas prescritas (essa regra vive em maxesFromPRs,
        src/lib/motor/index.ts). Aqui só calculamos o valor.
   ============================================================ */

import type { Lift } from "../motor/index.ts";
import { round25 } from "../motor/index.ts";

/** Variante "principal" de cada levantamento → Lift canónico do motor. */
export const EXERCICIO_PARA_LEVANTAMENTO: Record<string, Lift> = {
  agachamento_barra_costas: "agachamento",
  terra_convencional: "terra",
  supino_barra: "supino",
  press_militar_barra: "press",
};

const LIMITE_REPS_EFETIVAS = 8;

/** 1RM estimado (kg, já arredondado a 2,5) de uma série, ou null se faltar
 *  algum dado ou a série não for um teste de força fiável (reps efetivas >8). */
export function estimativa1RM(input: {
  loadKg: number | null;
  reps: number | null;
  rpe: number | null;
}): number | null {
  const { loadKg, reps, rpe } = input;
  if (loadKg == null || !Number.isFinite(loadKg) || loadKg <= 0) return null;
  if (reps == null || !Number.isFinite(reps) || reps <= 0) return null;
  if (rpe == null || !Number.isFinite(rpe) || rpe < 6 || rpe > 10) return null;

  const rir = Math.max(0, 10 - rpe);
  const repsEfetivas = reps + rir;
  if (repsEfetivas > LIMITE_REPS_EFETIVAS) return null;

  return round25(loadKg * (1 + repsEfetivas / 30));
}

export type LogParaEstimativa = {
  exercise_id: string;
  load_kg: number | null;
  reps: number | null;
  rpe: number | null;
  skipped?: boolean;
};

/**
 * Um 1RM estimado por levantamento tocado nesta sessão — o melhor entre os
 * exercícios qualificados (a variante principal de cada levantamento).
 * Chamado em gravarTreino, best-effort, `source: 'auto'`.
 */
export function estimarRecordesDaSessao(
  logs: LogParaEstimativa[],
): { lift: Lift; valueKg: number }[] {
  const melhores: Partial<Record<Lift, number>> = {};
  for (const log of logs) {
    if (log.skipped) continue;
    const lift = EXERCICIO_PARA_LEVANTAMENTO[log.exercise_id];
    if (!lift) continue;
    const estimativa = estimativa1RM({ loadKg: log.load_kg, reps: log.reps, rpe: log.rpe });
    if (estimativa == null) continue;
    if (!melhores[lift] || estimativa > (melhores[lift] as number)) melhores[lift] = estimativa;
  }
  return (Object.keys(melhores) as Lift[]).map((lift) => ({
    lift,
    valueKg: melhores[lift] as number,
  }));
}
