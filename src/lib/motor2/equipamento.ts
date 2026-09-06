/* ============================================================
   APEX — Motor de Programação v2 · Equipamento por dia
   "Casa + Ginásio" como alternância real.

   Até aqui `location = "hibrido"` era um conjunto único de equipamento
   aplicado a TODOS os dias — o utilizador dizia que treinava nos dois sítios e
   o motor tratava a semana como se cada sessão tivesse tudo à mão. Aqui a
   semana passa a ter um conjunto de equipamento POR DIA.

   PARTE 1 (esta): só o modelo de dados. O seletor ainda não lê
   `equipamentoPorDia` — o comportamento gerado é exatamente o de antes.
   PARTE 2: o seletor usa cada dia com o seu conjunto, e a atribuição de
   dias-tipo passa a respeitar a regra "âncora pesada nos dias de ginásio".
   ============================================================ */

import type { Equipamento } from "./tipos.ts";

// Perfis de equipamento por local de treino (o onboarding mapeia local → isto).
// `hibrido` era — e continua a ser, na parte 1 — um conjunto único aplicado a
// todos os dias; a partir da parte 2 deixa de ser usado na seleção.
export const EQUIP_DISPONIVEL: Record<string, Equipamento[]> = {
  ginasio: [
    "barra", "halteres", "maquina", "cabos", "peso_corporal", "kettlebell",
    "banda", "trx", "barra_fixa", "paralelas", "banco", "caixa", "corda_saltar",
    "sled", "remo_ergometro", "bicicleta", "passadeira", "wall_ball", "skierg",
  ],
  hibrido: [
    "barra", "halteres", "maquina", "cabos", "peso_corporal", "kettlebell",
    "banda", "trx", "barra_fixa", "paralelas", "banco", "caixa", "bicicleta",
    "passadeira", "remo_ergometro",
  ],
  casa: ["halteres", "banco", "peso_corporal", "banda", "kettlebell", "barra_fixa"],
  parque: ["peso_corporal", "barra_fixa", "paralelas", "banda", "caixa"],
  outro: [
    "barra", "halteres", "maquina", "cabos", "peso_corporal", "kettlebell",
    "banda", "barra_fixa", "paralelas", "banco",
  ],
};

/** O que se assume que existe em casa quando o utilizador não declara nada. */
export const EQUIP_CASA_OMISSAO: Equipamento[] = [
  "halteres",
  "banda",
  "peso_corporal",
  "barra_fixa",
];

/** Equipamento que nunca falta, seja onde for. */
const SEMPRE: Equipamento = "peso_corporal";

/** O que o onboarding oferece na pergunta "o que tens em casa?".
 *  Os quatro primeiros são a omissão (`EQUIP_CASA_OMISSAO`). */
export const EQUIP_CASA_OPCOES: { id: Equipamento; label: string }[] = [
  { id: "halteres", label: "Halteres" },
  { id: "banda", label: "Bandas elásticas" },
  { id: "peso_corporal", label: "Peso corporal" },
  { id: "barra_fixa", label: "Barra fixa" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "banco", label: "Banco" },
  { id: "barra", label: "Barra + discos" },
  { id: "paralelas", label: "Paralelas" },
  { id: "trx", label: "TRX / argolas" },
  { id: "caixa", label: "Caixa / step" },
];

/** IDs válidos na pergunta de casa — o servidor filtra por esta lista. */
export const EQUIP_CASA_IDS: Equipamento[] = EQUIP_CASA_OPCOES.map((o) => o.id);

export type EntradaEquipamentoDia = {
  /** `Location` do perfil: ginasio | casa | hibrido | parque | outro. */
  location: string;
  /** Dias de treino da semana (3–6). */
  dias: number;
  /** Só em "hibrido": quantos desses dias são no ginásio. */
  diasGinasio?: number | null;
  /** O que o utilizador declarou ter em casa. Vazio/ausente → omissão. */
  equipamentoCasa?: Equipamento[] | null;
};

/** Normaliza o conjunto de casa: omissão quando vazio, peso corporal sempre. */
export function equipamentoCasaDe(declarado?: Equipamento[] | null): Equipamento[] {
  const base = declarado && declarado.length > 0 ? declarado : EQUIP_CASA_OMISSAO;
  return base.includes(SEMPRE) ? [...base] : [...base, SEMPRE];
}

/**
 * Conjunto de equipamento de cada dia de treino da semana.
 *
 * Fora de "hibrido" todos os dias são iguais (o perfil do local). Em "hibrido"
 * os primeiros `diasGinasio` são dias de ginásio (conjunto completo — um dia
 * de ginásio é um dia de ginásio) e os restantes são dias de casa.
 *
 * A ORDEM aqui é só a contagem: quais dias-tipo ficam com o ginásio é decisão
 * da parte 2 (âncoras pesadas nos dias de ginásio), que reordena este array.
 */
export function equipamentoPorDiaDe(e: EntradaEquipamentoDia): Equipamento[][] {
  const dias = Math.max(1, Math.round(e.dias));
  const casa = equipamentoCasaDe(e.equipamentoCasa);

  if (e.location === "casa") {
    return Array.from({ length: dias }, () => [...casa]);
  }

  if (e.location !== "hibrido") {
    const set = EQUIP_DISPONIVEL[e.location] ?? EQUIP_DISPONIVEL.ginasio;
    return Array.from({ length: dias }, () => [...set]);
  }

  const ginasio = EQUIP_DISPONIVEL.ginasio;
  const nGinasio = Math.min(dias, Math.max(0, Math.round(e.diasGinasio ?? Math.ceil(dias / 2))));
  return Array.from({ length: dias }, (_, i) => (i < nGinasio ? [...ginasio] : [...casa]));
}

/** União de todos os dias — o conjunto "alguma vez disponível" na semana. */
export function equipamentoDaSemana(porDia: Equipamento[][]): Equipamento[] {
  return [...new Set(porDia.flat())];
}
