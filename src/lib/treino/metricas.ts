/* Vocabulário fixo para body_metrics — validado aqui (Server Action) e,
 * desde a migração 022, pela CHECK da própria coluna. Módulo partilhado (não em
 * actions/progresso.ts): um ficheiro "use server" só pode exportar funções
 * async — um const object exportado dali chega a undefined no cliente. */

// Só o que se mede com balança normal e fita métrica — nada de gordura
// corporal nem massa muscular (exigem bioimpedância; um valor adivinhado
// seria pior do que nenhum). O IMC não está aqui de propósito: é
// CALCULADO de peso + altura (src/lib/treino/imc.ts), nunca registado.
// Acrescentar uma medida exige uma migração (a CHECK de body_metrics.metric,
// 022) — mas NUNCA mexer na RLS: as policies (dono vê/grava; PT só com
// scope "metricas") não olham para o tipo, por isso uma medida nova fica
// tão protegida como as antigas por construção. Ordem = ordem no ecrã.
export const METRICAS = {
  // A MESMA lista está na CHECK de body_metrics (supabase/migrations/022_…);
  // metricas.test.ts falha se divergirem — acrescentar aqui = nova migração.
  weight_kg: { label: "Peso", unidade: "kg", min: 20, max: 300, exemplo: "65,5" },
  height_cm: { label: "Altura", unidade: "cm", min: 100, max: 250, exemplo: "168" },
  waist_cm: { label: "Cintura", unidade: "cm", min: 30, max: 250, exemplo: "72" },
  abdomen_cm: { label: "Abdómen", unidade: "cm", min: 30, max: 250, exemplo: "80" },
  hip_cm: { label: "Anca", unidade: "cm", min: 30, max: 250, exemplo: "98" },
  chest_cm: { label: "Peito", unidade: "cm", min: 30, max: 250, exemplo: "90" },
  arm_cm: { label: "Braço", unidade: "cm", min: 10, max: 100, exemplo: "29" },
  thigh_cm: { label: "Coxa", unidade: "cm", min: 15, max: 150, exemplo: "55" },
} as const;

export type MetricaId = keyof typeof METRICAS;
