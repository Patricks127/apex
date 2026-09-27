/* ============================================================
   Formatação de valores para o ecrã — UM sítio só (como o fuso, em
   src/lib/fuso.ts). Nada de identificadores internos, pontos decimais ou
   escalas misturadas a chegar ao utilizador.

   - números/cargas: formato de Portugal — "32,5 kg", nunca "32.5 kg"
   - músculos: nome legível — "Deltoide lateral", nunca "deltoide_lateral"
     (os planos do motor v2 GUARDAM o identificador no snapshot da BD, por
     isso a tradução tem de ser feita aqui, à saída, e não só no motor)
   - esforço-alvo de uma série: sempre RIR (reps na reserva) — nunca
     "RPE RIR 1–3". Os planos antigos (motor v1) guardam RPE a sério
     ("7–8"), convertido com RIR = 10 − RPE.

   Puro, testável com `npm run test:formato`.
   ============================================================ */

import { MUSCULO_LABEL } from "./motor2/plano.ts";

const NUMERO = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });
const NUMERO_1_CASA = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });

/** "32,5" · "40" · "12 500" — vírgula decimal, até 2 casas (1 com `casas: 1`). */
export function formatarNumero(n: number, casas: 1 | 2 = 2): string {
  return (casas === 1 ? NUMERO_1_CASA : NUMERO).format(n);
}

/** "32,5 kg" */
export function formatarKg(n: number): string {
  return `${formatarNumero(n)} kg`;
}

/** Nome legível de um músculo. Aceita o identificador do motor v2
 *  ("deltoide_lateral" → "Deltoide lateral") e deixa passar o que já é um
 *  nome (planos do motor v1 guardam "Pernas", "Ombros"…). Nunca devolve um
 *  identificador com underscore, mesmo um que o mapa ainda não conheça. */
export function rotuloMusculo(musculo: string | null | undefined): string | null {
  if (!musculo) return null;
  const conhecido = (MUSCULO_LABEL as Record<string, string>)[musculo];
  if (conhecido) return conhecido;
  if (!musculo.includes("_")) return musculo;
  const legivel = musculo.replace(/_/g, " ");
  return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}

const INTERVALO = /^(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?$/;
const num = (s: string) => Number(s.replace(",", "."));
const intervalo = (a: number, b: number) =>
  a === b ? formatarNumero(a) : `${formatarNumero(Math.min(a, b))}–${formatarNumero(Math.max(a, b))}`;

/**
 * Etiqueta do esforço-alvo de uma série, numa escala só:
 * - séries com repetições → "RIR 1–3" (RPE antigo convertido: RPE 8 = RIR 2)
 * - trabalho por tempo/distância (cardio, sem reps) → "Zona 2" ou
 *   "Esforço 8–9/10" — RIR não se aplica a uma corrida
 * - vazio/"—" (planos do PT sem alvo) → null, não se mostra nada
 */
export function rotuloEsforco(alvo: string | null | undefined, comRepeticoes: boolean): string | null {
  const t = (alvo ?? "").trim();
  if (!t || t === "—" || t === "-") return null;

  const rir = /^RIR\s*(.+)$/i.exec(t);
  if (rir) return `RIR ${rir[1].replace(/\s*-\s*/g, "–")}`;

  const zona = /^Z\s*(\d.*)$/i.exec(t);
  if (zona) return `Zona ${zona[1].replace(/\s*-\s*/g, "–")}`;

  const rpe = INTERVALO.exec(t.replace(/^RPE\s*/i, ""));
  if (rpe) {
    const a = num(rpe[1]);
    const b = rpe[2] ? num(rpe[2]) : a;
    return comRepeticoes ? `RIR ${intervalo(10 - a, 10 - b)}` : `Esforço ${intervalo(a, b)}/10`;
  }

  return t;
}
