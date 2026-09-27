/**
 * Descanso responde ao esforço, não é fixo — ver a conversa que motivou
 * isto: "trabalho neural pesado precisa de mais recuperação" é a mesma
 * ciência que já justifica os tempos-base por tier no motor (PARAMS em
 * motor2/objetivos.ts). Direção validada pela literatura (Schoenfeld et
 * al. 2016; guias NSCA/ACSM: mais esforço/carga → mais descanso, composto
 * pesado > isolamento); os DEGRAUS exatos (15/30/45s por ponto de RPE) são
 * uma interpolação nossa dentro dessa faixa aceite, não um número tirado
 * de um estudo específico — não existe protocolo publicado que amarre
 * segundos exatos a cada ponto de RPE. Ver conversa para o resumo completo
 * da verificação feita antes de implementar isto.
 *
 * Puro — não sabe nada de temporizadores nem de UI, só a aritmética.
 */
import { textoReserva } from "../formato.ts";


export type TipoDescanso = "composto_pesado" | "normal" | "isolamento";

/** O que o treino ao vivo precisa de saber sobre um exercício, resolvido no
 *  servidor contra EXERCICIOS (ver src/app/treino/[dia]/page.tsx) — o
 *  cliente não importa a base inteira só para ler três valores. */
export type InfoMotorExercicio = {
  usaBarra: boolean;
  incrementoKg: number;
  tipoDescanso: TipoDescanso;
};

const AJUSTE_POR_RPE = (rpe: number): number => {
  if (rpe <= 7) return -15;
  if (rpe === 8) return 0;
  if (rpe === 9) return 30;
  return 45; // rpe >= 10
};

const FLOOR_GERAL = 45;
const FLOOR_COMPOSTO_PESADO_RPE_ALTO = 120;
const CEIL_ISOLAMENTO = 120;
const RPE_ALTO = 9;

export interface DescansoDecidido {
  seg: number;
  /** seg − base, depois de todos os limites aplicados (o que aconteceu de
   *  facto — pode ser menor do que o ajuste "cru" do RPE se um limite
   *  cortou pelo caminho). */
  ajusteSeg: number;
  /** Frase curta para o ecrã de descanso ("Mais 30s — a última série
   *  custou-te 9."), ou null quando não há nada a explicar (RPE 8, ou o
   *  ajuste foi anulado por um limite). */
  motivo: string | null;
}

export function decidirDescanso(baseSeg: number, rpe: number, tipo: TipoDescanso): DescansoDecidido {
  let seg = baseSeg + AJUSTE_POR_RPE(rpe);
  seg = Math.max(FLOOR_GERAL, seg);

  if (tipo === "composto_pesado" && rpe >= RPE_ALTO) {
    seg = Math.max(FLOOR_COMPOSTO_PESADO_RPE_ALTO, seg);
  }
  if (tipo === "isolamento") {
    seg = Math.min(CEIL_ISOLAMENTO, seg);
  }

  // O motivo é mostrado ao atleta — em reps na reserva (RIR = 10 − RPE),
  // a escala do alvo e do painel pós-série; o RPE fica só aqui dentro.
  const ajusteSeg = seg - baseSeg;
  const motivo =
    ajusteSeg === 0
      ? null
      : ajusteSeg > 0
        ? `Mais ${ajusteSeg}s — ${rpe >= 10 ? "a última série foi até à falha (0 reps na reserva)" : `a última série ficou só com ${textoReserva(rpe)}`}.`
        : `Menos ${Math.abs(ajusteSeg)}s — a última série esteve fácil (${textoReserva(rpe)}).`;

  return { seg, ajusteSeg, motivo };
}
