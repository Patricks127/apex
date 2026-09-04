/* ============================================================
   APEX — Motor de Programação v2 · Passo 6
   Modalidades (spec §6) + regras de treino concorrente (spec §2.5/§2.6).

   O `hipertrofia` continua a usar o seletor de volume (passos 3–4). Os outros
   objetivos têm uma estrutura própria de dias e de parâmetros, mas produzem a
   mesma `SemanaSelecionada` para o resto do motor (validador, histórico, app).
   ============================================================ */

import type { Equipamento, Familia, Musculo } from "./tipos.ts";
import type { ObjetivoV2 } from "./seletor.ts";

// ---------------------------------------------------------------------------
// Parâmetros de prescrição por objetivo (tabela §6)
// ---------------------------------------------------------------------------

export type ParamsObjetivo = {
  /** reps por série do trabalho principal de força/hipertrofia. */
  reps: [number, number];
  /** RIR alvo (reps in reserve). */
  rir: [number, number];
  /** descanso entre séries, em segundos. */
  descanso: [number, number];
  /** % 1RM do trabalho principal (só powerlifting/força). */
  pct1rm?: [number, number];
  /** Regras que NÃO podem perder-se — vão para os avisos do plano. */
  regras: string[];
};

export const PARAMS: Record<ObjetivoV2, ParamsObjetivo> = {
  hipertrofia: {
    reps: [6, 12],
    rir: [1, 3],
    descanso: [60, 90],
    regras: ["Última série de isolamento pode ir a 0–1 RIR."],
  },
  powerlifting: {
    reps: [1, 5],
    rir: [3, 5],
    descanso: [180, 300],
    pct1rm: [85, 92],
    regras: [
      "RIR 3–5 no trabalho principal: falha prejudica a qualidade técnica.",
      "Nunca falha (0 RIR) em terra ou agachamento pesado.",
      "Rotação dos 3 levantamentos ao longo da semana.",
    ],
  },
  hibrido: {
    reps: [5, 8],
    rir: [2, 4],
    descanso: [90, 150],
    regras: [
      "Força e cardio intenso em dias separados (ou ≥6 h de intervalo).",
      "Nunca corrida intensa nas 24 h antes de um dia de pernas pesado.",
      "Com a força como prioridade, preferir bicicleta/remo a corrida (menos dano excêntrico).",
      "Cardio maioritariamente em Z2.",
    ],
  },
  hyrox: {
    reps: [8, 15],
    rir: [1, 3],
    descanso: [30, 60],
    regras: [
      "Estações ao ritmo de prova (compromised running + trabalho).",
      "Força pesada e circuitos ao ritmo de prova em dias diferentes.",
      "Nunca corrida intensa nas 24 h antes de um dia de pernas pesado.",
    ],
  },
  corrida: {
    reps: [8, 12],
    rir: [2, 3],
    descanso: [60, 90],
    regras: [
      "Polarizado: 75–80% do volume em Z1–2, 15–20% em alta intensidade.",
      "Minimizar a zona intermédia (nem fácil nem duro).",
      "Principiante: distribuição piramidal aceita-se — o que conta é volume total e consistência.",
      "Força só de manutenção (2×/semana), nunca nas 24 h antes de uma sessão de qualidade.",
    ],
  },
  calistenia: {
    reps: [5, 15],
    rir: [1, 3],
    descanso: [60, 120],
    regras: [
      "Progressão por alavanca e por reps (não por carga).",
      "Trabalho de skill sempre fresco, no início da sessão.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Tipo de sessão — para o agendamento e a validação
// ---------------------------------------------------------------------------

export type TipoSessao =
  | "forca" // treino de resistência (hipertrofia/acessório)
  | "forca_principal" // dia de levantamento pesado (powerlifting)
  | "skill" // calistenia — trabalho de alavanca
  | "cardio_z2" // endurance de baixa intensidade
  | "cardio_qualidade" // intervalos / limiar / VO2
  | "circuito"; // hyrox — estações ao ritmo de prova

export const CARDIO_DURO: TipoSessao[] = ["cardio_qualidade", "circuito"];
export const FORCA_PERNAS_PESADA: TipoSessao[] = ["forca_principal"];

// ---------------------------------------------------------------------------
// Categoria de objetivo — decide o caminho no seletor e no validador
// ---------------------------------------------------------------------------

export type CategoriaObjetivo = "resistencia" | "misto" | "endurance";

export const CATEGORIA: Record<ObjetivoV2, CategoriaObjetivo> = {
  hipertrofia: "resistencia",
  powerlifting: "resistencia",
  calistenia: "resistencia",
  hibrido: "misto",
  hyrox: "misto",
  corrida: "endurance",
};

// ---------------------------------------------------------------------------
// Grelhas de dias por objetivo × nº de dias
// ---------------------------------------------------------------------------

export type DiaGrelha = {
  tipo: TipoSessao;
  nome: string;
  /** dia de pernas pesado — nada de cardio duro nas 24 h anteriores (§2.5). */
  pernasPesado?: boolean;
  /** para dias de força: músculos que o dia quer treinar (como no seletor). */
  musculos?: Musculo[];
  /** para dias de força: famílias permitidas nesse dia (restringe o pool). */
  familias?: Familia[];
  /** para powerlifting: o levantamento principal do dia. */
  principal?: "agachamento" | "supino" | "terra" | "press";
  /** para cardio: zona alvo. */
  zona?: "z2" | "qualidade";
  /** para hyrox/circuito: modalidades do circuito. */
  estacoes?: Familia[];
};

const M = {
  push: ["peito", "deltoide_anterior", "deltoide_lateral", "triceps"] as Musculo[],
  pull: ["dorsais", "trapezio_medio", "deltoide_posterior", "biceps"] as Musculo[],
  legs: ["quadriceps", "isquiotibiais", "gluteo", "gemeos"] as Musculo[],
  upper: [
    "peito", "dorsais", "trapezio_medio", "deltoide_anterior", "deltoide_lateral",
    "deltoide_posterior", "biceps", "triceps",
  ] as Musculo[],
  full: [
    "peito", "dorsais", "quadriceps", "isquiotibiais", "gluteo", "deltoide_lateral",
    "biceps", "triceps", "gemeos", "core",
  ] as Musculo[],
};

const FAM_CALISTENIA: Familia[] = [
  "horizontal_push", "incline_push", "vertical_push", "vertical_pull", "horizontal_pull",
  "rear_delt_scap", "squat", "unilateral_inferior", "hinge", "knee_flexion", "hip_extension",
  "calf", "core", "elbow_flexion", "elbow_extension", "skill",
];
const FAM_CIRCUITO: Familia[] = ["conditioning", "carry"];

/** Equipamento aceitável em calistenia (progressão por alavanca/reps, não carga). */
export const EQUIP_CALISTENIA: Equipamento[] = [
  "peso_corporal", "barra_fixa", "paralelas", "banda", "trx", "caixa",
];

/** Constrói a grelha de dias (sem contar dias de descanso). */
export function grelhaObjetivo(objetivo: ObjetivoV2, dias: number): DiaGrelha[] {
  const d = Math.min(6, Math.max(3, Math.round(dias || 4)));

  if (objetivo === "powerlifting") {
    const sq: DiaGrelha = { tipo: "forca_principal", nome: "Agachamento", principal: "agachamento", pernasPesado: true, musculos: M.legs, familias: ["squat", "unilateral_inferior", "knee_flexion", "calf", "core"] };
    const be: DiaGrelha = { tipo: "forca_principal", nome: "Supino", principal: "supino", musculos: M.push, familias: ["horizontal_push", "incline_push", "chest_isolation", "elbow_extension", "lateral_raise"] };
    const dl: DiaGrelha = { tipo: "forca_principal", nome: "Terra", principal: "terra", musculos: ["isquiotibiais", "gluteo", "dorsais", "trapezio_medio"], familias: ["hinge", "hip_extension", "horizontal_pull", "vertical_pull", "core"] };
    const bePress: DiaGrelha = { ...be, nome: "Supino + Press", principal: "press" };
    if (d <= 3) return [sq, be, dl];
    if (d === 4) return [sq, be, dl, { ...sq, nome: "Agachamento (volume)" }];
    if (d === 5) return [sq, be, dl, { ...sq, nome: "Agachamento (volume)" }, bePress];
    return [sq, be, dl, { ...sq, nome: "Agachamento (volume)" }, bePress, { ...dl, nome: "Terra (volume)" }];
  }

  if (objetivo === "calistenia") {
    const push: DiaGrelha = { tipo: "forca", nome: "Empurrar", musculos: M.push, familias: FAM_CALISTENIA };
    const pull: DiaGrelha = { tipo: "forca", nome: "Puxar", musculos: M.pull, familias: FAM_CALISTENIA };
    const legs: DiaGrelha = { tipo: "forca", nome: "Pernas", musculos: M.legs, familias: FAM_CALISTENIA };
    const skill: DiaGrelha = { tipo: "skill", nome: "Skill", musculos: M.upper, familias: ["skill", ...FAM_CALISTENIA] };
    if (d <= 3) return [push, pull, legs];
    if (d === 4) return [push, pull, legs, skill];
    if (d === 5) return [push, pull, legs, skill, { ...legs, nome: "Full body", musculos: M.full }];
    return [push, pull, legs, push, pull, legs];
  }

  if (objetivo === "hibrido") {
    const fu: DiaGrelha = { tipo: "forca", nome: "Força · Superior", musculos: M.upper };
    const fl: DiaGrelha = { tipo: "forca", nome: "Força · Inferior", pernasPesado: true, musculos: M.legs };
    const ff: DiaGrelha = { tipo: "forca", nome: "Força · Full body", musculos: M.full };
    const z2: DiaGrelha = { tipo: "cardio_z2", nome: "Cardio Z2", zona: "z2" };
    const q: DiaGrelha = { tipo: "cardio_qualidade", nome: "Cardio · qualidade", zona: "qualidade" };
    if (d <= 3) return [fl, z2, fu];
    if (d === 4) return [fl, z2, fu, q];
    if (d === 5) return [fl, z2, fu, q, ff];
    return [fl, z2, fu, q, ff, { ...z2, nome: "Cardio Z2 (longo)" }];
  }

  if (objetivo === "hyrox") {
    const sForca: DiaGrelha = { tipo: "forca_principal", nome: "Força pesada · Inferior", principal: "agachamento", pernasPesado: true, musculos: M.legs, familias: ["squat", "hinge", "unilateral_inferior", "knee_flexion", "hip_extension", "core"] };
    const sUpper: DiaGrelha = { tipo: "forca", nome: "Força · Superior + erg", musculos: M.upper };
    const circ: DiaGrelha = { tipo: "circuito", nome: "Circuito de prova", estacoes: FAM_CIRCUITO };
    const runQ: DiaGrelha = { tipo: "cardio_qualidade", nome: "Compromised running", zona: "qualidade" };
    const z2: DiaGrelha = { tipo: "cardio_z2", nome: "Corrida Z2", zona: "z2" };
    if (d <= 3) return [sForca, runQ, circ];
    if (d === 4) return [sForca, runQ, sUpper, circ];
    if (d === 5) return [sForca, runQ, sUpper, circ, z2];
    return [sForca, runQ, sUpper, circ, z2, { ...circ, nome: "Circuito de prova (B)" }];
  }

  // corrida — polarizado
  const easy: DiaGrelha = { tipo: "cardio_z2", nome: "Corrida fácil (Z2)", zona: "z2" };
  const long: DiaGrelha = { tipo: "cardio_z2", nome: "Corrida longa (Z2)", zona: "z2" };
  const quality: DiaGrelha = { tipo: "cardio_qualidade", nome: "Sessão de qualidade", zona: "qualidade" };
  const forcaMan: DiaGrelha = { tipo: "forca", nome: "Força de manutenção", musculos: M.full };
  if (d <= 3) return [easy, quality, long];
  if (d === 4) return [easy, quality, forcaMan, long];
  if (d === 5) return [easy, quality, forcaMan, easy, long];
  return [easy, quality, forcaMan, easy, quality, long];
}

// ---------------------------------------------------------------------------
// Alvo de distribuição polarizada (spec §2.6)
// ---------------------------------------------------------------------------

export const POLARIZADO = { z12min: 0.75, qualidadeMin: 0.13, qualidadeMax: 0.25 };
