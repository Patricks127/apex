/* ============================================================
   APEX — Motor de Programação v2 · Passo 1: tipos da base de exercícios
   Ver referencia/MOTOR-V2-ESPECIFICACAO.md (secção 3.1 e 3.2).
   ============================================================ */

// ---------------------------------------------------------------------------
// Famílias de movimento (spec 3.2). Exercícios da mesma família são
// ALTERNATIVAS, não estímulos somáveis.
// As 16 primeiras são as da especificação; as últimas 5 são a extensão
// necessária para as modalidades não-hipertrofia (spec secção 6).
// ---------------------------------------------------------------------------
export const FAMILIAS = [
  "squat",
  "hinge",
  "unilateral_inferior",
  "knee_flexion",
  "hip_extension",
  "horizontal_push",
  "incline_push",
  "vertical_push",
  "chest_isolation",
  "vertical_pull",
  "horizontal_pull",
  "lat_isolation",
  "rear_delt_scap",
  "lateral_raise",
  "elbow_flexion",
  "elbow_extension",
  "calf",
  // extensão APEX
  "trapezio",
  "core",
  "carry",
  "conditioning",
  "cardio",
  "skill",
] as const;
export type Familia = (typeof FAMILIAS)[number];

// ---------------------------------------------------------------------------
// Padrões de movimento — usados para a "cobertura de padrões" na validação
// (spec 3.3 e 4). Mais grosseiro que a família.
// ---------------------------------------------------------------------------
export const PADROES = [
  "agachar",
  "dobrar_anca",
  "unilateral_inferior",
  "flexao_joelho",
  "extensao_anca",
  "flexao_plantar",
  "empurrar_horizontal",
  "empurrar_vertical",
  "puxar_horizontal",
  "puxar_vertical",
  "abducao_ombro",
  "rotacao_externa",
  "flexao_cotovelo",
  "extensao_cotovelo",
  "elevacao_escapular",
  "core_antiextensao",
  "core_antirrotacao",
  "core_flexao",
  "transporte",
  "locomocao",
  "potencia",
] as const;
export type Padrao = (typeof PADROES)[number];

/** Padrão canónico por família (o `padrao` de cada exercício pode afinar). */
export const FAMILIA_PADRAO: Record<Familia, Padrao> = {
  squat: "agachar",
  hinge: "dobrar_anca",
  unilateral_inferior: "unilateral_inferior",
  knee_flexion: "flexao_joelho",
  hip_extension: "extensao_anca",
  horizontal_push: "empurrar_horizontal",
  incline_push: "empurrar_horizontal",
  vertical_push: "empurrar_vertical",
  chest_isolation: "empurrar_horizontal",
  vertical_pull: "puxar_vertical",
  horizontal_pull: "puxar_horizontal",
  lat_isolation: "puxar_vertical", // pullover / puxada de braço esticado
  rear_delt_scap: "rotacao_externa",
  lateral_raise: "abducao_ombro",
  elbow_flexion: "flexao_cotovelo",
  elbow_extension: "extensao_cotovelo",
  calf: "flexao_plantar",
  trapezio: "elevacao_escapular",
  core: "core_antiextensao",
  carry: "transporte",
  conditioning: "potencia",
  cardio: "locomocao",
  skill: "empurrar_vertical",
};

// ---------------------------------------------------------------------------
// Músculos. Deltoides divididos (spec 2.1 e 3.4.5 dependem disso).
// `cardio` é um pseudo-músculo para as modalidades de endurance — não entra
// nos alvos de volume de hipertrofia.
// ---------------------------------------------------------------------------
export const MUSCULOS = [
  "peito",
  "dorsais",
  "trapezio_medio",
  "trapezio_superior",
  "deltoide_anterior",
  "deltoide_lateral",
  "deltoide_posterior",
  "biceps",
  "triceps",
  "antebraco",
  "quadriceps",
  "isquiotibiais",
  "gluteo",
  "adutores",
  "gemeos",
  "lombar",
  "core",
  "cardio",
] as const;
export type Musculo = (typeof MUSCULOS)[number];

/** Grupos grandes — para "mesmo grupo grande em dias consecutivos" (spec 4.1). */
export const MUSCULOS_GRANDES: Musculo[] = [
  "peito",
  "dorsais",
  "quadriceps",
  "isquiotibiais",
  "gluteo",
];

/** Músculos de empurrar / puxar (informativo; o rácio §4.1 conta por PADRÃO
 *  de movimento, ver `calcularVolume`). */
export const MUSCULOS_EMPURRAR: Musculo[] = [
  "peito",
  "deltoide_anterior",
  "deltoide_lateral",
  "triceps",
];
export const MUSCULOS_PUXAR: Musculo[] = [
  "dorsais",
  "trapezio_medio",
  "trapezio_superior",
  "deltoide_posterior",
  "biceps",
];

/** Famílias de empurrar / puxar — base do rácio 1:1 ±30% (spec §4.1).
 *  Conjuntos simétricos: braços, deltoide lateral e os isolamentos
 *  (chest_isolation / lat_isolation) não entram — a contagem é sobre os
 *  compostos de padrão. */
export const FAMILIAS_EMPURRAR: Familia[] = [
  "horizontal_push",
  "incline_push",
  "vertical_push",
];
export const FAMILIAS_PUXAR: Familia[] = [
  "horizontal_pull",
  "vertical_pull",
  "rear_delt_scap",
];

// ---------------------------------------------------------------------------
// Equipamento e zonas de lesão
// ---------------------------------------------------------------------------
export const EQUIPAMENTOS = [
  "barra",
  "halteres",
  "maquina",
  "cabos",
  "peso_corporal",
  "kettlebell",
  "banda",
  "trx",
  "barra_fixa",
  "paralelas",
  "banco",
  "caixa",
  "corda_saltar",
  "sled",
  "remo_ergometro",
  "bicicleta",
  "passadeira",
  "wall_ball",
  "skierg",
] as const;
export type Equipamento = (typeof EQUIPAMENTOS)[number];

export const ZONAS = [
  "ombro",
  "cotovelo",
  "pulso",
  "joelho",
  "lombar",
  "anca",
  "tornozelo",
  "pescoco",
] as const;
export type Zona = (typeof ZONAS)[number];

export const NIVEIS = ["iniciante", "intermedio", "avancado"] as const;
export type Nivel = (typeof NIVEIS)[number];

export const ordemNivel: Record<Nivel, number> = {
  iniciante: 0,
  intermedio: 1,
  avancado: 2,
};

// ---------------------------------------------------------------------------
// O exercício (spec 3.1)
// ---------------------------------------------------------------------------
export type ContributoPrimario = { musculo: Musculo; contributo: 1.0 };
export type ContributoSecundario = { musculo: Musculo; contributo: 0.5 };

export type Tier = 1 | 2 | 3; // principal | secundário | isolamento
export type Escala123 = 1 | 2 | 3;
export type Estabilidade = "livre" | "apoiado" | "maquina";
export type PerfilResistencia = "alongado" | "medio" | "encurtado";
export type Progressao = "alta" | "media" | "baixa";

export type Exercicio = {
  id: string;
  nome: string;
  familia: Familia;
  padrao: Padrao;
  tier: Tier;
  primarios: ContributoPrimario[];
  secundarios: ContributoSecundario[];
  fadigaSistemica: Escala123;
  fadigaLocal: Escala123;
  exigenciaTecnica: Escala123;
  estabilidade: Estabilidade;
  perfilResistencia: PerfilResistencia;
  equipamento: Equipamento[];
  nivelMinimo: Nivel;
  contraindicacoes: Zona[];
  progressao: Progressao;
};
