/* ============================================================
   Leituras dos gráficos — UMA frase por gráfico, gerada SÓ dos dados.

   Regra: honesta, não animadora. O que um bom treinador diria: factual; e
   se piora, dito com clareza para a pessoa agir ("a tua adesão desceu
   para 50%"), nunca "continua assim!". Sem dados suficientes para uma
   tendência → null (o ecrã não mostra frase nenhuma). Nunca uma frase que
   os dados não sustentem.

   Peso e medidas: NEUTRO — subir ou descer não é bom nem mau em si, depende
   do objetivo da pessoa (que é do plano, não desta frase). Só o facto.

   Cada frase descreve o MESMO intervalo que o gráfico desenha, para nunca
   contradizer a linha. Puro, testado (leituras.test.ts).
   ============================================================ */

import { formatarNumero } from "../formato.ts";
import { METRICAS, type MetricaId } from "./metricas.ts";
import { LIMIAR_ADESAO_BAIXA } from "./atencao.ts";
import { LIMIAR_DESCIDA_ADESAO, LIMIAR_SUBIDA_ADESAO, MIN_SEMANAS_COM_TREINO, type PontoAdesaoSemanal } from "./adesao-semanal.ts";

/** "melhor"/"pior" só onde há um bom e um mau objetivos (força, volume,
 *  adesão); peso e medidas são sempre "neutro". */
export type Leitura = { texto: string; sentido: "melhor" | "pior" | "neutro" };

const MS_DIA = 86_400_000;
const MENOS = "−"; // sinal de menos tipográfico, não hífen

const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / MS_DIA);

/** "12 dias", "6 semanas", "2 meses" — a granularidade que se diz em voz alta. */
function periodo(dias: number): string {
  if (dias < 14) return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  if (dias < 56) {
    const s = Math.round(dias / 7);
    return `${s} ${s === 1 ? "semana" : "semanas"}`;
  }
  const m = Math.round(dias / 30.44);
  return `${m} ${m === 1 ? "mês" : "meses"}`;
}

/** "nos últimos 12 dias", "na última semana", "nas últimas 3 semanas",
 *  "no último mês" — a concordância muda com a unidade. */
function nosUltimos(dias: number): string {
  if (dias < 14) return `nos últimos ${dias} dias`;
  if (dias < 56) {
    const s = Math.round(dias / 7);
    return s === 1 ? "na última semana" : `nas últimas ${s} semanas`;
  }
  const m = Math.round(dias / 30.44);
  return m === 1 ? "no último mês" : `nos últimos ${m} meses`;
}

const comSinal = (n: number) => (n > 0 ? "+" : n < 0 ? MENOS : "") + formatarNumero(Math.abs(n));
const arred = (n: number, passo: number) => Math.round(n / passo) * passo;
const pct = (x: number) => `${Math.round(x * 100)}%`;

// ------------------------------------------------------------------ força

const MIN_DIAS_FORCA = 7;

/** 1RM de um levantamento ao longo do tempo. Compara o primeiro e o último
 *  ponto — o que a linha mostra — e, se o último está bem abaixo do máximo,
 *  di-lo: subir no total não esconde uma queda recente.
 *
 *  Testado e estimado NÃO se comparam: um 1RM estimado de um treino leve
 *  (ex.: 55 kg) a seguir a um testado (85 kg) não é "a força caiu 30 kg" —
 *  é outra medição. Usa os testados se houver pelo menos 2; senão os
 *  estimados; senão não há tendência. E pelo menos 7 dias entre o primeiro
 *  e o último — registos do mesmo dia/semana não são uma tendência. */
export function leituraForca(
  nome: string,
  pontos: { valueKg: number; recordedAt: string; source?: "manual" | "auto" }[],
  perspetiva: "atleta" | "pt" = "atleta",
): Leitura | null {
  const testados = pontos.filter((p) => (p.source ?? "manual") === "manual");
  const estimados = pontos.filter((p) => p.source === "auto");
  const serie = testados.length >= 2 ? testados : estimados.length >= 2 ? estimados : null;
  if (!serie) return null;

  const ord = [...serie].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const primeiro = ord[0];
  const ultimo = ord[ord.length - 1];
  const dias = diasEntre(primeiro.recordedAt, ultimo.recordedAt);
  if (dias < MIN_DIAS_FORCA) return null;

  const delta = arred(ultimo.valueKg - primeiro.valueKg, 0.25);
  const maximo = Math.max(...ord.map((p) => p.valueKg));
  const abaixoDoMax = arred(maximo - ultimo.valueKg, 0.25);
  const caiuDoPico = abaixoDoMax >= 2.5;

  let texto =
    delta === 0 ? `${nome}: sem mudança em ${periodo(dias)}` : `${nome}: ${comSinal(delta)} kg em ${periodo(dias)}`;
  if (caiuDoPico)
    texto += `, ${formatarNumero(abaixoDoMax)} kg abaixo do ${perspetiva === "pt" ? "máximo" : "teu máximo"} (${formatarNumero(maximo)} kg)`;

  const sentido = caiuDoPico || delta < 0 ? "pior" : delta > 0 ? "melhor" : "neutro";
  return { texto: `${texto}.`, sentido };
}

// ------------------------------------------------------------------ peso e medidas (neutro)

const JANELA_MEDIDA_DIAS = 30;
const MIN_DIAS_MEDIDA = 7;
const LIMIAR_ESTAVEL = 0.5; // kg ou cm — abaixo disto é ruído de balança/fita

/** Valor atual vs. o de há ~1 mês (o último registo com pelo menos 30 dias
 *  antes do atual; se o histórico for mais curto, o primeiro). Só o facto —
 *  nunca "ótimo, perdeste peso". A altura não tem frase (não é tendência). */
export function leituraMetrica(metric: MetricaId, pontos: { value: number; recordedAt: string }[]): Leitura | null {
  if (metric === "height_cm" || pontos.length < 2) return null;
  const ord = [...pontos].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const atual = ord[ord.length - 1];
  const limite = Date.parse(atual.recordedAt) - JANELA_MEDIDA_DIAS * MS_DIA;
  const antesDoLimite = ord.filter((p) => Date.parse(p.recordedAt) <= limite);
  const base = antesDoLimite.length > 0 ? antesDoLimite[antesDoLimite.length - 1] : ord[0];
  const dias = diasEntre(base.recordedAt, atual.recordedAt);
  if (dias < MIN_DIAS_MEDIDA) return null;

  const def = METRICAS[metric];
  const delta = arred(atual.value - base.value, 0.1);
  const texto =
    Math.abs(delta) < LIMIAR_ESTAVEL
      ? `${def.label}: estável ${nosUltimos(dias)}.`
      : `${def.label}: ${comSinal(delta)} ${def.unidade} em ${periodo(dias)}.`;
  return { texto, sentido: "neutro" };
}

// ------------------------------------------------------------------ volume semanal

const LIMIAR_VOLUME = 0.1; // 10%

/** Volume por semana de programa. A semana em curso (com sessão nos últimos
 *  7 dias) não conta — a meio, parece sempre uma queda. Semanas de
 *  descarga ficam de fora da tendência (a quebra é de propósito); se a
 *  última foi de descarga, é isso que se diz. */
export function leituraVolume(
  semanas: { weekNumber: number; volumeKg: number; isDeload: boolean; ultimaSessao: string | null }[],
  agora: Date = new Date(),
): Leitura | null {
  let ord = [...semanas].sort((a, b) => a.weekNumber - b.weekNumber);
  const ultima = ord[ord.length - 1];
  if (ultima?.ultimaSessao && agora.getTime() - Date.parse(ultima.ultimaSessao) < 7 * MS_DIA) ord = ord.slice(0, -1);
  if (ord.length === 0) return null;

  if (ord[ord.length - 1].isDeload) {
    return { texto: "Última semana foi de descarga — volume mais baixo de propósito.", sentido: "neutro" };
  }

  const normais = ord.filter((s) => !s.isDeload && s.volumeKg > 0);
  if (normais.length < 3) return null;
  const [a, b, c] = normais.slice(-3).map((s) => s.volumeKg);

  if (a < b && b < c && (c - a) / a >= LIMIAR_VOLUME) {
    return { texto: `Volume semanal a subir: +${Math.round((c / a - 1) * 100)}% em 2 semanas.`, sentido: "melhor" };
  }
  if (a > b && b > c && (a - c) / a >= LIMIAR_VOLUME) {
    return {
      texto: `Volume semanal a descer: ${MENOS}${Math.round((1 - c / a) * 100)}% nas últimas 2 semanas.`,
      sentido: "pior",
    };
  }
  const variacao = c / ((a + b) / 2) - 1;
  if (Math.abs(variacao) < LIMIAR_VOLUME) {
    return { texto: "Volume semanal estável nas últimas 3 semanas.", sentido: "neutro" };
  }
  return variacao > 0
    ? { texto: `Volume subiu ${Math.round(variacao * 100)}% na última semana.`, sentido: "melhor" }
    : { texto: `Volume desceu ${Math.round(-variacao * 100)}% na última semana.`, sentido: "pior" };
}

// ------------------------------------------------------------------ adesão

/** Adesão por semana de calendário (o gráfico da ficha do aluno). Só semanas
 *  COMPLETAS — a em curso (a última do gráfico, "Atual") está a meio e
 *  pareceria sempre uma queda. Compara as 2 últimas semanas completas com
 *  as 2 anteriores, com os mesmos limiares do sinal de adesão (±8 pp), e
 *  diz que está baixa abaixo do mesmo limiar dos alertas (75%). */
export function leituraAdesao(pontos: PontoAdesaoSemanal[], perspetiva: "atleta" | "pt" = "atleta"): Leitura | null {
  const completas = pontos.slice(0, -1).slice(-4);
  if (completas.length < 4 || completas.filter((p) => p.feitos > 0).length < MIN_SEMANAS_COM_TREINO) return null;

  const media = (xs: PontoAdesaoSemanal[]) => xs.reduce((s, p) => s + p.pct, 0) / xs.length;
  const antes = media(completas.slice(0, 2));
  const agora = media(completas.slice(2));
  const nivel = media(completas);
  const quem = perspetiva === "pt" ? "A adesão" : "A tua adesão";

  if (agora - antes <= LIMIAR_DESCIDA_ADESAO) {
    // a média de 2 semanas dilui o facto que importa: se a última semana
    // completa foi a zero, diz-se diretamente — é o que dá para agir
    const semanaPassadaZero = completas[completas.length - 1].feitos === 0;
    const aZero = perspetiva === "pt" ? " — na semana passada não treinou" : " — na semana passada não treinaste";
    return {
      texto: `${quem} desceu para ${pct(agora)} nas últimas 2 semanas (era ${pct(antes)})${semanaPassadaZero ? aZero : ""}.`,
      sentido: "pior",
    };
  }
  if (agora - antes >= LIMIAR_SUBIDA_ADESAO) {
    return { texto: `${quem} subiu para ${pct(agora)} nas últimas 2 semanas (era ${pct(antes)}).`, sentido: "melhor" };
  }
  if (nivel < LIMIAR_ADESAO_BAIXA) {
    return { texto: `${quem} está estável, mas baixa: ${pct(nivel)} nas últimas 4 semanas.`, sentido: "pior" };
  }
  return { texto: `${quem} está estável: ${pct(nivel)} nas últimas 4 semanas.`, sentido: "neutro" };
}
