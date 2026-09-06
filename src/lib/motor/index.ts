/* ============================================================
   APEX — Motor de treino (parte 1: geração de planos)

   Código PURO: sem React, sem chamadas à BD. Recebe um perfil
   (+ recordes opcionais) e devolve a semana de treino já
   materializada, pronta para gravar em training_plans.days (jsonb).

   Portado de referencia/apex-prototipo.jsx (motor v6). Só a
   lógica — os componentes React do protótipo foram ignorados.
   Fora do âmbito da parte 1 (fica para a parte 2): registo de
   treino, progressão semana-a-semana, check-in pós-treino.
   ============================================================ */

// O vocabulário de equipamento é o do motor v2 (uma só lista para os dois).
import type { Equipamento } from "../motor2/tipos.ts";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Goal =
  | "hipertrofia"
  | "powerlifting"
  | "hibrido"
  | "hyrox"
  | "corrida"
  | "calistenia";

export type Level = "iniciante" | "intermedio" | "avancado";
export type Sex = "homem" | "mulher";
export type Location = "ginasio" | "casa" | "hibrido" | "parque" | "outro";
export type Injury =
  | "ombro"
  | "cotovelo"
  | "pulso"
  | "joelho"
  | "lombar"
  | "anca"
  | "tornozelo"
  | "pescoco";
export type FocusMuscle =
  | "gluteo"
  | "peito"
  | "costas"
  | "ombros"
  | "bracos"
  | "core";
export type SplitStyle = "freq" | "bro";
export type Lift = "agachamento" | "terra" | "supino" | "press";

export interface MotorProfile {
  goal: Goal;
  sex: Sex;
  level: Level;
  daysPerWeek: number; // 3–6 (fora disso é ajustado)
  location: Location;
  locationNote?: string | null;
  /** Só "hibrido": quantos dos `daysPerWeek` são no ginásio (os outros em casa). */
  gymDaysPerWeek?: number | null;
  /**
   * Equipamento disponível em CADA dia de treino (motor v2). Índice = dia do
   * split, comprimento = `daysPerWeek`. Fora de "hibrido" todos os dias são
   * iguais. Ausente → derivado de `location` (ver `equipamentoPorDiaDe`).
   */
  equipamentoPorDia?: Equipamento[][];
  injuries?: Injury[];
  injuryNote?: string | null;
  focus?: FocusMuscle[];
  splitStyle?: SplitStyle; // só hipertrofia; por omissão "freq"
  /** Formato do split de hipertrofia (motor v2). "auto" = frequencia. */
  splitFormat?: "frequencia" | "muscular" | "auto";
  eventDate?: string | null; // não recolhido na parte 1; fica inerte
}

export interface Movimento {
  name: string;
  dose: string;
}

export interface SerieGerada {
  w: number | null; // carga em kg, ou null (peso corporal / cardio)
  reps: number; // 0 = sem contagem de reps (hold, corrida)
  rpe: string;
}

export interface ExercicioGerado {
  name: string;
  swap: string | null; // nota de coaching (lesão, técnica)
  sets: SerieGerada[];
  rest: string;
  muscle: string | null;
  bw: boolean; // peso corporal
  substituted: boolean; // trocado por causa de lesão
  caution?: boolean; // carga reduzida por desconforto reportado no check-in
  focusTag?: string; // marcado como trabalho de foco
  detail?: string;
}

export interface DiaGerado {
  dayIndex: number;
  dayName: string;
  dayShort: string;
  rest: boolean;
  title?: string;
  type?: string;
  cdType?: string;
  warmup?: Movimento[];
  cooldown?: Movimento[];
  rehab?: Movimento[];
  exercises?: ExercicioGerado[];
  why?: string[];
  adjustments?: string[];
}

export interface PlanoGerado {
  version: 1;
  meta: {
    goal: Goal;
    sex: Sex;
    level: Level;
    daysPerWeek: number;
    location: Location;
    locationNote: string | null;
    splitStyle: SplitStyle;
    injuries: Injury[];
    focus: FocusMuscle[];
    science: string;
    maxes: {
      used: Record<Lift, number>;
      real: Lift[];
      estimated: Lift[];
    };
    week: number; // semana de progressão que este plano reflete
    deloadWeek: boolean; // a semana é de descarga (−10% carga)
    generatedAt: string;
  };
  days: DiaGerado[]; // sempre 7
}

export interface OpcoesGeracao {
  /** Estado de progressão semanal — afeta as cargas e as reps. */
  progression?: Progression | null;
  /** Zonas com desconforto no último check-in — aplica −8% "carga cautelar". */
  checkinZones?: Injury[] | null;
}

// ---------------------------------------------------------------------------
// Constantes de base
// ---------------------------------------------------------------------------

export const round25 = (x: number): number =>
  Math.max(10, Math.round(x / 2.5) * 2.5);

/** Estimativa de 1RM (kg) por nível — referência masculina. */
export const E1RM: Record<Level, Record<Lift, number>> = {
  iniciante: { agachamento: 60, terra: 80, supino: 42, press: 30 },
  intermedio: { agachamento: 105, terra: 140, supino: 75, press: 50 },
  avancado: { agachamento: 145, terra: 185, supino: 108, press: 68 },
};

/** Multiplicador por sexo aplicado à estimativa. */
export const SEX_MULT: Record<Sex, Record<Lift, number>> = {
  homem: { agachamento: 1, terra: 1, supino: 1, press: 1 },
  mulher: { agachamento: 0.72, terra: 0.72, supino: 0.55, press: 0.55 },
};

export const LIFT_LABEL: Record<Lift, string> = {
  agachamento: "Agachamento",
  terra: "Levantamento terra",
  supino: "Supino",
  press: "Press militar",
};

const HYPERTROPHY_GOALS: Goal[] = ["hipertrofia"];
const STRENGTH_LIFT_GOALS: Goal[] = ["hipertrofia", "powerlifting", "hibrido"];

export const DAY_NAMES = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];
export const DAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Opções para o ecrã de onboarding
export const GOALS: { id: Goal; label: string; short: string }[] = [
  { id: "hipertrofia", label: "Ganhar músculo (hipertrofia)", short: "Hipertrofia" },
  { id: "powerlifting", label: "Powerlifting / força máxima", short: "Força máxima" },
  { id: "hibrido", label: "Ser híbrido: forte E resistente", short: "Híbrido" },
  { id: "hyrox", label: "Competir em Hyrox", short: "Hyrox" },
  { id: "corrida", label: "Correr melhor / mais longe", short: "Corrida" },
  { id: "calistenia", label: "Calistenia / peso corporal", short: "Calistenia" },
];

export const LEVELS: { id: Level; label: string }[] = [
  { id: "iniciante", label: "A começar" },
  { id: "intermedio", label: "Treino há 1–3 anos" },
  { id: "avancado", label: "Avançado / competidor" },
];

export const SEXES: { id: Sex; label: string }[] = [
  { id: "homem", label: "Homem" },
  { id: "mulher", label: "Mulher" },
];

export const LOCATIONS: { id: Location; label: string }[] = [
  { id: "ginasio", label: "Ginásio" },
  { id: "casa", label: "Em casa" },
  { id: "hibrido", label: "Casa + Ginásio" },
  { id: "parque", label: "Parque de calistenia" },
  { id: "outro", label: "Outro (escrever)" },
];

export const INJURIES: { id: Injury; label: string }[] = [
  { id: "ombro", label: "Ombro" },
  { id: "cotovelo", label: "Cotovelo" },
  { id: "pulso", label: "Pulso" },
  { id: "joelho", label: "Joelho" },
  { id: "lombar", label: "Lombar" },
  { id: "anca", label: "Anca" },
  { id: "tornozelo", label: "Tornozelo" },
  { id: "pescoco", label: "Pescoço" },
];

export const FOCUS_MUSCLES: { id: FocusMuscle; label: string }[] = [
  { id: "gluteo", label: "Glúteo" },
  { id: "peito", label: "Peitoral" },
  { id: "costas", label: "Costas" },
  { id: "ombros", label: "Ombros" },
  { id: "bracos", label: "Braços" },
  { id: "core", label: "Core" },
];

export const SCIENCE: Record<Goal, string> = {
  hipertrofia:
    "Hipertrofia responde a volume por grupo muscular com esforço próximo da falha: 6–12 reps a 65–80% 1RM, RPE 7–8. O split divide a semana para dar volume e recuperação a cada músculo, treinando-o pelo menos 2×/semana.",
  powerlifting:
    "Força máxima é adaptação neural: cargas altas (85–92% 1RM), poucas reps, descanso longo. A semana roda os três levantamentos com dias pesados e dias de volume.",
  hyrox:
    "Hyrox exige correr sob fadiga: a semana combina força específica, intervalos, base aeróbia e simulações que treinam a transição corrida↔estação.",
  corrida:
    "Modelo polarizado ~80/20: a maioria do volume é fácil (Z2) para construir base aeróbia, com dias duros (intervalos, tempo) para elevar VO₂max e limiar.",
  calistenia:
    "Sem carga externa, a sobrecarga faz-se por alavancas, amplitude, reps e tempo sob tensão. O split Push/Pull/Legs/Skill dá foco e recuperação a cada padrão.",
  hibrido:
    "No treino concorrente, força e resistência competem. A solução é separar qualidades em dias distintos, mantendo reps moderadas na força para não acumular fadiga.",
};

// Mobilidade / reabilitação por zona lesionada (feita no aquecimento)
const REHAB: Record<Injury, Movimento[]> = {
  ombro: [
    { name: "Rotação externa com banda", dose: "2×15/lado" },
    { name: "Face pull leve", dose: "2×15" },
  ],
  joelho: [
    { name: "Extensão terminal c/ banda", dose: "2×15" },
    { name: "Elevação de perna estendida", dose: "2×12/lado" },
  ],
  lombar: [
    { name: "Bird-dog", dose: "2×10/lado" },
    { name: "Dead bug", dose: "2×10" },
  ],
  anca: [
    { name: "Clamshell c/ banda", dose: "2×15/lado" },
    { name: "Ponte de glúteo", dose: "2×12" },
  ],
  cotovelo: [
    { name: "Flexão/extensão de punho leve", dose: "2×15" },
    { name: "Supinação com halter", dose: "2×12/lado" },
  ],
  tornozelo: [
    { name: "Dorsiflexão c/ banda", dose: "2×15/lado" },
    { name: "Elevação de gémeos controlada", dose: "2×15" },
  ],
  pescoco: [
    { name: "Retração cervical (chin tuck)", dose: "2×10" },
    { name: "Mobilidade suave de pescoço", dose: "2×8/lado" },
  ],
  pulso: [
    { name: "Mobilidade de punho em apoio", dose: "2×10" },
    { name: "Alongamento de flexores do punho", dose: "2×20s" },
  ],
};

// Trabalho de foco extra (hipertrofia) por grupo pedido no onboarding
const FOCUS_WORK: Record<
  FocusMuscle,
  { label: string; ex: Record<string, string>; reps: number; day: string }
> = {
  gluteo: {
    label: "Glúteo",
    ex: {
      ginasio: "Hip thrust c/ pausa",
      casa: "Elevação de anca a 1 perna",
      parque: "Elevação de anca a 1 perna",
    },
    reps: 12,
    day: "pernas",
  },
  peito: {
    label: "Peitoral",
    ex: {
      ginasio: "Aberturas / cross-over",
      casa: "Flexões com pausa",
      parque: "Fundos com inclinação",
    },
    reps: 12,
    day: "peito",
  },
  costas: {
    label: "Costas",
    ex: {
      ginasio: "Puxada na barra",
      casa: "Remada com elástico",
      parque: "Remada invertida",
    },
    reps: 10,
    day: "costas",
  },
  ombros: {
    label: "Ombros",
    ex: {
      ginasio: "Elevações laterais",
      casa: "Pike push-ups",
      parque: "Pike push-ups",
    },
    reps: 12,
    day: "ombros",
  },
  bracos: {
    label: "Braços",
    ex: {
      ginasio: "Rosca + tríceps corda",
      casa: "Rosca halteres + fundos banco",
      parque: "Elevações supinadas + fundos",
    },
    reps: 10,
    day: "bracos",
  },
  core: {
    label: "Core",
    ex: {
      ginasio: "Prancha com carga",
      casa: "Dead bug + prancha",
      parque: "Elevações de pernas na barra",
    },
    reps: 10,
    day: "core",
  },
};

const WARMUPS: Record<string, Movimento[]> = {
  strength_lower: [
    { name: "Bicicleta / passadeira fácil", dose: "3 min" },
    { name: "Mobilidade de anca (90/90)", dose: "1 min/lado" },
    { name: "Séries de aproximação", dose: "2–3 leves" },
  ],
  strength_upper: [
    { name: "Remo / corda fácil", dose: "3 min" },
    { name: "Rotações de ombro c/ banda", dose: "15 reps" },
    { name: "Band pull-apart", dose: "20 reps" },
    { name: "Séries de aproximação", dose: "2–3 leves" },
  ],
  power: [
    { name: "Cardio leve", dose: "3 min" },
    { name: "Mobilidade articular", dose: "2 min" },
    { name: "Rampas até carga alvo", dose: "4–5 séries" },
  ],
  run_easy: [
    { name: "Caminhada rápida", dose: "3 min" },
    { name: "Mobilidade dinâmica", dose: "2 min" },
    { name: "Progressão até Z2", dose: "5 min" },
  ],
  run_hard: [
    { name: "Corrida fácil progressiva", dose: "10 min" },
    { name: "Drills (skipping)", dose: "2×20 m" },
    { name: "Acelerações", dose: "4×80 m" },
  ],
  hyrox: [
    { name: "Row / bike fácil", dose: "5 min" },
    { name: "Mobilidade full-body", dose: "3 min" },
    { name: "Ativação leve", dose: "2×10" },
  ],
  calisthenics: [
    { name: "Cardio leve", dose: "3 min" },
    { name: "Mobilidade ombro/punho", dose: "2 min" },
    { name: "Progressões do skill", dose: "2 séries" },
  ],
};

const COOLDOWNS: Record<string, Movimento[]> = {
  lower: [
    { name: "Along. quadríceps", dose: "30s/lado" },
    { name: "Along. isquiotibiais", dose: "30s/lado" },
    { name: "Along. flexores da anca", dose: "30s/lado" },
  ],
  upper: [
    { name: "Along. peito na porta", dose: "30s" },
    { name: "Along. tríceps", dose: "30s/lado" },
    { name: "Along. dorsais", dose: "30s/lado" },
  ],
  run: [
    { name: "Retorno à calma a andar", dose: "3 min" },
    { name: "Along. gémeos", dose: "30s/lado" },
    { name: "Along. isquiotibiais", dose: "30s/lado" },
  ],
  hyrox: [
    { name: "Row muito leve", dose: "3 min" },
    { name: "Along. full-body", dose: "3 min" },
  ],
  full: [
    { name: "Along. full-body suave", dose: "3–4 min" },
    { name: "Respiração diafragmática", dose: "1 min" },
  ],
};

// ---------------------------------------------------------------------------
// Cargas: recordes reais (personal_records) ou estimativa por nível/sexo
// ---------------------------------------------------------------------------

const PR_ALIASES: Record<Lift, string[]> = {
  agachamento: ["agachamento", "agacho", "squat", "back squat"],
  terra: [
    "terra",
    "levantamento terra",
    "peso morto",
    "deadlift",
    "conventional deadlift",
  ],
  supino: ["supino", "supino reto", "bench", "bench press", "peito barra"],
  press: [
    "press militar",
    "press",
    "militar",
    "desenvolvimento militar",
    "overhead press",
    "ohp",
    "shoulder press",
  ],
};

/** Reduz linhas de personal_records ({ lift, value_kg }) aos 4 levantamentos base. */
export function maxesFromPRs(
  prs: { lift: string; value_kg: number | null }[] | null | undefined,
): Partial<Record<Lift, number>> {
  const out: Partial<Record<Lift, number>> = {};
  if (!prs) return out;
  for (const pr of prs) {
    const v = Number(pr.value_kg);
    if (!pr.lift || !isFinite(v) || v <= 0) continue;
    const name = pr.lift.trim().toLowerCase();
    for (const lift of Object.keys(PR_ALIASES) as Lift[]) {
      if (PR_ALIASES[lift].some((a) => name === a || name.includes(a))) {
        if (!out[lift] || v > (out[lift] as number)) out[lift] = v;
        break;
      }
    }
  }
  return out;
}

/** 1RM estimado por nível/sexo (sem usar recordes). */
export function estimateMaxes(profile: Pick<MotorProfile, "sex" | "level">): Record<Lift, number> {
  const mult = SEX_MULT[profile.sex] || SEX_MULT.homem;
  const base = E1RM[profile.level] || E1RM.intermedio;
  return {
    agachamento: base.agachamento * mult.agachamento,
    terra: base.terra * mult.terra,
    supino: base.supino * mult.supino,
    press: base.press * mult.press,
  };
}

/**
 * Devolve os 1RM a usar: recorde real quando existe, senão estimativa.
 * `usedReal` diz quais vieram de recordes reais.
 */
export function baseLifts(
  profile: Pick<MotorProfile, "sex" | "level">,
  maxes?: Partial<Record<Lift, number>> | null,
): { lvl: Record<Lift, number>; usedReal: Lift[] } {
  const est = estimateMaxes(profile);
  const lvl = { ...est };
  const usedReal: Lift[] = [];
  for (const k of Object.keys(est) as Lift[]) {
    const real = maxes ? maxes[k] : undefined;
    if (real && isFinite(real) && real > 0) {
      lvl[k] = real;
      usedReal.push(k);
    }
  }
  return { lvl, usedReal };
}

// ---------------------------------------------------------------------------
// Substituição de exercícios por lesão
// ---------------------------------------------------------------------------

/** Nota de coaching quando o levantamento principal cruza com uma lesão. */
export function swapNote(group: Lift, injuries: Injury[]): string | null {
  const has = (i: Injury) => injuries.includes(i);
  if (group === "agachamento" && has("joelho")) return "Protege o joelho";
  if (group === "terra" && has("lombar")) return "Sem carga axial na lombar";
  if (group === "supino" && has("ombro")) return "Pega neutra (poupa ombro)";
  if (group === "press" && has("ombro")) return "Amplitude parcial, sem dor";
  return null;
}

/** Exercício alternativo (mesmo grupo muscular) quando a lesão o exige. */
const SWAP_EXERCISE: Partial<Record<Lift, Partial<Record<Injury, string>>>> = {
  agachamento: { joelho: "Prensa de pernas (amplitude controlada)" },
  terra: { lombar: "Peso morto romeno c/ halteres (curto)" },
  supino: { ombro: "Supino c/ halteres (pega neutra)" },
  press: { ombro: "Desenvolvimento na máquina (amplitude parcial)" },
};

// ---------------------------------------------------------------------------
// Classificação muscular (para análise de frequência e testes)
// ---------------------------------------------------------------------------

const LIBRARY: { name: string; muscle: string; bw?: boolean; avoid: Injury[] }[] =
  [
    { name: "Agachamento com barra", muscle: "Pernas", avoid: ["joelho"] },
    { name: "Leg press", muscle: "Pernas", avoid: [] },
    { name: "Levantamento terra", muscle: "Posterior", avoid: ["lombar"] },
    { name: "Hip thrust", muscle: "Glúteo", avoid: [] },
    { name: "Supino com barra", muscle: "Peito", avoid: ["ombro"] },
    { name: "Supino neutro c/ halteres", muscle: "Peito", avoid: [] },
    { name: "Press militar", muscle: "Ombros", avoid: ["ombro"] },
    { name: "Elevações laterais", muscle: "Ombros", avoid: [] },
    { name: "Remada curvada", muscle: "Costas", avoid: ["lombar"] },
    { name: "Puxada na barra", muscle: "Costas", avoid: [] },
    { name: "Rosca direta", muscle: "Braços", avoid: ["cotovelo"] },
    { name: "Tríceps na corda", muscle: "Braços", avoid: ["cotovelo"] },
    { name: "Elevações (pull-ups)", muscle: "Costas", bw: true, avoid: [] },
    { name: "Flexões", muscle: "Peito", bw: true, avoid: ["ombro"] },
    { name: "Prancha", muscle: "Core", bw: true, avoid: [] },
  ];

/**
 * Adivinha o grupo muscular de um exercício pelo nome (regex sobre PT).
 * A ordem importa: braços e ombros são testados primeiro para não serem
 * "roubados" por termos como "fundos" (tríceps) ou "elevações" (dorsais).
 */
export function guessMuscle(name: string): string | null {
  const lib = LIBRARY.find((l) => l.name === name);
  if (lib) return lib.muscle;
  const n = name.toLowerCase();
  if (/tríceps|triceps|rosca|bíceps|biceps/.test(n)) return "Braços";
  if (
    /desenvolvimento|militar|arnold|elevações laterais|elevações posteriores|elevação lateral|pike push|crucifixo|encolhimento|deltoi|elevações de ombro/.test(
      n,
    )
  )
    return "Ombros";
  if (
    /agachamento|prensa|leg press|extensão de perna|extensora|búlgaro|bulgaro|frontal|afundo|lunge|pistol|gémeos|gemeos|panturr|à caixa|pernas/.test(
      n,
    )
  )
    return "Pernas";
  if (
    /terra|romeno|\brdl\b|flexora|isquiot|hip thrust|glúteo|gluteo|ponte de glúteo|elevação de anca|swing/.test(
      n,
    )
  )
    return "Posterior";
  if (
    /puxada|remada|pulldown|pullover|dorsais|pull-?up|chin-?up|elevações supinadas|invertida|face pull|encolhimento/.test(
      n,
    )
  )
    return "Costas";
  if (/supino|flexõe|flexoes|aberturas|cross-over|cross over|peck|fundos|peitoral/.test(n))
    return "Peito";
  if (/prancha|core|abdomin|dead bug|l-sit|anti-extens|elevações de pernas/.test(n))
    return "Core";
  return null;
}

/**
 * Grupos musculares grandes que a hipertrofia (split de frequência) tem de
 * treinar ≥2×/semana. É a lista validada no protótipo (`analyzeCustomPlan`).
 * Nota: no plano full-body de 3 dias não há trabalho isolado de ombros — os
 * deltoides recebem estímulo indireto do trabalho de empurrar.
 */
export const MAJOR_MUSCLES = ["Peito", "Costas", "Pernas"] as const;

// ---------------------------------------------------------------------------
// SPLITS — para cada objetivo e nº de dias, os 7 dias da semana.
// Cada dia: { label, type, cdType, focusDay?, kind?, build(ctx) } ou REST.
// ---------------------------------------------------------------------------

interface Ctx {
  profile: MotorProfile;
  lvl: Record<Lift, number>;
  loadMod: number;
  setCut: number;
  eq: Location;
  repAdd: number;
  cns: number; // "sistema nervoso" 0–100; 100 = fresco (parte 1 usa sempre 100)
}

interface DiaSplit {
  label: string;
  rest?: boolean;
  type?: string;
  cdType?: string;
  focusDay?: string;
  kind?: string;
  build?: (c: Ctx) => ExercicioInterno[];
}

interface ExercicioInterno {
  name: string;
  swap: string | null;
  sets: SerieGerada[];
  rest: string;
  bw?: boolean;
  substituted?: boolean;
  caution?: boolean;
  detail?: string;
  focusTag?: string;
}

const REST: DiaSplit = { label: "Descanso", rest: true };

function setArr(n: number, w: number | null, reps: number, rpe: string): SerieGerada[] {
  return Array.from({ length: Math.max(1, n) }, () => ({ w, reps, rpe }));
}
function ex(
  name: string,
  note: string | null,
  sets: SerieGerada[],
  rest: string,
  extra: Partial<ExercicioInterno> = {},
): ExercicioInterno {
  return { name, swap: note, sets, rest, ...extra };
}

// ---- Hipertrofia: split muscular ----
function hypDay(
  title: string,
  mainKey: Lift,
  exercises: (c: Ctx) => ExercicioInterno[],
  focusDay?: string,
): DiaSplit {
  const lower = mainKey === "agachamento" || mainKey === "terra";
  return {
    label: title,
    type: lower ? "strength_lower" : "strength_upper",
    cdType: lower ? "lower" : "upper",
    focusDay,
    build: exercises,
  };
}

interface HypItem {
  name: string;
  lift?: Lift;
  pct?: number;
  sets: number;
  reps: number;
  rpe?: string;
  rest?: string;
  bwName?: string;
}

function hypExercises(list: HypItem[]): (c: Ctx) => ExercicioInterno[] {
  return (c) =>
    list.map((it) => {
      const injuries = c.profile.injuries || [];
      let name = it.name;
      let substituted = false;
      const note = it.lift ? swapNote(it.lift, injuries) : null;
      if (it.lift && it.pct) {
        for (const inj of injuries) {
          const alt = SWAP_EXERCISE[it.lift]?.[inj];
          if (alt) {
            name = alt;
            substituted = true;
            break;
          }
        }
      }
      const w = it.pct ? round25(c.lvl[it.lift as Lift] * it.pct * c.loadMod) : null;
      const reps = it.reps > 0 ? it.reps + (c.repAdd || 0) : it.reps;
      const bwSwap = c.eq === "parque" && it.bwName;
      return ex(
        bwSwap ? (it.bwName as string) : name,
        note,
        setArr(Math.max(2, it.sets - c.setCut), bwSwap ? null : w, reps, it.rpe || "7–8"),
        it.rest || "90 s",
        { bw: bwSwap ? true : undefined, substituted: substituted || undefined },
      );
    });
}

const HYP_SPLITS: Record<number, DiaSplit[]> = {
  // 3 dias — Full-body A/B/C: cada músculo treinado 3×/semana
  3: [
    hypDay(
      "Full-body A (ênfase empurrar)",
      "supino",
      hypExercises([
        { name: "Supino com barra", lift: "supino", pct: 0.72, sets: 4, reps: 8 },
        { name: "Agachamento com barra", lift: "agachamento", pct: 0.7, sets: 3, reps: 8 },
        { name: "Remada curvada", lift: "terra", pct: 0.4, sets: 3, reps: 10 },
        { name: "Cadeira flexora (isquiotibiais)", lift: "agachamento", pct: 0.25, sets: 3, reps: 12, rest: "60 s" },
        { name: "Rosca + tríceps (superset)", sets: 3, reps: 12, rest: "60 s" },
      ]),
      "peito",
    ),
    hypDay(
      "Full-body B (ênfase puxar)",
      "terra",
      hypExercises([
        { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 8 },
        { name: "Puxada na barra (pulldown)", sets: 4, reps: 10 },
        { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 3, reps: 10 },
        { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12, rest: "75 s" },
        { name: "Rosca direta", sets: 3, reps: 12, rest: "60 s" },
      ]),
      "costas",
    ),
    REST,
    hypDay(
      "Full-body C (ênfase pernas)",
      "agachamento",
      hypExercises([
        { name: "Agachamento com barra", lift: "agachamento", pct: 0.75, sets: 4, reps: 8 },
        { name: "Supino com barra", lift: "supino", pct: 0.6, sets: 3, reps: 10 },
        { name: "Remada na máquina", sets: 3, reps: 12 },
        { name: "Peso morto romeno", lift: "terra", pct: 0.45, sets: 3, reps: 10 },
        { name: "Rosca martelo + tríceps testa", sets: 3, reps: 12, rest: "60 s" },
      ]),
      "pernas",
    ),
    REST,
    REST,
    REST,
  ],
  // 4 dias — Upper/Lower ×2: cada músculo 2×/semana
  4: [
    hypDay(
      "Superior A",
      "supino",
      hypExercises([
        { name: "Supino com barra", lift: "supino", pct: 0.72, sets: 4, reps: 8 },
        { name: "Remada curvada", lift: "terra", pct: 0.42, sets: 4, reps: 8 },
        { name: "Desenvolvimento militar", lift: "press", pct: 0.65, sets: 3, reps: 10 },
        { name: "Puxada na barra", sets: 3, reps: 10 },
        { name: "Rosca direta", sets: 3, reps: 12, rest: "60 s" },
        { name: "Tríceps na corda", sets: 3, reps: 12, rest: "60 s" },
      ]),
      "peito",
    ),
    hypDay(
      "Inferior A",
      "agachamento",
      hypExercises([
        { name: "Agachamento com barra", lift: "agachamento", pct: 0.75, sets: 4, reps: 6 },
        { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 8 },
        { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12 },
        { name: "Extensão de perna", lift: "agachamento", pct: 0.3, sets: 3, reps: 15, rest: "60 s" },
        { name: "Gémeos em pé", sets: 4, reps: 15, rest: "45 s" },
      ]),
      "pernas",
    ),
    REST,
    hypDay(
      "Superior B",
      "supino",
      hypExercises([
        { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.55, sets: 4, reps: 10 },
        { name: "Remada na máquina", sets: 4, reps: 10 },
        { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
        { name: "Cross-over de cabos", sets: 3, reps: 15, rest: "60 s" },
        { name: "Rosca martelo", sets: 3, reps: 12, rest: "60 s" },
        { name: "Tríceps testa", sets: 3, reps: 12, rest: "60 s" },
      ]),
      "peito",
    ),
    hypDay(
      "Inferior B",
      "terra",
      hypExercises([
        { name: "Levantamento terra", lift: "terra", pct: 0.7, sets: 4, reps: 6 },
        { name: "Agachamento frontal", lift: "agachamento", pct: 0.55, sets: 3, reps: 10 },
        { name: "Cadeira flexora (isquiotibiais)", lift: "agachamento", pct: 0.25, sets: 4, reps: 12, rest: "60 s" },
        { name: "Hip thrust", sets: 3, reps: 12, rest: "75 s" },
        { name: "Gémeos sentado", sets: 4, reps: 15, rest: "45 s" },
      ]),
      "pernas",
    ),
    REST,
    REST,
  ],
  // 5 dias — Superior/Inferior/Push/Pull/Legs: cada músculo ~2×/semana
  5: [
    hypDay(
      "Superior (força)",
      "supino",
      hypExercises([
        { name: "Supino com barra", lift: "supino", pct: 0.78, sets: 4, reps: 6 },
        { name: "Remada curvada", lift: "terra", pct: 0.45, sets: 4, reps: 6 },
        { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 3, reps: 8 },
        { name: "Puxada na barra", sets: 3, reps: 8 },
        { name: "Rosca direta", sets: 3, reps: 10, rest: "60 s" },
        { name: "Tríceps na barra", sets: 3, reps: 10, rest: "60 s" },
      ]),
      "peito",
    ),
    hypDay(
      "Inferior (força)",
      "agachamento",
      hypExercises([
        { name: "Agachamento com barra", lift: "agachamento", pct: 0.78, sets: 5, reps: 5 },
        { name: "Peso morto romeno", lift: "terra", pct: 0.6, sets: 4, reps: 8 },
        { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 10 },
        { name: "Gémeos em pé", sets: 4, reps: 12, rest: "45 s" },
      ]),
      "pernas",
    ),
    hypDay(
      "Empurrar (volume)",
      "supino",
      hypExercises([
        { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 12 },
        { name: "Desenvolvimento de ombros", lift: "press", pct: 0.5, sets: 3, reps: 12 },
        { name: "Aberturas / cross-over", sets: 3, reps: 15, rest: "60 s" },
        { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
        { name: "Tríceps na corda", sets: 4, reps: 15, rest: "60 s" },
      ]),
      "peito",
    ),
    hypDay(
      "Puxar (volume)",
      "terra",
      hypExercises([
        { name: "Puxada na barra (pulldown)", sets: 4, reps: 12 },
        { name: "Remada unilateral c/ halter", sets: 4, reps: 12 },
        { name: "Remada na máquina (pega estreita)", sets: 3, reps: 15 },
        { name: "Crucifixo invertido (posteriores)", sets: 3, reps: 15, rest: "60 s" },
        { name: "Rosca direta + martelo", sets: 4, reps: 12, rest: "60 s" },
      ]),
      "costas",
    ),
    hypDay(
      "Pernas (volume)",
      "agachamento",
      hypExercises([
        { name: "Agachamento búlgaro", lift: "agachamento", pct: 0.35, sets: 4, reps: 12 },
        { name: "Cadeira extensora", lift: "agachamento", pct: 0.3, sets: 4, reps: 15, rest: "60 s" },
        { name: "Cadeira flexora", lift: "agachamento", pct: 0.25, sets: 4, reps: 15, rest: "60 s" },
        { name: "Hip thrust", sets: 4, reps: 12, rest: "75 s" },
        { name: "Gémeos sentado", sets: 4, reps: 20, rest: "45 s" },
      ]),
      "pernas",
    ),
    REST,
    REST,
  ],
  // 6 dias — Push/Pull/Legs ×2: cada músculo 2×/semana
  6: [
    hypDay(
      "Empurrar A (força)",
      "supino",
      hypExercises([
        { name: "Supino com barra", lift: "supino", pct: 0.78, sets: 4, reps: 6 },
        { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 4, reps: 8 },
        { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 3, reps: 10 },
        { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
        { name: "Tríceps na barra", sets: 4, reps: 10, rest: "60 s" },
      ]),
      "peito",
    ),
    hypDay(
      "Puxar A (força)",
      "terra",
      hypExercises([
        { name: "Levantamento terra", lift: "terra", pct: 0.72, sets: 4, reps: 6 },
        { name: "Puxada na barra", sets: 4, reps: 8 },
        { name: "Remada curvada", lift: "terra", pct: 0.45, sets: 4, reps: 8 },
        { name: "Crucifixo invertido", sets: 3, reps: 15, rest: "60 s" },
        { name: "Rosca direta com barra", sets: 4, reps: 10, rest: "60 s" },
      ]),
      "costas",
    ),
    hypDay(
      "Pernas A (força)",
      "agachamento",
      hypExercises([
        { name: "Agachamento com barra", lift: "agachamento", pct: 0.78, sets: 5, reps: 5 },
        { name: "Peso morto romeno", lift: "terra", pct: 0.6, sets: 4, reps: 8 },
        { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 10 },
        { name: "Gémeos em pé", sets: 4, reps: 12, rest: "45 s" },
      ]),
      "pernas",
    ),
    hypDay(
      "Empurrar B (volume)",
      "supino",
      hypExercises([
        { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 12 },
        { name: "Desenvolvimento Arnold", lift: "press", pct: 0.42, sets: 3, reps: 12 },
        { name: "Aberturas na máquina (peck deck)", sets: 4, reps: 15, rest: "60 s" },
        { name: "Elevações laterais", sets: 4, reps: 20, rest: "45 s" },
        { name: "Tríceps na corda", sets: 4, reps: 15, rest: "60 s" },
      ]),
      "peito",
    ),
    hypDay(
      "Puxar B (volume)",
      "terra",
      hypExercises([
        { name: "Puxada na barra (pega neutra)", sets: 4, reps: 12 },
        { name: "Remada unilateral", sets: 4, reps: 12 },
        { name: "Pullover", sets: 3, reps: 15, rest: "60 s" },
        { name: "Crucifixo invertido", sets: 4, reps: 15, rest: "60 s" },
        { name: "Rosca martelo + concentrada", sets: 4, reps: 12, rest: "60 s" },
      ]),
      "costas",
    ),
    hypDay(
      "Pernas B (volume)",
      "agachamento",
      hypExercises([
        { name: "Agachamento frontal", lift: "agachamento", pct: 0.55, sets: 4, reps: 10 },
        { name: "Cadeira extensora", lift: "agachamento", pct: 0.3, sets: 4, reps: 15, rest: "60 s" },
        { name: "Cadeira flexora", lift: "agachamento", pct: 0.25, sets: 4, reps: 15, rest: "60 s" },
        { name: "Hip thrust", sets: 4, reps: 12, rest: "75 s" },
        { name: "Gémeos sentado", sets: 4, reps: 20, rest: "45 s" },
      ]),
      "pernas",
    ),
    REST,
  ],
};

// ---- Bro split alternativo (hipertrofia): 1 grupo/dia, frequência 1×/semana ----
const HYP_BRO: Record<number, DiaSplit[]> = {
  3: [
    hypDay(
      "Peito e Tríceps",
      "supino",
      hypExercises([
        { name: "Supino com barra", lift: "supino", pct: 0.72, sets: 4, reps: 8 },
        { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 10 },
        { name: "Aberturas / cross-over", sets: 3, reps: 15, rest: "60 s" },
        { name: "Tríceps testa", sets: 4, reps: 12, rest: "60 s" },
        { name: "Tríceps na corda", sets: 3, reps: 15, rest: "60 s" },
      ]),
      "peito",
    ),
    REST,
    hypDay(
      "Costas e Bíceps",
      "terra",
      hypExercises([
        { name: "Puxada na barra (pulldown)", sets: 4, reps: 10 },
        { name: "Remada curvada", lift: "terra", pct: 0.42, sets: 4, reps: 10 },
        { name: "Remada unilateral c/ halter", sets: 3, reps: 12 },
        { name: "Rosca direta", sets: 4, reps: 12, rest: "60 s" },
        { name: "Rosca martelo", sets: 3, reps: 12, rest: "60 s" },
      ]),
      "costas",
    ),
    REST,
    hypDay(
      "Pernas e Ombros",
      "agachamento",
      hypExercises([
        { name: "Agachamento com barra", lift: "agachamento", pct: 0.72, sets: 4, reps: 8 },
        { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 10 },
        { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12 },
        { name: "Desenvolvimento de ombros", lift: "press", pct: 0.6, sets: 4, reps: 10 },
        { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
      ]),
      "pernas",
    ),
    REST,
    REST,
    REST,
  ],
  4: [
    hypDay(
      "Peito",
      "supino",
      hypExercises([
        { name: "Supino com barra", lift: "supino", pct: 0.75, sets: 4, reps: 8 },
        { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 10 },
        { name: "Aberturas na máquina (peck deck)", sets: 3, reps: 12, rest: "60 s" },
        { name: "Cross-over de cabos", sets: 3, reps: 15, rest: "60 s" },
        { name: "Flexões até à falha", sets: 2, reps: 0, rest: "60 s" },
      ]),
      "peito",
    ),
    hypDay(
      "Costas",
      "terra",
      hypExercises([
        { name: "Levantamento terra", lift: "terra", pct: 0.7, sets: 4, reps: 6 },
        { name: "Puxada na barra", sets: 4, reps: 10 },
        { name: "Remada curvada", lift: "terra", pct: 0.42, sets: 4, reps: 10 },
        { name: "Remada unilateral", sets: 3, reps: 12 },
        { name: "Pullover", sets: 3, reps: 15, rest: "60 s" },
      ]),
      "costas",
    ),
    REST,
    hypDay(
      "Ombros e Braços",
      "press",
      hypExercises([
        { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 4, reps: 8 },
        { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
        { name: "Crucifixo invertido (posteriores)", sets: 3, reps: 15, rest: "60 s" },
        { name: "Rosca direta + tríceps (superset)", sets: 4, reps: 12, rest: "60 s" },
        { name: "Rosca martelo + tríceps corda", sets: 3, reps: 12, rest: "60 s" },
      ]),
      "ombros",
    ),
    hypDay(
      "Pernas",
      "agachamento",
      hypExercises([
        { name: "Agachamento com barra", lift: "agachamento", pct: 0.75, sets: 5, reps: 8 },
        { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 10 },
        { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12 },
        { name: "Cadeira extensora + flexora", lift: "agachamento", pct: 0.3, sets: 3, reps: 15, rest: "60 s" },
        { name: "Gémeos", sets: 4, reps: 15, rest: "45 s" },
      ]),
      "pernas",
    ),
    REST,
    REST,
  ],
  5: [
    hypDay(
      "Peito",
      "supino",
      hypExercises([
        { name: "Supino com barra", lift: "supino", pct: 0.75, sets: 4, reps: 8 },
        { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 10 },
        { name: "Aberturas na máquina (peck deck)", sets: 3, reps: 12, rest: "60 s" },
        { name: "Cross-over de cabos", sets: 3, reps: 15, rest: "60 s" },
        { name: "Flexões até à falha", sets: 2, reps: 0, rest: "60 s" },
      ]),
      "peito",
    ),
    hypDay(
      "Costas",
      "terra",
      hypExercises([
        { name: "Levantamento terra", lift: "terra", pct: 0.72, sets: 4, reps: 6 },
        { name: "Puxada na barra", sets: 4, reps: 10 },
        { name: "Remada curvada", lift: "terra", pct: 0.42, sets: 4, reps: 10 },
        { name: "Remada unilateral", sets: 3, reps: 12 },
        { name: "Pullover", sets: 3, reps: 15, rest: "60 s" },
      ]),
      "costas",
    ),
    hypDay(
      "Pernas",
      "agachamento",
      hypExercises([
        { name: "Agachamento com barra", lift: "agachamento", pct: 0.75, sets: 5, reps: 8 },
        { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 10 },
        { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12 },
        { name: "Cadeira extensora + flexora", lift: "agachamento", pct: 0.3, sets: 3, reps: 15, rest: "60 s" },
        { name: "Gémeos", sets: 4, reps: 15, rest: "45 s" },
      ]),
      "pernas",
    ),
    hypDay(
      "Ombros",
      "press",
      hypExercises([
        { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 4, reps: 8 },
        { name: "Desenvolvimento Arnold", lift: "press", pct: 0.45, sets: 3, reps: 12 },
        { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
        { name: "Elevações posteriores", sets: 4, reps: 15, rest: "60 s" },
        { name: "Encolhimentos", sets: 3, reps: 15, rest: "60 s" },
      ]),
      "ombros",
    ),
    hypDay(
      "Braços e Core",
      "supino",
      hypExercises([
        { name: "Rosca direta com barra", sets: 4, reps: 10, rest: "60 s" },
        { name: "Tríceps na barra (fundos ou testa)", sets: 4, reps: 10, rest: "60 s" },
        { name: "Rosca martelo", sets: 3, reps: 12, rest: "60 s" },
        { name: "Tríceps na corda", sets: 3, reps: 15, rest: "60 s" },
        { name: "Prancha + rotação (core)", sets: 3, reps: 0, rest: "45 s" },
      ]),
      "bracos",
    ),
    REST,
    REST,
  ],
};
HYP_BRO[6] = [
  HYP_BRO[5][0],
  HYP_BRO[5][1],
  HYP_BRO[5][2],
  HYP_BRO[5][3],
  HYP_BRO[5][4],
  hypDay(
    "Ponto fraco / Core",
    "agachamento",
    hypExercises([
      { name: "Hip thrust", sets: 4, reps: 12 },
      { name: "Afundos com halteres", sets: 3, reps: 12 },
      { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
      { name: "Abdominais com carga", sets: 4, reps: 15, rest: "45 s" },
      { name: "Prancha lateral", sets: 3, reps: 0, rest: "45 s" },
    ]),
    "core",
  ),
  REST,
];

// ---- Powerlifting ----
function plDay(title: string, exercises: (c: Ctx) => ExercicioInterno[]): DiaSplit {
  return { label: title, type: "power", cdType: "lower", build: exercises };
}
interface PlItem {
  name: string;
  lift?: Lift;
  pct?: number;
  sets: number;
  reps: number;
  heavy?: boolean;
  rest?: string;
}
function plExercises(list: PlItem[]): (c: Ctx) => ExercicioInterno[] {
  return (c) =>
    list.map((it) => {
      const cnsCut = c.cns < 55;
      const pct = (cnsCut && it.heavy ? (it.pct as number) - 0.08 : it.pct) as number | undefined;
      const reps = cnsCut && it.heavy ? it.reps + 1 : it.reps;
      const injuries = c.profile.injuries || [];
      let name = it.name;
      let substituted = false;
      if (it.lift && it.pct) {
        for (const inj of injuries) {
          const alt = SWAP_EXERCISE[it.lift]?.[inj];
          if (alt) {
            name = alt;
            substituted = true;
            break;
          }
        }
      }
      const w =
        it.lift && pct != null
          ? round25(c.lvl[it.lift] * pct * c.loadMod)
          : null;
      return ex(
        name,
        it.lift ? swapNote(it.lift, injuries) : null,
        setArr(it.sets, w, reps, it.heavy ? (cnsCut ? "7" : "8–9") : "8"),
        it.rest || "3 min",
        { substituted: substituted || undefined },
      );
    });
}
const PL_SPLITS: Record<number, DiaSplit[]> = {
  3: [
    plDay(
      "Agachamento (pesado)",
      plExercises([
        { name: "Agachamento", lift: "agachamento", pct: 0.88, sets: 5, reps: 3, heavy: true, rest: "4 min" },
        { name: "Agachamento frontal (acessório)", lift: "agachamento", pct: 0.6, sets: 3, reps: 6 },
        { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 8, rest: "2 min" },
        { name: "Core anti-extensão", sets: 3, reps: 0, rest: "60 s" },
      ]),
    ),
    plDay(
      "Supino (pesado)",
      plExercises([
        { name: "Supino", lift: "supino", pct: 0.88, sets: 5, reps: 3, heavy: true, rest: "4 min" },
        { name: "Supino fecho (acessório)", lift: "supino", pct: 0.65, sets: 3, reps: 6 },
        { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 3, reps: 6 },
        { name: "Tríceps pesado", sets: 3, reps: 10, rest: "90 s" },
      ]),
    ),
    plDay(
      "Levantamento terra (pesado)",
      plExercises([
        { name: "Levantamento terra", lift: "terra", pct: 0.85, sets: 4, reps: 3, heavy: true, rest: "5 min" },
        { name: "Terra deficit (acessório)", lift: "terra", pct: 0.6, sets: 3, reps: 5 },
        { name: "Remada curvada pesada", lift: "terra", pct: 0.5, sets: 4, reps: 6 },
        { name: "Costas altas / face pull", sets: 3, reps: 15, rest: "60 s" },
      ]),
    ),
    REST,
    REST,
    REST,
    REST,
  ],
};
PL_SPLITS[4] = [
  PL_SPLITS[3][0],
  PL_SPLITS[3][1],
  REST,
  plDay(
    "Terra pesado + Agach. volume",
    plExercises([
      { name: "Levantamento terra", lift: "terra", pct: 0.85, sets: 4, reps: 3, heavy: true, rest: "5 min" },
      { name: "Agachamento (volume)", lift: "agachamento", pct: 0.72, sets: 4, reps: 6, rest: "3 min" },
      { name: "Remada pesada", lift: "terra", pct: 0.5, sets: 4, reps: 8, rest: "2 min" },
    ]),
  ),
  plDay(
    "Supino volume + acessórios",
    plExercises([
      { name: "Supino (volume)", lift: "supino", pct: 0.72, sets: 5, reps: 6, rest: "3 min" },
      { name: "Desenvolvimento militar", lift: "press", pct: 0.68, sets: 4, reps: 8 },
      { name: "Tríceps + bíceps", sets: 3, reps: 12, rest: "60 s" },
    ]),
  ),
  REST,
  REST,
];
const PL_ACESS_SUP = plDay(
  "Acessórios de força (superior)",
  plExercises([
    { name: "Supino pausado", lift: "supino", pct: 0.6, sets: 4, reps: 5 },
    { name: "Remada", lift: "terra", pct: 0.45, sets: 4, reps: 8 },
    { name: "Ombros e braços", sets: 3, reps: 12, rest: "90 s" },
  ]),
);
const PL_ACESS_INF = plDay(
  "Acessórios de força (inferior)",
  plExercises([
    { name: "Agachamento frontal", lift: "agachamento", pct: 0.6, sets: 4, reps: 6 },
    { name: "Terra romeno", lift: "terra", pct: 0.6, sets: 4, reps: 8 },
    { name: "Core pesado", sets: 3, reps: 0, rest: "60 s" },
  ]),
);
// 5 dias — 3 pesados + 2 de acessórios, 2 de descanso
PL_SPLITS[5] = [
  PL_SPLITS[3][0], // Agachamento pesado
  PL_SPLITS[3][1], // Supino pesado
  REST,
  PL_SPLITS[3][2], // Levantamento terra pesado
  PL_ACESS_SUP,
  PL_ACESS_INF,
  REST,
];
// 6 dias — 3 pesados + acessórios superior/inferior + 1 de volume, 1 descanso
PL_SPLITS[6] = [
  PL_SPLITS[3][0],
  PL_SPLITS[3][1],
  PL_ACESS_SUP,
  PL_SPLITS[3][2],
  PL_ACESS_INF,
  PL_SPLITS[4][4], // Supino volume + acessórios
  REST,
];

// ---- Corrida (polarizada) ----
function runSession(kind: string): ExercicioInterno[] {
  if (kind === "hard")
    return [
      ex("6 × 1000 m a ritmo de 5 km", null, setArr(6, null, 0, "8–9"), "90 s trote", {
        detail: "Ritmo controlado e repetível",
      }),
      ex("Retorno à calma", null, setArr(1, null, 0, "3"), "", { detail: "10 min muito fácil" }),
    ];
  if (kind === "tempo")
    return [
      ex("20 min em ritmo de limiar (tempo)", null, setArr(1, null, 0, "7"), "", {
        detail: "Confortavelmente difícil, sustentável",
      }),
      ex("Retorno à calma", null, setArr(1, null, 0, "3"), "", { detail: "10 min fácil" }),
    ];
  if (kind === "long")
    return [
      ex("Corrida longa contínua", null, setArr(1, null, 0, "5"), "", {
        detail: "75–90 min em Zona 2, ritmo conversacional",
      }),
    ];
  return [
    ex("Rodagem fácil (Zona 2)", null, setArr(1, null, 0, "4–5"), "", {
      detail: "40–50 min, consegues falar frases inteiras",
    }),
  ];
}
function runDay(label: string, kind: string): DiaSplit {
  return {
    label,
    type: kind === "hard" ? "run_hard" : "run_easy",
    cdType: "run",
    kind,
    build: () => runSession(kind),
  };
}
const RUN_SPLITS: Record<number, DiaSplit[]> = {
  3: [runDay("Rodagem fácil Z2", "easy"), REST, runDay("Intervalos (VO₂max)", "hard"), REST, runDay("Corrida longa", "long"), REST, REST],
  4: [runDay("Rodagem fácil Z2", "easy"), runDay("Intervalos (VO₂max)", "hard"), REST, runDay("Rodagem fácil Z2", "easy"), runDay("Corrida longa", "long"), REST, REST],
  5: [runDay("Rodagem fácil Z2", "easy"), runDay("Intervalos (VO₂max)", "hard"), runDay("Rodagem fácil Z2", "easy"), runDay("Corrida tempo (limiar)", "tempo"), runDay("Corrida longa", "long"), REST, REST],
  6: [runDay("Rodagem fácil Z2", "easy"), runDay("Intervalos (VO₂max)", "hard"), runDay("Rodagem fácil Z2", "easy"), runDay("Corrida tempo (limiar)", "tempo"), runDay("Rodagem fácil Z2", "easy"), runDay("Corrida longa", "long"), REST],
};

// ---- Hyrox ----
function hyroxSession(c: Ctx, kind: string): ExercicioInterno[] {
  if (kind === "run")
    return [
      ex("Corrida contínua Zona 2", null, setArr(1, null, 0, "5"), "", { detail: "50–60 min base aeróbia" }),
    ];
  if (kind === "intervals")
    return [
      ex("8 × 400 m rápido", null, setArr(8, null, 0, "8–9"), "60 s", { detail: "Ritmo de prova ou mais rápido" }),
      ex("Retorno à calma", null, setArr(1, null, 0, "3"), "", { detail: "10 min fácil" }),
    ];
  if (kind === "strength") {
    const injuries = c.profile.injuries || [];
    return [
      ex(
        injuries.includes("joelho") ? "Prensa de pernas (amplitude controlada)" : "Agachamento",
        swapNote("agachamento", injuries),
        setArr(4, round25(c.lvl.agachamento * 0.78 * c.loadMod), 5, "8"),
        "2–3 min",
        { substituted: injuries.includes("joelho") || undefined },
      ),
      ex("Peso morto / RDL", swapNote("terra", injuries), setArr(3, round25(c.lvl.terra * 0.6 * c.loadMod), 8, "8"), "2 min"),
      ex("Lunges com carga", null, setArr(3, null, 20, "8"), "90 s", { detail: "Padrão específico de Hyrox" }),
    ];
  }
  // sim — o circuito híbrido
  return [
    ex("Corrida 1 km (ritmo alvo)", null, setArr(1, null, 0, "7–8"), "direto p/ estação", { detail: "Entrar na estação sem parar" }),
    ex("SkiErg / Row 500 m", null, setArr(1, null, 0, "8"), "60 s"),
    ex("Sled push + pull 25 m", null, setArr(2, null, 0, "8–9"), "60 s", { detail: "Carga de prova" }),
    ex("Burpee broad jumps", null, setArr(1, null, 15, "8"), "60 s"),
    ex("Farmers carry 40 m", null, setArr(2, null, 0, "8"), "60 s", { detail: "Sem pousar" }),
    ex("Wall balls", null, setArr(2, null, 20, "8–9"), "90 s"),
  ];
}
function hyroxDay(label: string, kind: string, cdType?: string): DiaSplit {
  return {
    label,
    type:
      kind === "sim"
        ? "hyrox"
        : kind === "strength"
          ? "strength_lower"
          : kind === "intervals"
            ? "run_hard"
            : "run_easy",
    cdType: cdType || (kind === "strength" ? "lower" : kind === "sim" ? "hyrox" : "run"),
    kind,
    build: (c) => hyroxSession(c, kind),
  };
}
const HYROX_SPLITS: Record<number, DiaSplit[]> = {
  3: [hyroxDay("Força específica", "strength"), REST, hyroxDay("Simulação de prova", "sim"), REST, hyroxDay("Corrida longa Z2", "run"), REST, REST],
  4: [hyroxDay("Força específica", "strength"), hyroxDay("Intervalos", "intervals"), hyroxDay("Simulação de prova", "sim"), REST, hyroxDay("Corrida longa Z2", "run"), REST, REST],
  5: [hyroxDay("Força específica", "strength"), hyroxDay("Intervalos", "intervals"), hyroxDay("Corrida base Z2", "run"), hyroxDay("Simulação de prova", "sim"), REST, hyroxDay("Corrida longa Z2", "run"), REST],
  6: [hyroxDay("Força específica", "strength"), hyroxDay("Intervalos", "intervals"), hyroxDay("Corrida base Z2", "run"), hyroxDay("Simulação de prova", "sim"), hyroxDay("Força + cond.", "strength"), hyroxDay("Corrida longa Z2", "run"), REST],
};

// ---- Calistenia ----
function caliSession(c: Ctx, kind: string): ExercicioInterno[] {
  const injuries = c.profile.injuries || [];
  const reps =
    c.profile.level === "iniciante" ? 6 : c.profile.level === "intermedio" ? 10 : 14;
  if (kind === "push")
    return [
      ex(
        injuries.includes("ombro") ? "Flexões inclinadas" : "Fundos nas paralelas",
        swapNote("supino", injuries),
        setArr(4, null, reps, "8"),
        "2 min",
        { substituted: injuries.includes("ombro") || undefined },
      ),
      ex("Flexões (variação difícil)", null, setArr(4, null, reps, "8"), "90 s"),
      ex("Pike push-ups (ombros)", null, setArr(3, null, Math.max(5, reps - 3), "8"), "90 s"),
      ex("Tríceps em banco", null, setArr(3, null, reps + 2, "8"), "60 s"),
    ];
  if (kind === "pull")
    return [
      ex(
        c.profile.level === "iniciante" ? "Negativas de elevação" : "Elevações (pull-ups)",
        null,
        setArr(4, null, reps, "8"),
        "2 min",
        { detail: "Progressão por reps e amplitude" },
      ),
      ex("Remada invertida na barra", null, setArr(4, null, reps + 2, "8"), "90 s"),
      ex("Elevações supinadas (chin-ups)", null, setArr(3, null, Math.max(4, reps - 2), "8"), "90 s"),
      ex("Rosca com toalha / anéis", null, setArr(3, null, reps, "8"), "60 s"),
    ];
  if (kind === "legs")
    return [
      ex(
        injuries.includes("joelho") ? "Agachamento à caixa" : "Pistol squat progressivo",
        swapNote("agachamento", injuries),
        setArr(4, null, Math.max(4, reps - 4), "8"),
        "2 min",
        { substituted: injuries.includes("joelho") || undefined },
      ),
      ex("Afundos (lunges)", null, setArr(3, null, reps + 4, "8"), "90 s"),
      ex("Elevação de anca a 1 perna", null, setArr(3, null, reps + 2, "8"), "90 s"),
      ex("Gémeos a 1 perna", null, setArr(4, null, 15, "8"), "45 s"),
    ];
  // skill
  return [
    ex("Skill: hold (L-sit / prancha frontal)", null, setArr(4, null, 0, "8"), "2 min", { detail: "Tempo sob tensão — o skill do dia" }),
    ex("Progressão para pino (handstand)", null, setArr(4, null, 0, "8"), "90 s"),
    ex("Core: elevações de pernas na barra", null, setArr(3, null, reps, "8"), "90 s"),
    ex("Prancha lateral", null, setArr(3, null, 0, "7"), "45 s"),
  ];
}
function caliDay(label: string, kind: string): DiaSplit {
  return {
    label,
    type: "calisthenics",
    cdType: kind === "legs" ? "lower" : "upper",
    kind,
    build: (c) => caliSession(c, kind),
  };
}
const CALI_SPLITS: Record<number, DiaSplit[]> = {
  3: [caliDay("Empurrar (Push)", "push"), REST, caliDay("Puxar (Pull)", "pull"), REST, caliDay("Pernas e Core", "legs"), REST, REST],
  4: [caliDay("Empurrar (Push)", "push"), caliDay("Puxar (Pull)", "pull"), REST, caliDay("Pernas", "legs"), caliDay("Skill e Core", "skill"), REST, REST],
  5: [caliDay("Empurrar (Push)", "push"), caliDay("Puxar (Pull)", "pull"), caliDay("Pernas", "legs"), caliDay("Skill", "skill"), caliDay("Full-body", "push"), REST, REST],
  6: [caliDay("Empurrar (Push)", "push"), caliDay("Puxar (Pull)", "pull"), caliDay("Pernas", "legs"), caliDay("Empurrar (Push)", "push"), caliDay("Puxar (Pull)", "pull"), caliDay("Skill e Core", "skill"), REST],
};

// ---- Híbrido ----
function hybSession(c: Ctx, kind: string): ExercicioInterno[] {
  const injuries = c.profile.injuries || [];
  if (kind === "intervals")
    return [
      ex("6 × 800 m rápido", null, setArr(6, null, 0, "8–9"), "90 s", { detail: "Qualidade de corrida" }),
      ex("Retorno à calma", null, setArr(1, null, 0, "3"), "", { detail: "10 min" }),
    ];
  if (kind === "run")
    return [ex("Rodagem fácil Zona 2", null, setArr(1, null, 0, "5"), "", { detail: "40 min base aeróbia" })];
  if (kind === "long")
    return [ex("Corrida longa Z2", null, setArr(1, null, 0, "5"), "", { detail: "60–75 min" })];
  if (kind === "cond")
    return [
      ex("Circuito metabólico (kettlebell + burpees)", null, setArr(4, null, 0, "8"), "60 s", { detail: "Condicionamento" }),
      ex("Farmers carry", null, setArr(3, null, 0, "8"), "60 s", { detail: "40 m" }),
    ];
  if (kind === "strengthUp")
    return [
      ex("Supino com barra", swapNote("supino", injuries), setArr(4, round25(c.lvl.supino * 0.78 * c.loadMod), 5, "8"), "2–3 min"),
      ex("Remada curvada", swapNote("terra", injuries), setArr(4, round25(c.lvl.terra * 0.45 * c.loadMod), 6, "8"), "2 min"),
      ex("Desenvolvimento de ombros", null, setArr(3, round25(c.lvl.press * 0.65 * c.loadMod), 8, "8"), "2 min"),
    ];
  // strength (inferior)
  return [
    ex(
      injuries.includes("joelho") ? "Prensa de pernas (amplitude controlada)" : "Agachamento",
      swapNote("agachamento", injuries),
      setArr(Math.max(3, 4 - c.setCut), round25(c.lvl.agachamento * 0.78 * c.loadMod), 5, "8"),
      "2–3 min",
      { substituted: injuries.includes("joelho") || undefined },
    ),
    ex("Peso morto romeno", swapNote("terra", injuries), setArr(3, round25(c.lvl.terra * 0.6 * c.loadMod), 8, "8"), "2 min"),
    ex("Finisher: kettlebell swings", null, setArr(3, null, 15, "8"), "60 s"),
  ];
}
function hybDay(label: string, kind: string): DiaSplit {
  return {
    label,
    type: kind === "strength" ? "strength_lower" : kind === "intervals" ? "run_hard" : "run_easy",
    cdType: kind === "strength" ? "lower" : "run",
    kind,
    build: (c) => hybSession(c, kind),
  };
}
const hybForcaSup = (label: string): DiaSplit => ({
  ...hybDay(label, "strength"),
  build: (c) => hybSession(c, "strengthUp"),
});

const HYB_SPLITS: Record<number, DiaSplit[]> = {
  // 3 dias — 2 de força + 1 de corrida dura (condicionamento colado à força superior)
  3: [
    hybDay("Força inferior", "strength"),
    {
      ...hybDay("Força superior + condicionamento", "strength"),
      build: (c) => [...hybSession(c, "strengthUp"), ...hybSession(c, "cond")],
    },
    REST,
    hybDay("Corrida (intervalos)", "intervals"),
    REST,
    REST,
    REST,
  ],
  // 4 dias
  4: [
    hybDay("Força inferior", "strength"),
    hybDay("Corrida (intervalos)", "intervals"),
    REST,
    hybForcaSup("Força superior"),
    hybDay("Corrida longa", "long"),
    REST,
    REST,
  ],
  // 5 dias
  5: [
    hybDay("Força inferior", "strength"),
    hybDay("Corrida (intervalos)", "intervals"),
    hybForcaSup("Força superior"),
    REST,
    hybDay("Condicionamento", "cond"),
    hybDay("Corrida longa", "long"),
    REST,
  ],
  // 6 dias
  6: [
    hybDay("Força inferior", "strength"),
    hybDay("Corrida (intervalos)", "intervals"),
    hybForcaSup("Força superior"),
    hybDay("Rodagem Z2", "run"),
    hybDay("Condicionamento", "cond"),
    hybDay("Corrida longa", "long"),
    REST,
  ],
};

const SPLITS: Record<Goal, Record<number, DiaSplit[]>> = {
  hipertrofia: HYP_SPLITS,
  powerlifting: PL_SPLITS,
  corrida: RUN_SPLITS,
  hyrox: HYROX_SPLITS,
  calistenia: CALI_SPLITS,
  hibrido: HYB_SPLITS,
};

// ---------------------------------------------------------------------------
// Periodização até prova (inerte na parte 1 — sem data de prova recolhida)
// ---------------------------------------------------------------------------

function weeksUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (isNaN(diff) || diff < 0) return null;
  return Math.max(1, Math.ceil(diff / (7 * 24 * 3600 * 1000)));
}
function macroPhase(
  weeksOut: number | null,
): { idx: number; name: string; desc: string } | null {
  if (weeksOut == null) return null;
  if (weeksOut <= 1)
    return { idx: 2, name: "Taper", desc: "Reduzir volume, manter intensidade — chegar fresco à prova." };
  if (weeksOut <= 4)
    return { idx: 1, name: "Intensificação", desc: "Especificidade máxima: os movimentos da prova, ao ritmo da prova." };
  return { idx: 0, name: "Acumulação", desc: "Construir a base: volume e capacidade de trabalho." };
}

// ---------------------------------------------------------------------------
// Progressão semanal (sobrecarga progressiva) — parte 2
// ---------------------------------------------------------------------------

export interface Progression {
  week: number;
  loadBonus: number; // kg acumulados sobre a carga de referência
  repBonus: number; // reps extra por série (progressão dupla)
  streak: number; // semanas seguidas a progredir
  lastRpe: number | null; // RPE médio da semana anterior
  deloadWeek: boolean; // a semana atual é de descarga
  reason?: string; // porquê da última decisão
  history: { week: number; avgRpe: number; completion: number }[];
}

// Incremento de carga por objetivo e nível (kg/semana nos compostos)
const WEEKLY_STEP: Record<string, Record<Level, number>> = {
  powerlifting: { iniciante: 5, intermedio: 2.5, avancado: 2.5 },
  hipertrofia: { iniciante: 5, intermedio: 2.5, avancado: 2.5 },
  hibrido: { iniciante: 5, intermedio: 2.5, avancado: 2.5 },
};

export function initProgression(): Progression {
  return {
    week: 1,
    loadBonus: 0,
    repBonus: 0,
    streak: 0,
    lastRpe: null,
    deloadWeek: false,
    history: [],
  };
}

/**
 * Decide a semana seguinte a partir do desempenho da semana atual.
 * `avgRpe`: média do RPE reportado nas sessões da semana.
 * `completion`: 0–1, fração média de séries concluídas.
 */
export function advanceWeek(
  prog: Progression,
  profile: Pick<MotorProfile, "goal" | "level">,
  avgRpe: number,
  completion: number,
): Progression {
  const p: Progression = { ...prog, history: [...prog.history] };
  const step = (WEEKLY_STEP[profile.goal] || WEEKLY_STEP.hipertrofia)[profile.level] || 2.5;
  p.history.push({ week: p.week, avgRpe, completion });

  // Deload a cada 5 semanas OU após 2 semanas duras seguidas; nunca dois seguidos.
  const twoHardWeeks =
    !prog.deloadWeek && prog.lastRpe != null && avgRpe >= 9 && prog.lastRpe >= 9;
  const dueDeload = !prog.deloadWeek && (p.week % 5 === 0 || twoHardWeeks);

  if (dueDeload) {
    p.week += 1;
    p.deloadWeek = true;
    p.lastRpe = null;
    p.reason = twoHardWeeks
      ? "Duas semanas duras seguidas — semana de descarga para recuperares e voltares mais forte."
      : "Semana de descarga programada (a cada 5 semanas) — gestão de fadiga acumulada.";
    return p;
  }
  p.deloadWeek = false;

  if (completion < 0.8) {
    p.reason = "Não completaste todas as séries — mantenho a carga esta semana para consolidares.";
  } else if (avgRpe <= 7.5) {
    // Fácil — progressão dupla: primeiro reps, depois carga.
    if (p.repBonus < 2) {
      p.repBonus += 1;
      p.streak += 1;
      p.reason = "Semana passada esteve fácil (RPE baixo) — +1 rep por série (progressão dupla).";
    } else {
      p.repBonus = 0;
      p.loadBonus += step;
      p.streak += 1;
      p.reason = `Atingiste o topo das reps — subo a carga +${step} kg e recomeço o ciclo de reps.`;
    }
  } else if (avgRpe <= 8.5) {
    p.loadBonus += step;
    p.streak += 1;
    p.reason = `Na zona ideal de esforço — progressão de +${step} kg nos compostos.`;
  } else {
    p.streak = 0;
    p.reason = "Semana exigente (RPE alto) — mantenho a carga para a dominares antes de subir.";
  }
  p.week += 1;
  p.lastRpe = avgRpe;
  return p;
}

/**
 * Fator multiplicativo aplicado às cargas, derivado do loadBonus acumulado.
 * Converte kg absolutos em % usando o agachamento intermédio (105 kg) como âncora.
 */
export function progressionFactor(
  prog?: Progression | null,
  deload?: boolean,
): { mult: number; repAdd: number } {
  if (!prog) return { mult: 1, repAdd: 0 };
  if (deload || prog.deloadWeek) return { mult: 0.9, repAdd: 0 };
  const anchor = 105;
  return { mult: 1 + prog.loadBonus / anchor, repAdd: prog.repBonus || 0 };
}

// Percentagem de referência do levantamento principal (para comparar cargas
// prescritas antes/depois de uma progressão).
const MAIN_PCT: Record<Lift, number> = {
  agachamento: 0.75,
  terra: 0.7,
  supino: 0.72,
  press: 0.65,
};

/** Cargas prescritas de referência (kg) para os 4 compostos, já com progressão. */
export function referenceLoads(
  profile: Pick<MotorProfile, "sex" | "level">,
  maxes?: Partial<Record<Lift, number>> | null,
  progression?: Progression | null,
): Record<Lift, number> {
  const { lvl } = baseLifts(profile, maxes);
  const { mult } = progressionFactor(progression ?? null);
  return {
    agachamento: round25(lvl.agachamento * MAIN_PCT.agachamento * mult),
    terra: round25(lvl.terra * MAIN_PCT.terra * mult),
    supino: round25(lvl.supino * MAIN_PCT.supino * mult),
    press: round25(lvl.press * MAIN_PCT.press * mult),
  };
}

/**
 * Autorregulação: o RPE de uma série ajusta as seguintes.
 * Séries com carga:  RPE ≥9.5 → −7% | RPE ≥9 → −4% | RPE ≤6 → +2,5 kg
 * Séries de peso corporal:  RPE ≥9.5 → −3 reps | ≥9 → −2 reps | ≤6 → +2 reps
 */
export function autoregulate(
  set: { w: number | null; reps: number },
  rpe: number,
): { w?: number | null; reps?: number; msg: string } {
  if (set.w == null) {
    if (rpe >= 9.5) return { reps: Math.max(3, set.reps - 3), msg: "RPE 10 — próximas séries −3 reps." };
    if (rpe >= 9) return { reps: Math.max(3, set.reps - 2), msg: "Perto do limite — −2 reps." };
    if (rpe <= 6) return { reps: set.reps + 2, msg: "Fácil demais — +2 reps." };
    return { reps: set.reps, msg: "Na zona certa. Mantém." };
  }
  if (rpe >= 9.5) return { w: round25(set.w * 0.93), msg: "RPE 10 — próxima série −7%." };
  if (rpe >= 9) return { w: round25(set.w * 0.96), msg: "Perto do limite — próxima −4%." };
  if (rpe <= 6) return { w: round25(set.w + 2.5), msg: "Estava leve — +2,5 kg." };
  return { w: set.w, msg: "Na zona certa. Mantém." };
}

// Zonas de desconforto (check-in) → grupos musculares afetados
export const ZONE_TO_MUSCLES: Record<Injury, string[]> = {
  ombro: ["Ombros", "Peito"],
  cotovelo: ["Braços"],
  pulso: ["Braços", "Peito"],
  joelho: ["Pernas"],
  lombar: ["Posterior", "Pernas", "Costas"],
  anca: ["Pernas", "Posterior"],
  tornozelo: ["Pernas"],
  pescoco: ["Costas", "Ombros"],
};

export const ZONE_LABELS: Record<Injury, string> = {
  ombro: "ombro",
  cotovelo: "cotovelo",
  pulso: "pulso",
  joelho: "joelho",
  lombar: "lombar",
  anca: "anca",
  tornozelo: "tornozelo",
  pescoco: "pescoço",
};

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

const CLAMP_DAYS = (n: number) => Math.min(6, Math.max(3, Math.round(n || 4)));

/** A grelha de 7 dias (com funções build) para um perfil. Uso interno. */
function weekOutline(profile: MotorProfile): DiaSplit[] {
  const d = CLAMP_DAYS(profile.daysPerWeek);
  let table = SPLITS[profile.goal] || HYP_SPLITS;
  if (profile.goal === "hipertrofia" && profile.splitStyle === "bro") table = HYP_BRO;
  return table[d] || table[4];
}

/** Resumo leve da semana (sem materializar sessões) — para pré-visualizações. */
export function weekSummary(
  profile: MotorProfile,
): { dayIndex: number; dayName: string; dayShort: string; rest: boolean; title: string }[] {
  return weekOutline(profile).map((day, i) => ({
    dayIndex: i,
    dayName: DAY_NAMES[i],
    dayShort: DAY_SHORT[i],
    rest: !!day.rest,
    title: day.label,
  }));
}

function serialize(e: ExercicioInterno): ExercicioGerado {
  const out: ExercicioGerado = {
    name: e.name,
    swap: e.swap ?? null,
    sets: e.sets.map((s) => ({ w: s.w ?? null, reps: s.reps, rpe: s.rpe })),
    rest: e.rest,
    muscle: guessMuscle(e.name),
    bw: !!e.bw,
    substituted: !!e.substituted,
  };
  if (e.caution) out.caution = true;
  if (e.focusTag) out.focusTag = e.focusTag;
  if (e.detail) out.detail = e.detail;
  return out;
}

/** Constrói a sessão completa de um dia (ou null se for descanso). */
export function buildDay(
  profile: MotorProfile,
  dayIndex: number,
  maxes?: Partial<Record<Lift, number>> | null,
  opts?: OpcoesGeracao,
): DiaGerado | null {
  const outline = weekOutline(profile);
  const day = outline[dayIndex];
  if (!day || day.rest) return null;

  const prog = opts?.progression ?? null;
  const checkinZones = (opts?.checkinZones ?? []).filter((z) => z in ZONE_TO_MUSCLES);
  const injuries = profile.injuries || [];
  const { lvl, usedReal } = baseLifts(profile, maxes);
  const eventWeeks = weeksUntil(profile.eventDate);
  const phase = macroPhase(eventWeeks);
  const adjustments: string[] = [];
  let loadMod = 1;
  let setCut = 0;

  // Sobrecarga progressiva acumulada
  const pf = progressionFactor(prog);
  loadMod *= pf.mult;
  if (prog?.deloadWeek) adjustments.push("Semana de descarga: −10% carga para recuperares");

  if (phase && phase.idx === 2) {
    loadMod -= 0.1;
    setCut += 1;
    adjustments.push("Taper: volume reduzido para a prova");
  }

  const ctx: Ctx = {
    profile,
    lvl,
    loadMod,
    setCut,
    eq: profile.location,
    repAdd: pf.repAdd,
    cns: 100,
  };
  let exercises: ExercicioInterno[] = (day.build ? day.build(ctx) : []).slice();

  // Trabalho de foco (só hipertrofia, no dia do músculo-alvo, fora do taper)
  const focus = (profile.focus || []).slice(0, 3);
  if (
    HYPERTROPHY_GOALS.includes(profile.goal) &&
    !(phase && phase.idx === 2) &&
    focus.length &&
    day.focusDay
  ) {
    for (const f of focus) {
      const fw = FOCUS_WORK[f];
      if (fw && fw.day === day.focusDay) {
        const eq = profile.location === "hibrido" || profile.location === "outro" ? "ginasio" : profile.location;
        const w =
          profile.location === "parque" ? null : round25(lvl.supino * 0.35 * loadMod);
        exercises = [
          ...exercises,
          ex(fw.ex[eq] || fw.ex.ginasio, null, setArr(3, w, fw.reps, "8–9"), "60 s", {
            focusTag: fw.label,
          }),
        ];
      }
    }
  }

  // Check-in do último treino: desconforto numa zona → −8% "carga cautelar"
  // nos exercícios ligados a essa zona (não é substituição — isso é para
  // lesões declaradas no onboarding).
  let checkinCaution = false;
  if (checkinZones.length) {
    const flaggedMuscles = new Set<string>();
    for (const z of checkinZones) {
      for (const m of ZONE_TO_MUSCLES[z] || []) flaggedMuscles.add(m);
    }
    exercises = exercises.map((exo) => {
      const m = guessMuscle(exo.name);
      if (m && flaggedMuscles.has(m) && exo.sets[0]?.w) {
        checkinCaution = true;
        return {
          ...exo,
          sets: exo.sets.map((s) => ({ ...s, w: s.w ? round25(s.w * 0.92) : s.w })),
          swap:
            (exo.swap ? exo.swap + " · " : "") +
            "Carga cautelar (desconforto reportado no check-in)",
          caution: true,
        };
      }
      return exo;
    });
    if (checkinCaution) {
      adjustments.push(
        `Carga −8% em exercícios ligados a ${checkinZones
          .map((z) => ZONE_LABELS[z] || z)
          .join(", ")} (reportaste desconforto)`,
      );
    }
  }

  const warmup = WARMUPS[day.type || "strength_lower"] || WARMUPS.strength_lower;
  const cooldown = COOLDOWNS[day.cdType || "full"] || COOLDOWNS.full;
  const rehab = injuries.length
    ? injuries.flatMap((i) => REHAB[i] || [])
    : [];

  const why: string[] = [SCIENCE[profile.goal] || SCIENCE.hipertrofia];
  if (usedReal.length && STRENGTH_LIFT_GOALS.includes(profile.goal)) {
    why.push(
      `Cargas a partir dos teus recordes reais (${usedReal
        .map((k) => LIFT_LABEL[k].toLowerCase())
        .join(", ")}).`,
    );
  } else if (STRENGTH_LIFT_GOALS.includes(profile.goal)) {
    why.push(
      "Cargas estimadas pelo teu nível e sexo — ajusta nas primeiras séries pelo esforço (RPE).",
    );
  }
  if (eventWeeks != null && phase) {
    why.push(`Faltam ${eventWeeks} sem. — fase de ${phase.name.toLowerCase()}: ${phase.desc}`);
  }
  if (injuries.length) {
    why.push(
      `Lesões declaradas (${injuries.join(", ")}): exercícios de risco substituídos ou anotados, e mobilidade específica no aquecimento.`,
    );
  }
  if (prog && prog.week > 1 && !prog.deloadWeek && prog.reason) {
    why.push(`Progressão (semana ${prog.week}): ${prog.reason}`);
  }
  if (prog?.deloadWeek) {
    why.push(
      `Semana ${prog.week} é de descarga: cargas a −10% para dissipar fadiga. Na próxima retoma-se a progressão.`,
    );
  }
  if (checkinCaution) {
    why.push(
      "O teu check-in do último treino reportou desconforto — apliquei cautela nas cargas relacionadas até veres como reage.",
    );
  }
  why.push(adjustments.length ? `Ajustes: ${adjustments.join("; ")}.` : "Sessão como planeada.");

  return {
    dayIndex,
    dayName: DAY_NAMES[dayIndex],
    dayShort: DAY_SHORT[dayIndex],
    rest: false,
    title: day.label,
    type: day.type,
    cdType: day.cdType,
    warmup,
    cooldown,
    rehab,
    why,
    adjustments,
    exercises: exercises.map(serialize),
  };
}

/** Gera a semana completa, pronta para gravar em training_plans.days. */
export function buildWeek(
  profile: MotorProfile,
  maxes?: Partial<Record<Lift, number>> | null,
  opts?: OpcoesGeracao,
): PlanoGerado {
  const prog = opts?.progression ?? null;
  const { lvl, usedReal } = baseLifts(profile, maxes);
  const allLifts: Lift[] = ["agachamento", "terra", "supino", "press"];
  const days: DiaGerado[] = [];
  for (let i = 0; i < 7; i++) {
    // A semana guardada não leva o efeito do check-in — esse é aplicado ao
    // vivo em /treino/[dia], sobre a sessão seguinte.
    const built = buildDay(profile, i, maxes, { progression: prog });
    if (built) {
      days.push(built);
    } else {
      days.push({
        dayIndex: i,
        dayName: DAY_NAMES[i],
        dayShort: DAY_SHORT[i],
        rest: true,
        title: "Descanso",
      });
    }
  }
  return {
    version: 1,
    meta: {
      goal: profile.goal,
      sex: profile.sex,
      level: profile.level,
      daysPerWeek: CLAMP_DAYS(profile.daysPerWeek),
      location: profile.location,
      locationNote: profile.locationNote ?? null,
      splitStyle:
        profile.goal === "hipertrofia" && profile.splitStyle === "bro" ? "bro" : "freq",
      injuries: profile.injuries || [],
      focus: profile.focus || [],
      science: SCIENCE[profile.goal] || SCIENCE.hipertrofia,
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

/**
 * Frequência semanal por grupo muscular: nº de dias distintos em que cada
 * grupo é trabalhado. Base da regra científica da hipertrofia (≥2×/semana).
 */
export function weekMuscleFrequency(plan: PlanoGerado): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const d of plan.days) {
    if (d.rest || !d.exercises) continue;
    const seen = new Set<string>();
    for (const e of d.exercises) {
      const m = e.muscle;
      if (m) seen.add(m);
    }
    for (const m of seen) freq[m] = (freq[m] || 0) + 1;
  }
  return freq;
}

/**
 * Verifica a regra crítica: em hipertrofia (split de frequência), cada grupo
 * muscular grande tem de ser treinado ≥ `min` vezes por semana.
 */
export function checkHypertrophyFrequency(
  plan: PlanoGerado,
  min = 2,
): { ok: boolean; freq: Record<string, number>; failing: string[] } {
  const freq = weekMuscleFrequency(plan);
  const failing = MAJOR_MUSCLES.filter((m) => (freq[m] || 0) < min);
  return { ok: failing.length === 0, freq, failing };
}
