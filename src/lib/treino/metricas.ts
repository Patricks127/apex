/* Vocabulário fixo para body_metrics (chave-valor livre na BD — o
 * vocabulário vive aqui, não na base de dados). Módulo partilhado (não em
 * actions/progresso.ts): um ficheiro "use server" só pode exportar funções
 * async — um const object exportado dali chega a undefined no cliente. */

export const METRICAS = {
  weight_kg: { label: "Peso", unidade: "kg", min: 20, max: 300 },
  waist_cm: { label: "Cintura", unidade: "cm", min: 30, max: 250 },
  chest_cm: { label: "Peito", unidade: "cm", min: 30, max: 250 },
  hip_cm: { label: "Anca", unidade: "cm", min: 30, max: 250 },
  thigh_cm: { label: "Coxa", unidade: "cm", min: 15, max: 150 },
  arm_cm: { label: "Braço", unidade: "cm", min: 10, max: 100 },
} as const;

export type MetricaId = keyof typeof METRICAS;
