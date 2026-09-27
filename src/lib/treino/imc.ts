/* IMC — CALCULADO, nunca registado à mão: peso / (altura em m)². Usa o
 * registo mais recente de peso e de altura (body_metrics). Sem os dois, não
 * há IMC — nunca um número estimado ou inventado. Puro, testado
 * (imc.test.ts). */

import type { MetricaCorporal } from "./progresso-dados";

export function calcularImc(pesoKg: number | null, alturaCm: number | null): number | null {
  if (pesoKg == null || alturaCm == null || !(pesoKg > 0) || !(alturaCm > 0)) return null;
  const m = alturaCm / 100;
  return Math.round((pesoKg / (m * m)) * 10) / 10;
}

const maisRecente = (metricas: MetricaCorporal[], metric: string) =>
  metricas.filter((x) => x.metric === metric).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];

export function imcAtual(
  metricas: MetricaCorporal[],
): { imc: number; pesoKg: number; alturaCm: number; pesoEm: string } | null {
  const peso = maisRecente(metricas, "weight_kg");
  const altura = maisRecente(metricas, "height_cm");
  if (!peso || !altura) return null;
  const imc = calcularImc(peso.value, altura.value);
  return imc == null ? null : { imc, pesoKg: peso.value, alturaCm: altura.value, pesoEm: peso.recordedAt };
}
