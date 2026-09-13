/**
 * "Alunos que precisam de atenção" (painel do PT) — quatro sinais
 * objetivos, a partir de dados que já existem (workout_checkins,
 * workout_sessions):
 *
 *   - dor recorrente: ≥2 check-ins com desconforto reportado nas últimas
 *     3 semanas (mesmo limiar que motor2/historico.ts já usa para o motor
 *     considerar substituir um exercício).
 *   - adesão baixa: completion médio das sessões das últimas 3 semanas
 *     abaixo de 75%.
 *   - esforço muito alto: RPE médio das sessões das últimas 3 semanas
 *     ≥9, com pelo menos 2 sessões com RPE registado (uma sessão dura
 *     isolada não chega — "trabalho neural pesado precisa de mais
 *     recuperação" só é sinal de atenção quando é PADRÃO, não um dia).
 *   - inativo: sem nenhuma sessão registada há mais de 10 dias (ou nunca)
 *     — já tem janela própria, mais curta que as 3 semanas dos outros
 *     três, de propósito: 10 dias sem treinar já é um buraco real num
 *     plano de 3-6x/semana, não faz sentido esperar 3 semanas para dizer
 *     isto.
 *
 * A janela de 3 semanas (adesão, esforço, dor) é o que mantém isto
 * ACIONÁVEL: uma sessão incompleta de há dois meses, ou uma dor pontual
 * antiga, não pode continuar a acender um alerta que já não descreve o
 * aluno de agora — um PT com 30 alunos deixa de olhar para alertas que
 * nunca expiram.
 *
 * Limiares e janela são escolha de produto, não uma norma clínica —
 * fáceis de afinar aqui, num só sítio. "Inativo" tem prioridade sobre
 * "adesão baixa" e "esforço muito alto": sem sessões na janela, as suas
 * médias deixam de ser informativas.
 *
 * Puro — não sabe nada de BD nem de datas absolutas; recebe os números já
 * agregados DENTRO da janela por quem chama (src/app/painel/page.tsx —
 * a janela em si vive lá, como janelaRecente(JANELA_ATENCAO_DIAS)).
 */

export type MotivoAtencao = "dor_recorrente" | "adesao_baixa" | "esforco_alto" | "inativo";

/** Texto em português de cada motivo — fonte única, para /painel,
 *  /pt/alunos e a ficha do aluno nunca divergirem na palavra usada. */
export const MOTIVO_LABEL: Record<MotivoAtencao, string> = {
  dor_recorrente: "dor recorrente",
  adesao_baixa: "adesão baixa",
  esforco_alto: "esforço muito alto",
  inativo: "inativo",
};

/** Dias — adesão, esforço e dor recorrente olham todos para a mesma
 *  janela (3 semanas). Inatividade tem o seu próprio limiar, mais curto. */
export const JANELA_ATENCAO_DIAS = 21;

export const LIMIAR_CHECKINS_DESCONFORTO = 2;
export const LIMIAR_ADESAO_BAIXA = 0.75;
export const LIMIAR_RPE_ALTO = 9;
export const MIN_SESSOES_PARA_RPE = 2;
export const LIMIAR_INATIVO_DIAS = 10;

export function avaliarAtencao(params: {
  /** dias desde a sessão mais recente (sem limite de janela — precisa de
   *  saber SE o aluno já treinou há muito, mesmo fora das 3 semanas);
   *  null = nunca treinou. */
  diasDesdeUltimaSessao: number | null;
  /** nº de check-ins com desconforto, dentro de JANELA_ATENCAO_DIAS. */
  checkinsComDesconfortoNaJanela: number;
  /** completion médio das sessões dentro de JANELA_ATENCAO_DIAS; null = nenhuma sessão na janela. */
  completionMediaNaJanela: number | null;
  /** RPE médio das sessões dentro de JANELA_ATENCAO_DIAS; null = menos de MIN_SESSOES_PARA_RPE sessões com RPE registado. */
  rpeMedioNaJanela: number | null;
}): MotivoAtencao[] {
  const motivos: MotivoAtencao[] = [];

  const inativo = params.diasDesdeUltimaSessao == null || params.diasDesdeUltimaSessao > LIMIAR_INATIVO_DIAS;
  if (inativo) motivos.push("inativo");

  if (params.checkinsComDesconfortoNaJanela >= LIMIAR_CHECKINS_DESCONFORTO) motivos.push("dor_recorrente");

  // sem sessões na janela, adesão/esforço não têm o que medir — já é "inativo".
  if (!inativo) {
    if (params.completionMediaNaJanela != null && params.completionMediaNaJanela < LIMIAR_ADESAO_BAIXA) {
      motivos.push("adesao_baixa");
    }
    if (params.rpeMedioNaJanela != null && params.rpeMedioNaJanela >= LIMIAR_RPE_ALTO) {
      motivos.push("esforco_alto");
    }
  }

  return motivos;
}
