/* ============================================================
   APEX — Motor de Programação v2 · Passo 2
   Calculadora de volume semanal com contagem fracionada.
   Ver referencia/MOTOR-V2-ESPECIFICACAO.md (secção 2.1 e 4.1).
   ============================================================ */

import { EXERCICIOS } from "./exercicios.ts";
import {
  MUSCULOS,
  MUSCULOS_EMPURRAR,
  MUSCULOS_PUXAR,
  type Musculo,
  type Nivel,
} from "./tipos.ts";

const PORMAPA = new Map(EXERCICIOS.map((e) => [e.id, e]));

// Intervalos de volume (séries diretas/músculo/semana) da tabela §2.1.
export const INTERVALO_VOLUME: Record<
  Nivel,
  { min: number; max: number; teto: number }
> = {
  iniciante: { min: 8, max: 12, teto: 14 },
  intermedio: { min: 12, max: 18, teto: 20 },
  avancado: { min: 14, max: 22, teto: 25 },
};

// `cardio` é um pseudo-músculo de endurance — não tem alvo de hipertrofia.
const SEM_ALVO_VOLUME: Musculo[] = ["cardio"];

export type ExercicioSeries = {
  exercicioId: string;
  series: number;
  dia?: number;
};
export type EntradaVolume = ExercicioSeries[];

export type EstadoVolume =
  | "abaixo" // < min
  | "dentro" // min..max (o alvo)
  | "acima_alvo" // max < x <= teto (ainda recuperável, mas acima do ideal)
  | "acima_teto"; // > teto (spec: rejeitar e reduzir)

export type VolumeMusculo = {
  musculo: Musculo;
  /** Séries diretas fracionadas: Σ(1.0 primário) + Σ(0.5 secundário). */
  direto: number;
  /** Só a componente de primário (1.0 cada). */
  primario: number;
  /** Só a componente de secundário (0.5 cada série). */
  secundario: number;
  estado: EstadoVolume;
  alvoMin: number;
  alvoMax: number;
  teto: number;
  /** false quando `direto` < 8 (mínimo absoluto útil, §4.1) — só relevante
      quando o músculo é alvo do objetivo. */
  acimaMinimoAbsoluto: boolean;
  dentroDoTeto: boolean;
};

export type RacioEmpurrarPuxar = {
  empurrar: number;
  puxar: number;
  /** empurrar / puxar (Infinity se puxar = 0). */
  racio: number;
  /** dentro de 1:1 ± 30% → racio em [0.7, 1.3]. */
  equilibrado: boolean;
};

export type RelatorioVolume = {
  nivel: Nivel;
  porMusculo: VolumeMusculo[];
  racioEmpurrarPuxar: RacioEmpurrarPuxar;
  avisos: string[];
};

const arred = (n: number) => Math.round(n * 100) / 100;

function estadoDe(
  direto: number,
  r: { min: number; max: number; teto: number },
): EstadoVolume {
  if (direto < r.min) return "abaixo";
  if (direto <= r.max) return "dentro";
  if (direto <= r.teto) return "acima_alvo";
  return "acima_teto";
}

/**
 * Volume semanal por músculo a partir de uma lista (exercício, séries).
 * Linhas do mesmo exercício são somadas.
 */
export function calcularVolume(
  entrada: EntradaVolume,
  nivel: Nivel,
): RelatorioVolume {
  const r = INTERVALO_VOLUME[nivel];
  const avisos: string[] = [];

  // agregar séries por exercício
  const seriesPorEx = new Map<string, number>();
  for (const linha of entrada) {
    const s = Number(linha.series);
    if (!Number.isFinite(s) || s <= 0) continue;
    if (!PORMAPA.has(linha.exercicioId)) {
      avisos.push(`Exercício desconhecido, ignorado: ${linha.exercicioId}`);
      continue;
    }
    seriesPorEx.set(
      linha.exercicioId,
      (seriesPorEx.get(linha.exercicioId) ?? 0) + s,
    );
  }

  // acumular contributos fracionados por músculo
  const prim = new Map<Musculo, number>();
  const sec = new Map<Musculo, number>();
  for (const [id, series] of seriesPorEx) {
    const e = PORMAPA.get(id)!;
    for (const p of e.primarios) {
      prim.set(p.musculo, (prim.get(p.musculo) ?? 0) + series * p.contributo);
    }
    for (const s of e.secundarios) {
      sec.set(s.musculo, (sec.get(s.musculo) ?? 0) + series * s.contributo);
    }
  }

  const porMusculo: VolumeMusculo[] = [];
  for (const m of MUSCULOS) {
    if (SEM_ALVO_VOLUME.includes(m)) continue;
    const primario = arred(prim.get(m) ?? 0);
    const secundario = arred(sec.get(m) ?? 0);
    const direto = arred(primario + secundario);
    if (direto === 0) continue;
    porMusculo.push({
      musculo: m,
      direto,
      primario,
      secundario,
      estado: estadoDe(direto, r),
      alvoMin: r.min,
      alvoMax: r.max,
      teto: r.teto,
      acimaMinimoAbsoluto: direto >= 8,
      dentroDoTeto: direto <= r.teto,
    });
  }
  porMusculo.sort((a, b) => b.direto - a.direto);

  for (const vm of porMusculo) {
    if (vm.estado === "acima_teto") {
      avisos.push(
        `${vm.musculo}: ${vm.direto} séries diretas/semana — ACIMA DO TETO (${vm.teto}) para ${nivel}. Reduzir.`,
      );
    }
  }

  // rácio empurrar:puxar (§4.1)
  const somar = (lista: Musculo[]) =>
    arred(
      lista.reduce((acc, m) => acc + (prim.get(m) ?? 0) + (sec.get(m) ?? 0), 0),
    );
  const empurrar = somar(MUSCULOS_EMPURRAR);
  const puxar = somar(MUSCULOS_PUXAR);
  const racio = puxar === 0 ? (empurrar === 0 ? 1 : Infinity) : arred(empurrar / puxar);
  const equilibrado = racio >= 0.7 && racio <= 1.3;
  if (!equilibrado && Number.isFinite(racio)) {
    avisos.push(
      `Rácio empurrar:puxar = ${racio}:1 — fora de 1:1 ± 30%. ` +
        (racio > 1.3 ? "Falta volume de puxar." : "Falta volume de empurrar."),
    );
  }

  return {
    nivel,
    porMusculo,
    racioEmpurrarPuxar: { empurrar, puxar, racio, equilibrado },
    avisos,
  };
}

/** Só o volume direto de um músculo (helper para o seletor/validador). */
export function volumeDireto(entrada: EntradaVolume, musculo: Musculo): number {
  let total = 0;
  const somado = new Map<string, number>();
  for (const l of entrada) {
    if (!PORMAPA.has(l.exercicioId) || !(l.series > 0)) continue;
    somado.set(l.exercicioId, (somado.get(l.exercicioId) ?? 0) + l.series);
  }
  for (const [id, series] of somado) {
    const e = PORMAPA.get(id)!;
    for (const p of e.primarios) if (p.musculo === musculo) total += series * p.contributo;
    for (const s of e.secundarios) if (s.musculo === musculo) total += series * s.contributo;
  }
  return arred(total);
}
