/* ============================================================
   APEX — Motor de Programação v2 · Passo 6
   Adaptador: SemanaSelecionada (motor v2) → PlanoGerado (o formato que a app
   já renderiza). Substitui `buildWeek` do v1.

   Reutiliza do v1 apenas: estimativa de 1RM (`baseLifts`), arredondamento de
   carga (`round25`), fator de progressão e os textos de ciência/dias. Quando o
   v1 for removido, estes seis itens movem-se para cá.
   ============================================================ */

import {
  DAY_NAMES,
  DAY_SHORT,
  SCIENCE,
  baseLifts,
  progressionFactor,
  round25,
  type DiaGerado,
  type ExercicioGerado,
  type Goal,
  type Injury,
  type Level,
  type Lift,
  type MetaMotor,
  type MotorProfile,
  type PlanoGerado,
  type Progression,
} from "../motor/index.ts";
import { PARAMS } from "./objetivos.ts";
import { equipamentoPorDiaDe } from "./equipamento.ts";
import {
  EQUIP_DISPONIVEL,
  type DiaSelecionado,
  type ExercicioPrescrito,
  type PerfilSelecao,
  type SemanaSelecionada,
} from "./seletor.ts";
import { gerarPlanoValidado } from "./validador.ts";
import type { Musculo } from "./tipos.ts";

export const MUSCULO_LABEL: Record<Musculo, string> = {
  peito: "Peito",
  dorsais: "Costas",
  trapezio_medio: "Trapézio médio",
  trapezio_superior: "Trapézio superior",
  deltoide_anterior: "Deltoide anterior",
  deltoide_lateral: "Deltoide lateral",
  deltoide_posterior: "Deltoide posterior",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebraco: "Antebraço",
  quadriceps: "Quadríceps",
  isquiotibiais: "Isquiotibiais",
  gluteo: "Glúteo",
  adutores: "Adutores",
  gemeos: "Gémeos",
  lombar: "Lombar",
  core: "Core",
  cardio: "Cardio",
};

// ---------------------------------------------------------------------------
// perfil do v1 → perfil do seletor v2
// ---------------------------------------------------------------------------

const FOCO_V1_V2: Record<string, Musculo[]> = {
  gluteo: ["gluteo"],
  peito: ["peito"],
  costas: ["dorsais"],
  ombros: ["deltoide_lateral"],
  bracos: ["biceps", "triceps"],
  core: ["core"],
};

export function perfilV2De(mp: MotorProfile): PerfilSelecao {
  const foco = (mp.focus ?? []).flatMap((f) => FOCO_V1_V2[f] ?? []).slice(0, 2);
  // Perfis antigos (e os testes que montam um MotorProfile à mão) não trazem
  // `equipamentoPorDia` — deriva-se do local, que é o que já se fazia.
  const equipamentoPorDia =
    mp.equipamentoPorDia && mp.equipamentoPorDia.length > 0
      ? mp.equipamentoPorDia
      : equipamentoPorDiaDe({
          location: mp.location,
          dias: mp.daysPerWeek,
          diasGinasio: mp.gymDaysPerWeek,
        });
  return {
    objetivo: mp.goal,
    nivel: mp.level as Level,
    dias: mp.daysPerWeek,
    // PARTE 1: o conjunto plano mantém-se o de hoje (o seletor ainda não lê
    // `equipamentoPorDia`), para o comportamento gerado não mudar.
    equipamento: EQUIP_DISPONIVEL[mp.location] ?? EQUIP_DISPONIVEL.ginasio,
    equipamentoPorDia,
    lesoes: (mp.injuries ?? []) as PerfilSelecao["lesoes"],
    foco: mp.goal === "hipertrofia" ? foco : [],
    // "auto" e qualquer outro objetivo → "frequencia"
    splitFormato: mp.goal === "hipertrofia" && mp.splitFormat === "muscular" ? "muscular" : "frequencia",
  };
}

// ---------------------------------------------------------------------------
// posições dos dias de treino na semana de 7 dias (descanso pelo meio)
// ---------------------------------------------------------------------------

// Exportado: um plano de PT (src/app/actions/treino.ts::atribuirPlanoPt) usa
// o mesmo mapeamento para espalhar os dias de treino que o PT escreveu pela
// semana de 7 — 1/2 dias não acontecem num plano do motor (clampado a 3–6),
// mas um PT pode legitimamente atribuir um plano de 1 ou 2 dias.
export const CALENDARIO: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 4, 5, 6],
};

// ---------------------------------------------------------------------------
// cargas
// ---------------------------------------------------------------------------

const CARREGAVEL = new Set(["barra", "halteres", "maquina", "cabos", "kettlebell", "sled"]);

function musculoParaLift(m: Musculo): Lift {
  if (["peito", "deltoide_anterior"].includes(m)) return "supino";
  if (["deltoide_lateral", "triceps"].includes(m)) return "press";
  if (["quadriceps", "gluteo", "adutores"].includes(m)) return "agachamento";
  return "terra"; // isquiotibiais, lombar, dorsais, biceps, trapézios, core, gémeos…
}

function pctBase(objetivo: Goal, tier: number, ordem: number): number {
  if (objetivo === "powerlifting") return ordem === 1 && tier <= 2 ? 0.87 : tier === 2 ? 0.6 : 0.42;
  if (objetivo === "hibrido" || objetivo === "hyrox") return tier === 1 ? 0.72 : tier === 2 ? 0.55 : 0.42;
  if (objetivo === "corrida") return tier === 1 ? 0.6 : tier === 2 ? 0.45 : 0.35;
  return tier === 1 ? 0.7 : tier === 2 ? 0.55 : 0.4; // hipertrofia
}

// ---------------------------------------------------------------------------
// cardio → "dose"
// ---------------------------------------------------------------------------

function doseCardio(d: DiaSelecionado, e: ExercicioPrescrito): string {
  const longo = /long/i.test(d.nome);
  if (d.tipo === "cardio_qualidade") {
    if (/intervalos_vo2/.test(e.exercicio.id)) return "5–6 × 3 min a ritmo forte, 2 min de trote";
    if (/tempo_limiar/.test(e.exercicio.id)) return "20–30 min contínuo a ritmo de limiar";
    if (/sprint/.test(e.exercicio.id)) return "8–10 × 20 s all-out, 60 s fácil";
    return "6 × 2–3 min forte, recuperação igual";
  }
  return longo ? "60–90 min contínuos em Z2 (conversa possível)" : "35–50 min contínuos em Z2";
}

// ---------------------------------------------------------------------------

export type OpcoesPlanoV2 = {
  progression?: Progression | null;
  checkinZones?: Injury[] | null;
};

function prescrever(
  d: DiaSelecionado,
  e: ExercicioPrescrito,
  ctx: {
    objetivo: Goal;
    lvl: Record<Lift, number>;
    mult: number;
    repAdd: number;
    checkin: Set<string>;
    foco: Musculo[];
  },
): ExercicioGerado {
  const ex = e.exercicio;
  const params = PARAMS[ctx.objetivo];

  if (ex.familia === "cardio") {
    return {
      name: ex.nome,
      swap: null,
      sets: [{ w: null, reps: 0, rpe: d.tipo === "cardio_qualidade" ? "Z4–5" : "Z2" }],
      rest: "—",
      muscle: "Cardio",
      bw: false,
      substituted: false,
      detail: doseCardio(d, e),
      exercicioId: ex.id,
    };
  }

  // calistenia: progressão por reps/alavanca, nunca por carga
  const carregavel = ctx.objetivo !== "calistenia" && ex.equipamento.some((q) => CARREGAVEL.has(q));
  const lift = musculoParaLift(ex.primarios[0].musculo);
  let pct = pctBase(ctx.objetivo, ex.tier, e.ordem);
  if (["horizontal_pull", "vertical_pull", "rear_delt_scap", "lateral_raise", "elbow_flexion", "elbow_extension"].includes(ex.familia)) {
    pct *= 0.55;
  }
  const cautela = ex.contraindicacoes.some((z) => ctx.checkin.has(z));
  let w: number | null = carregavel ? round25(ctx.lvl[lift] * pct * ctx.mult * (cautela ? 0.92 : 1)) : null;
  if (w != null && !Number.isFinite(w)) w = null;

  // T1 = extremo pesado do intervalo, T3 = extremo leve. No powerlifting o
  // levantamento principal roda 3–5 reps (não singles todas as sessões).
  const mid = Math.round((params.reps[0] + params.reps[1]) / 2);
  let repsAlvo = ex.tier === 1 ? params.reps[0] : ex.tier === 2 ? mid : params.reps[1];
  if (ctx.objetivo === "powerlifting" && e.ordem === 1) repsAlvo = Math.max(3, mid);
  const reps = Math.max(1, repsAlvo + (w != null ? ctx.repAdd : ctx.repAdd + 2));
  const rpe = `RIR ${params.rir[0]}–${params.rir[1]}`;
  const rest =
    ex.tier === 1
      ? `${params.descanso[1]} s`
      : ex.tier === 2
        ? `${Math.round((params.descanso[0] + params.descanso[1]) / 2)} s`
        : `${params.descanso[0]} s`;

  const g: ExercicioGerado = {
    name: ex.nome,
    swap: e.ordem === 1 && d.tipo === "forca_principal" ? "Levantamento principal — técnica primeiro" : null,
    sets: Array.from({ length: e.series }, () => ({ w, reps, rpe })),
    rest,
    muscle: ex.primarios[0].musculo,
    bw: !carregavel,
    substituted: false,
    // liga de volta a EXERCICIOS — permite aplicarCautelaLeitura ajustar a
    // carga por check-in em LEITURA (sem regenerar), tal como já faz para
    // um plano de PT.
    exercicioId: ex.id,
  };
  if (cautela) g.caution = true;
  if (e.foco) {
    const musculoFoco = ex.primarios.map((p) => p.musculo).find((m) => ctx.foco.includes(m));
    g.focusTag = musculoFoco ? MUSCULO_LABEL[musculoFoco] : "foco";
  }
  return g;
}

/** Gera o plano no formato que a app renderiza. Substitui `buildWeek`. */
export function gerarPlanoV2(
  mp: MotorProfile,
  maxes?: Partial<Record<Lift, number>> | null,
  opts?: OpcoesPlanoV2,
): PlanoGerado & { meta: MetaMotor } {
  const perfil = perfilV2De(mp);
  const { semana } = gerarPlanoValidado(perfil);
  return montarPlano(semana, mp, maxes, opts);
}

/** Igual a `gerarPlanoV2` mas a partir de uma semana já selecionada (testes). */
export function montarPlano(
  semana: SemanaSelecionada,
  mp: MotorProfile,
  maxes?: Partial<Record<Lift, number>> | null,
  opts?: OpcoesPlanoV2,
): PlanoGerado & { meta: MetaMotor } {
  const prog = opts?.progression ?? null;
  const { lvl, usedReal } = baseLifts({ sex: mp.sex, level: mp.level }, maxes);
  const { mult, repAdd } = progressionFactor(prog);
  const checkin = new Set<string>(opts?.checkinZones ?? []);
  const objetivo = mp.goal;

  const nDias = Math.min(6, Math.max(3, semana.dias.length));
  const posicoes = CALENDARIO[nDias] ?? CALENDARIO[4];

  const ctx = { objetivo, lvl, mult, repAdd, checkin, foco: semana.perfil.foco ?? [] };
  const treino = new Map<number, DiaSelecionado>();
  semana.dias.slice(0, posicoes.length).forEach((d, i) => treino.set(posicoes[i], d));

  const days: DiaGerado[] = [];
  for (let i = 0; i < 7; i++) {
    const d = treino.get(i);
    if (!d) {
      days.push({ dayIndex: i, dayName: DAY_NAMES[i], dayShort: DAY_SHORT[i], rest: true, title: "Descanso" });
      continue;
    }
    days.push({
      dayIndex: i,
      dayName: DAY_NAMES[i],
      dayShort: DAY_SHORT[i],
      rest: false,
      title: d.nome,
      type: d.tipo,
      exercises: d.exercicios.map((e) => prescrever(d, e, ctx)),
      why: PARAMS[objetivo].regras.slice(0, 3),
    });
  }

  const allLifts: Lift[] = ["agachamento", "terra", "supino", "press"];
  return {
    version: 1,
    meta: {
      goal: objetivo,
      sex: mp.sex,
      level: mp.level,
      daysPerWeek: nDias,
      location: mp.location,
      locationNote: mp.locationNote ?? null,
      splitStyle: "freq",
      injuries: (mp.injuries ?? []) as Injury[],
      focus: mp.focus ?? [],
      science: SCIENCE[objetivo] ?? SCIENCE.hipertrofia,
      maxes: {
        used: {
          agachamento: Math.round(lvl.agachamento),
          terra: Math.round(lvl.terra),
          supino: Math.round(lvl.supino),
          press: Math.round(lvl.press),
        },
        real: usedReal,
        estimated: allLifts.filter((k) => !usedReal.includes(k)),
      },
      week: prog?.week ?? 1,
      deloadWeek: !!prog?.deloadWeek,
      generatedAt: new Date().toISOString(),
    },
    days,
  };
}
