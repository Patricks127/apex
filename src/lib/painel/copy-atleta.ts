import { partesLisboa } from "../fuso.ts";

/**
 * Linha curta motivadora do cabeçalho do atleta — puro (sem Date() lido
 * espalhado pelo componente), testável. Escolha determinística pelo dia do
 * ano: a mesma frase o dia inteiro (não muda a cada reload), roda ao longo
 * do tempo.
 */
const FRASES = [
  "Mais um dia, mais um passo.",
  "A consistência é que constrói resultados.",
  "Aparece hoje — o resto vem a seguir.",
  "Cada treino conta, mesmo os pequenos.",
  "O trabalho de hoje é o resultado de amanhã.",
  "Sem pressa, sem paragem.",
  "Fica-te pelo processo — os números seguem.",
] as const;

// Dia do ano de LISBOA — a frase muda à meia-noite de Lisboa, não à de UTC.
function diaDoAno(data: Date): number {
  const { ano, mes, dia } = partesLisboa(data);
  const inicio = Date.UTC(ano, 0, 1);
  const agora = Date.UTC(ano, mes - 1, dia);
  return Math.floor((agora - inicio) / 86_400_000);
}

export function linhaMotivadora(data: Date = new Date()): string {
  return FRASES[diaDoAno(data) % FRASES.length];
}
