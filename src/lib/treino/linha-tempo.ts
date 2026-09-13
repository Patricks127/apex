import type { DiaGerado, ExercicioGerado, Movimento } from "@/lib/motor";

/**
 * Constrói a linha do tempo de um dia de treino — "Estrutura C" do sistema
 * de design (referencia/SISTEMA-DESIGN.md, "Ecrã do dia"): uma sequência de
 * blocos com hora estimada e estado (feito/a decorrer/por fazer).
 *
 * Puro por desenho — não sabe que horas são nem se o treino já foi feito
 * hoje; isso exige a BD e o relógio real, e fica a cargo de quem chama
 * (src/app/plano). Aqui só a ordem dos blocos e as durações estimadas.
 *
 * Aquecimento, mobilidade/prevenção e alongamentos são blocos próprios,
 * um por bloco de exercícios do motor (não um por movimento) — o objetivo é
 * "o que vem a seguir", não picar cada movimento individual. O descanso
 * entre exercícios também é o seu próprio bloco (não texto dentro do
 * exercício) — não há descanso a seguir ao ÚLTIMO exercício, porque depois
 * dele vem o arrefecimento, não outra série.
 */

export type EstadoBloco = "feito" | "a_decorrer" | "por_fazer";

export type BlocoLinhaTempo =
  | { tipo: "aquecimento"; movimentos: Movimento[] }
  | { tipo: "mobilidade"; movimentos: Movimento[] }
  | { tipo: "alongamento"; movimentos: Movimento[] }
  | { tipo: "exercicio"; exercicio: ExercicioGerado; indice: number }
  | { tipo: "descanso"; label: string };

export type ItemLinhaTempo = BlocoLinhaTempo & {
  estado: EstadoBloco;
  /** minutos desde o início do dia (o primeiro bloco começa em 0). */
  inicioMin: number;
  duracaoMin: number;
};

export interface LinhaTempoDia {
  itens: ItemLinhaTempo[];
  duracaoTotalMin: number;
  /** Soma dos blocos ainda não feitos — 0 quando o dia já está todo feito. */
  duracaoRestanteMin: number;
}

/**
 * Estado do DIA (não do bloco) — quem chama decide isto a partir da BD e do
 * relógio real, esta função só espalha esse estado pelos blocos:
 *   - "feito": já há sessão registada hoje para este dia → todos os blocos
 *     ficam "feito".
 *   - "hoje_por_comecar": o dia selecionado é hoje e ainda não foi
 *     registado → o primeiro bloco fica "a decorrer" ("é aqui que
 *     começas"), o resto "por fazer". Não há dados de progresso real
 *     dentro de uma sessão (isso é o treino ao vivo, ainda por construir) —
 *     por isso só o primeiro bloco, nunca um a meio.
 *   - "neutro": qualquer outro dia da semana (não é hoje) — "estás aqui"
 *     não faz sentido para um dia que não é o de hoje, por isso tudo fica
 *     "por fazer", sem "a decorrer".
 */
export type EstadoDia = "feito" | "hoje_por_comecar" | "neutro";

// Estimativas — o motor já faz o mesmo tipo de aproximação para caber a
// sessão no tempo disponível (ver estimarMinutos em motor2/seletor.ts);
// aqui serve só para desenhar a linha do tempo, não para validar nada.
const SEGUNDOS_POR_SERIE = 40; // execução + preparação
const SEGUNDOS_MOVIMENTO_OMISSO = 45; // dose sem tempo explícito (ex.: "2×15")
const SEGUNDOS_DESCANSO_OMISSO = 60; // rest sem número reconhecível

function segundosDeDose(dose: string): number {
  // "3 min" / "1 min/lado" → só apanha o primeiro número antes de "min";
  // "2×15", "2–3 leves", "15 reps" não têm tempo explícito → estimativa fixa.
  const m = /(\d+(?:[.,]\d+)?)\s*min/i.exec(dose);
  if (!m) return SEGUNDOS_MOVIMENTO_OMISSO;
  return Math.round(parseFloat(m[1].replace(",", ".")) * 60);
}

function segundosDeMovimentos(movimentos: Movimento[]): number {
  return movimentos.reduce((total, m) => total + segundosDeDose(m.dose), 0);
}

function segundosDeDescanso(rest: string): number {
  const m = /(\d+)/.exec(rest);
  return m ? parseInt(m[1], 10) : SEGUNDOS_DESCANSO_OMISSO;
}

function segundosDoBloco(bloco: BlocoLinhaTempo): number {
  switch (bloco.tipo) {
    case "exercicio":
      return bloco.exercicio.sets.length * SEGUNDOS_POR_SERIE;
    case "descanso":
      return segundosDeDescanso(bloco.label);
    case "aquecimento":
    case "mobilidade":
    case "alongamento":
      return segundosDeMovimentos(bloco.movimentos);
  }
}

/** Índice de hoje no formato do plano: 0 = Segunda … 6 = Domingo (DAY_NAMES
 *  do motor). `Date#getDay()` é 0 = Domingo, por isso o desvio de 6. */
export function indiceDiaSemanaHoje(agora: Date = new Date()): number {
  return (agora.getDay() + 6) % 7;
}

export function construirLinhaTempo(dia: DiaGerado, opcoes: { estadoDia: EstadoDia }): LinhaTempoDia {
  const blocos: BlocoLinhaTempo[] = [];

  if (dia.warmup && dia.warmup.length > 0) blocos.push({ tipo: "aquecimento", movimentos: dia.warmup });
  if (dia.rehab && dia.rehab.length > 0) blocos.push({ tipo: "mobilidade", movimentos: dia.rehab });

  const exercicios = dia.exercises ?? [];
  exercicios.forEach((exercicio, indice) => {
    blocos.push({ tipo: "exercicio", exercicio, indice });
    if (indice < exercicios.length - 1) {
      blocos.push({ tipo: "descanso", label: exercicio.rest });
    }
  });

  if (dia.cooldown && dia.cooldown.length > 0) blocos.push({ tipo: "alongamento", movimentos: dia.cooldown });

  // inicioMin acumula a partir dos duracaoMin já arredondados (não dos
  // segundos em bruto) — de propósito: se arredondasse cada um por si, o
  // início do bloco seguinte podia não bater certo com "início + duração"
  // do anterior, e pareceria um buraco na linha do tempo que não existe.
  let cursorMin = 0;
  const itens: ItemLinhaTempo[] = blocos.map((bloco, i) => {
    const duracaoMin = Math.max(1, Math.round(segundosDoBloco(bloco) / 60));
    const inicioMin = cursorMin;
    cursorMin += duracaoMin;
    const estado: EstadoBloco =
      opcoes.estadoDia === "feito"
        ? "feito"
        : opcoes.estadoDia === "hoje_por_comecar" && i === 0
          ? "a_decorrer"
          : "por_fazer";
    return { ...bloco, estado, inicioMin, duracaoMin };
  });

  const duracaoTotalMin = cursorMin;
  const duracaoRestanteMin =
    opcoes.estadoDia === "feito"
      ? 0
      : itens.filter((it) => it.estado !== "feito").reduce((soma, it) => soma + it.duracaoMin, 0);

  return { itens, duracaoTotalMin, duracaoRestanteMin };
}

/**
 * O próximo dia de treino a partir de (sem contar) `indiceHoje` — para o
 * painel dizer "hoje é descanso, o próximo treino é quarta" em vez de só
 * "descanso". `offset` é 1 para amanhã, 2 para depois de amanhã, etc.
 * `null` só quando NENHUM dia da semana tem treino (plano vazio) — nunca
 * quando é só hoje que é descanso.
 */
export function proximoDiaDeTreino(
  dias: DiaGerado[],
  indiceHoje: number,
): { offset: number; dia: DiaGerado } | null {
  for (let offset = 1; offset <= 7; offset++) {
    const dia = dias[(indiceHoje + offset) % 7];
    if (dia && !dia.rest) return { offset, dia };
  }
  return null;
}
