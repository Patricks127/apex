/* ============================================================
   Sinal de ADESÃO/consistência por semana de CALENDÁRIO — treinos feitos
   vs. dias previstos do plano ativo, por semana. Existe para qualquer
   aluno com plano ativo desde o 1º treino (não depende de volume — serve
   também quem treina peso corporal/cardio, sem carga a somar).

   Semana de CALENDÁRIO, não semana de programa — mesmo motivo que
   tendencia-volume.ts: não reiniciar quando o aluno muda de plano.

   Ao contrário do volume (onde uma semana sem sessão é "falta de dado",
   nunca inventada), aqui uma semana sem sessão É um ponto real: "0 de N
   feitos" é informação verdadeira sobre adesão, não uma invenção — por
   isso esta janela preenche TODAS as semanas do período, nunca só as que
   tiveram sessão.

   Puro — sem BD; aceita `agora` para poder testar sem depender do relógio
   real (por omissão usa o momento da chamada).
   ============================================================ */
import { chaveSemanaIso } from "./tendencia-volume.ts";
import { LIMIAR_ADESAO_BAIXA } from "./atencao.ts";

export type PontoAdesaoSemanal = { semana: string; feitos: number; previstos: number; pct: number };
export type DirecaoAdesao = "subida" | "estavel" | "descida" | "sem_dados";
export type EstadoAdesao = "boa" | "a_descer" | "baixa" | "sem_dados";

export const JANELAS_ADESAO_SEMANAS = 6;
export const MIN_SEMANAS_COM_TREINO = 2;

// Limiares em PONTOS PERCENTUAIS (diferença absoluta), não variação
// relativa: pct pode ser legitimamente 0 (o aluno não treinou nenhuma vez
// numa semana), onde uma variação relativa (a dividir pelo valor inicial)
// rebentaria ou distorceria (0% → 20% não é "variação infinita", é +20 pp).
export const LIMIAR_SUBIDA_ADESAO = 0.08;
export const LIMIAR_DESCIDA_ADESAO = -0.08;

/**
 * Últimas `janelas` semanas de calendário, terminando na semana ATUAL
 * (incluída, mesmo em curso — sem prorateamento pelos dias já passados,
 * o mesmo tratamento simples que tendencia-volume.ts já dava a "esta
 * semana"). `previstosSemana` é o nº de dias de treino do plano ativo
 * AGORA, aplicado como constante ao longo de toda a janela — não há
 * histórico de "o que era prescrito nessa semana exata" para planos que
 * mudaram; é a mesma aproximação que o KPI "esperados" do painel já usa.
 */
export function agruparAdesaoPorSemanaCalendario(
  sessoes: { performedAt: string }[],
  previstosSemana: number,
  janelas: number = JANELAS_ADESAO_SEMANAS,
  agora: Date = new Date(),
): PontoAdesaoSemanal[] {
  const porSemana = new Map<string, number>();
  for (const s of sessoes) {
    const chave = chaveSemanaIso(s.performedAt);
    porSemana.set(chave, (porSemana.get(chave) ?? 0) + 1);
  }

  const pontos: PontoAdesaoSemanal[] = [];
  for (let i = janelas - 1; i >= 0; i--) {
    const d = new Date(agora);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const chave = chaveSemanaIso(d.toISOString());
    const feitos = porSemana.get(chave) ?? 0;
    pontos.push({
      semana: chave,
      feitos,
      previstos: previstosSemana,
      pct: previstosSemana > 0 ? feitos / previstosSemana : 0,
    });
  }
  return pontos;
}

/**
 * Direção: diferença (em pontos percentuais) entre a última e a primeira
 * semana da janela. Exige pelo menos MIN_SEMANAS_COM_TREINO semanas com
 * alguma sessão real — sem isso "subida"/"descida" seria ruído, não
 * sinal (ex.: aluno só começou a semana passada, 5 das 6 semanas a
 * zero por não existirem ainda, não por falta de adesão).
 */
export function direcaoAdesao(pontos: PontoAdesaoSemanal[]): DirecaoAdesao {
  const semanasComTreino = pontos.filter((p) => p.feitos > 0).length;
  if (pontos.length === 0 || semanasComTreino < MIN_SEMANAS_COM_TREINO) return "sem_dados";
  const variacao = pontos[pontos.length - 1].pct - pontos[0].pct;
  if (variacao >= LIMIAR_SUBIDA_ADESAO) return "subida";
  if (variacao <= LIMIAR_DESCIDA_ADESAO) return "descida";
  return "estavel";
}

/**
 * Estado para cor — não é só a direção: um aluno pode estar "estável"
 * mas já baixo (ex.: sempre a 40%), o que é mais urgente do que "a
 * descer" a partir de um nível alto. O nível ATUAL manda primeiro,
 * usando o MESMO limiar que "precisa de atenção" já usa (adesão <75%) —
 * de propósito, para os dois sinais nunca se contradizerem.
 */
export function estadoAdesao(pontos: PontoAdesaoSemanal[], direcao: DirecaoAdesao): EstadoAdesao {
  if (direcao === "sem_dados" || pontos.length === 0) return "sem_dados";
  const atual = pontos[pontos.length - 1].pct;
  if (atual < LIMIAR_ADESAO_BAIXA) return "baixa";
  if (direcao === "descida") return "a_descer";
  return "boa";
}
