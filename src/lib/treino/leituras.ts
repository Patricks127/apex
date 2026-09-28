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
import {
  LIMIAR_DESCIDA_ADESAO,
  LIMIAR_SUBIDA_ADESAO,
  MIN_SEMANAS_COM_TREINO,
  chaveSemanaIso,
  type PontoAdesaoSemanal,
} from "./adesao-semanal.ts";

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
  opcoes: { minDias?: number } = {},
): Leitura | null {
  const testados = pontos.filter((p) => (p.source ?? "manual") === "manual");
  const estimados = pontos.filter((p) => p.source === "auto");
  const serie = testados.length >= 2 ? testados : estimados.length >= 2 ? estimados : null;
  if (!serie) return null;

  const ord = [...serie].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const primeiro = ord[0];
  const ultimo = ord[ord.length - 1];
  const dias = diasEntre(primeiro.recordedAt, ultimo.recordedAt);
  if (dias < (opcoes.minDias ?? MIN_DIAS_FORCA)) return null;

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

const MIN_DIAS_MEDIDA = 7;
const LIMIAR_ESTAVEL = 0.5; // kg ou cm — abaixo disto é ruído de balança/fita

/** Primeiro vs. último ponto dos que recebe — quem chama passa os pontos
 *  DO PERÍODO escolhido, que são exatamente os que o gráfico desenha (a
 *  frase nunca contradiz a linha). Só o facto — nunca "ótimo, perdeste
 *  peso". A altura não tem frase (não é tendência). */
export function leituraMetrica(
  metric: MetricaId,
  pontos: { value: number; recordedAt: string }[],
  opcoes: { minDias?: number } = {},
): Leitura | null {
  if (metric === "height_cm" || pontos.length < 2) return null;
  const ord = [...pontos].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const base = ord[0];
  const atual = ord[ord.length - 1];
  const dias = diasEntre(base.recordedAt, atual.recordedAt);
  if (dias < (opcoes.minDias ?? MIN_DIAS_MEDIDA)) return null;

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

  // 4+ semanas no período: 1.ª metade vs 2.ª metade (a frase acompanha o
  // período escolhido, como o gráfico). 3 semanas: a regra das duas
  // variações seguidas, abaixo.
  if (normais.length >= 4) {
    const k = Math.floor(normais.length / 2);
    const media = (xs: typeof normais) => xs.reduce((s2, x) => s2 + x.volumeKg, 0) / xs.length;
    const antes = media(normais.slice(0, k));
    const depois = media(normais.slice(-k));
    const v = depois / antes - 1;
    if (Math.abs(v) < LIMIAR_VOLUME) {
      return { texto: `Volume semanal estável nas últimas ${normais.length} semanas.`, sentido: "neutro" };
    }
    return v > 0
      ? { texto: `Volume semanal a subir: +${Math.round(v * 100)}% nas últimas ${k} semanas face às ${k} anteriores.`, sentido: "melhor" }
      : {
          texto: `Volume semanal a descer: ${MENOS}${Math.round(-v * 100)}% nas últimas ${k} semanas face às ${k} anteriores.`,
          sentido: "pior",
        };
  }

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

/** Adesão por semana de calendário (o gráfico da ficha do aluno), para as
 *  semanas do período escolhido. Regras:
 *  - só semanas COMPLETAS — a em curso (a última, "Atual") está a meio e
 *    pareceria sempre uma queda;
 *  - quem chama corta as semanas ANTES do primeiro treino DE SEMPRE
 *    (desdePrimeiraSessao) — nunca as de quem já treinava e parou;
 *  - uma só semana completa (período de 7 dias): descreve essa semana, sem
 *    inventar tendência;
 *  - mais semanas: compara a 1.ª metade com a 2.ª metade, com os mesmos
 *    limiares do sinal de adesão (±8 pp); estável mas abaixo dos 75% (o
 *    limiar dos alertas do PT) → dito que está baixa. */
export function leituraAdesao(pontos: PontoAdesaoSemanal[], perspetiva: "atleta" | "pt" = "atleta"): Leitura | null {
  const completas = pontos.slice(0, -1);
  const eu = perspetiva === "atleta";
  const quem = eu ? "A tua adesão" : "A adesão";

  // Uma só semana completa no período (7 dias): o facto dessa semana.
  if (completas.length === 1) {
    const s = completas[0];
    if (s.feitos === 0) {
      return {
        texto: `Na última semana completa ${eu ? "não treinaste" : "não treinou"} (0 de ${s.previstos} treinos).`,
        sentido: "pior",
      };
    }
    return {
      texto: `Na última semana completa: ${pct(s.pct)} (${s.feitos} de ${s.previstos} treinos).`,
      sentido: s.pct < LIMIAR_ADESAO_BAIXA ? "pior" : "neutro",
    };
  }

  const comHistorico = completas;
  if (comHistorico.length < 4 || comHistorico.filter((p) => p.feitos > 0).length < MIN_SEMANAS_COM_TREINO) return null;

  const media = (xs: PontoAdesaoSemanal[]) => xs.reduce((s, p) => s + p.pct, 0) / xs.length;
  const metade = Math.floor(comHistorico.length / 2);
  const antes = media(comHistorico.slice(0, metade));
  const agora = media(comHistorico.slice(-metade));
  const nivel = media(comHistorico);
  const n = comHistorico.length;

  // A média dilui o facto que mais importa: se a última semana completa foi
  // a zero, diz-se sempre, em qualquer ramo — é o que dá para agir.
  const semanaPassadaZero = comHistorico[n - 1].feitos === 0;
  const aZero = semanaPassadaZero ? (eu ? " — na semana passada não treinaste" : " — na semana passada não treinou") : "";

  if (agora - antes <= LIMIAR_DESCIDA_ADESAO) {
    return {
      texto: `${quem} desceu para ${pct(agora)} nas últimas ${metade} semanas (era ${pct(antes)})${aZero}.`,
      sentido: "pior",
    };
  }
  if (agora - antes >= LIMIAR_SUBIDA_ADESAO) {
    return {
      texto: `${quem} subiu para ${pct(agora)} nas últimas ${metade} semanas (era ${pct(antes)})${aZero}.`,
      sentido: semanaPassadaZero ? "pior" : "melhor",
    };
  }
  if (nivel < LIMIAR_ADESAO_BAIXA || semanaPassadaZero) {
    const baixa = nivel < LIMIAR_ADESAO_BAIXA ? "estável, mas baixa" : "estável";
    return { texto: `${quem} está ${baixa}: ${pct(nivel)} nas últimas ${n} semanas${aZero}.`, sentido: "pior" };
  }
  return { texto: `${quem} está estável: ${pct(nivel)} nas últimas ${n} semanas.`, sentido: "neutro" };
}

/** Tira as semanas ANTES da semana do primeiro treino DE SEMPRE (a conta ou
 *  o plano ainda não existiam — não é 0% de adesão). Só essas: se a pessoa
 *  já treinava antes do período e parou, as semanas a zero ficam — são
 *  adesão real e nunca se escondem. A semana em curso fica sempre. Usado
 *  pelo gráfico E pela frase, para dizerem o mesmo. */
export function desdePrimeiraSessao(pontos: PontoAdesaoSemanal[], primeiraSessao: string | null): PontoAdesaoSemanal[] {
  if (!primeiraSessao) return pontos;
  const semanaInicial = chaveSemanaIso(primeiraSessao);
  const i = pontos.findIndex((p) => p.semana >= semanaInicial);
  return i <= 0 ? pontos : pontos.slice(i);
}
