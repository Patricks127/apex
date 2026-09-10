/* ============================================================
   APEX — Motor de Programação v2 · barrel do passo 1
   (só a base de exercícios + tipos + consultas. Sem lógica de
   seleção/volume/validação — esses são passos 2-4.)
   ============================================================ */

export * from "./tipos.ts";
export { EXERCICIOS } from "./exercicios.ts";
export * from "./volume.ts";
export * from "./seletor.ts";
// Explícito (e não `export *`): o `EQUIP_DISPONIVEL` já sai por `seletor.ts`.
export {
  EQUIP_CASA_IDS,
  EQUIP_CASA_OMISSAO,
  EQUIP_CASA_OPCOES,
  equipamentoCasaDe,
  equipamentoDaSemana,
  equipamentoPorDiaDe,
  type EntradaEquipamentoDia,
} from "./equipamento.ts";
export * from "./validador.ts";
export * from "./historico.ts";
export * from "./objetivos.ts";
export * from "./plano.ts";
export * from "./progressao-manual.ts";

import { EXERCICIOS } from "./exercicios.ts";
import type { Exercicio, Familia, Musculo, Padrao } from "./tipos.ts";

export const exercicioPorId = (id: string): Exercicio | undefined =>
  EXERCICIOS.find((e) => e.id === id);

export const exerciciosPorFamilia = (f: Familia): Exercicio[] =>
  EXERCICIOS.filter((e) => e.familia === f);

export const exerciciosPorPadrao = (p: Padrao): Exercicio[] =>
  EXERCICIOS.filter((e) => e.padrao === p);

/** Todos os músculos que um exercício toca (primários + secundários). */
export const musculosDe = (e: Exercicio): Musculo[] => [
  ...e.primarios.map((x) => x.musculo),
  ...e.secundarios.map((x) => x.musculo),
];

/** Contagem de exercícios por família. */
export function contagemPorFamilia(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of EXERCICIOS) out[e.familia] = (out[e.familia] ?? 0) + 1;
  return out;
}
