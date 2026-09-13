/**
 * "Alunos que precisam de atenção" (painel do PT) — três sinais objetivos,
 * a partir de dados que já existem (workout_checkins, workout_sessions):
 *
 *   - dor recorrente: ≥2 check-ins com desconforto reportado numa janela
 *     recente (mesmo limiar que motor2/historico.ts já usa para o motor
 *     considerar substituir um exercício).
 *   - adesão baixa: completion médio das sessões recentes abaixo de 75%.
 *   - inativo: sem nenhuma sessão registada há mais de 10 dias (ou nunca).
 *
 * Limiares são uma escolha de produto, não uma norma clínica — fáceis de
 * afinar aqui, num só sítio. "Inativo" tem prioridade sobre "adesão
 * baixa": se nunca treinou (ou há muito que não treina), a adesão média
 * das últimas sessões deixou de ser informativa.
 *
 * Puro — não sabe nada de BD, só a classificação a partir de números já
 * agregados por quem chama (src/app/painel/page.tsx).
 */

export type MotivoAtencao = "dor_recorrente" | "adesao_baixa" | "inativo";

export const LIMIAR_CHECKINS_DESCONFORTO = 2;
export const LIMIAR_ADESAO_BAIXA = 0.75;
export const LIMIAR_INATIVO_DIAS = 10;

export function avaliarAtencao(params: {
  /** dias desde a sessão mais recente; null = nunca treinou. */
  diasDesdeUltimaSessao: number | null;
  /** nº de check-ins com desconforto reportado, na janela recente. */
  checkinsComDesconforto: number;
  /** completion médio das sessões recentes; null = nenhuma sessão. */
  completionMedia: number | null;
}): MotivoAtencao[] {
  const motivos: MotivoAtencao[] = [];

  const inativo = params.diasDesdeUltimaSessao == null || params.diasDesdeUltimaSessao > LIMIAR_INATIVO_DIAS;
  if (inativo) motivos.push("inativo");

  if (params.checkinsComDesconforto >= LIMIAR_CHECKINS_DESCONFORTO) motivos.push("dor_recorrente");

  // sem sessões recentes, a "adesão" não tem o que medir — já é "inativo".
  if (!inativo && params.completionMedia != null && params.completionMedia < LIMIAR_ADESAO_BAIXA) {
    motivos.push("adesao_baixa");
  }

  return motivos;
}
