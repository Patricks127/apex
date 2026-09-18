/* ============================================================
   Tendência de volume por semana de CALENDÁRIO (não semana de programa
   — ver volume-historico.ts para essa, usada em /progresso). Aqui o
   consumo é o painel do PT: "está este aluno a subir ou a descer",
   independentemente de qual plano/semana de programa está a seguir
   agora, o que faz mais sentido para uma visão de negócio ao longo do
   tempo real do que semana de programa (que pode reiniciar quando o
   aluno muda de plano).

   Puro — sem BD, sem Date "agora" implícito (recebe as sessões já lidas).
   ============================================================ */

export type SessaoParaTendencia = { performedAt: string; volumeKg: number };
export type PontoTendencia = { semana: string; volumeKg: number };
export type Direcao = "subida" | "estavel" | "descida" | "sem_dados";

/** Chave ISO "AAAA-Www" da semana de calendário de uma data. */
export function chaveSemanaIso(iso: string): string {
  const d = new Date(iso);
  const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diaSemana = (alvo.getUTCDay() + 6) % 7; // 0 = segunda
  alvo.setUTCDate(alvo.getUTCDate() - diaSemana + 3); // quinta-feira da mesma semana ISO
  const primeiraQuinta = new Date(Date.UTC(alvo.getUTCFullYear(), 0, 4));
  const diaSemanaPrimeiraQuinta = (primeiraQuinta.getUTCDay() + 6) % 7;
  const semana =
    1 + Math.round((alvo.getTime() - primeiraQuinta.getTime()) / 86_400_000 / 7 - (3 - diaSemanaPrimeiraQuinta) / 7);
  return `${alvo.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

/** Soma o volume por semana de calendário. Só devolve semanas que
 *  realmente tiveram sessão — nunca preenche semanas sem dados com 0
 *  (isso pareceria "não treinou" quando pode só não haver dado para lá
 *  de todo, ex.: antes da primeira sessão). Ordenado cronologicamente. */
export function agruparVolumePorSemanaCalendario(sessoes: SessaoParaTendencia[]): PontoTendencia[] {
  const porSemana = new Map<string, number>();
  for (const s of sessoes) {
    const chave = chaveSemanaIso(s.performedAt);
    porSemana.set(chave, (porSemana.get(chave) ?? 0) + s.volumeKg);
  }
  return [...porSemana.entries()]
    .map(([semana, volumeKg]) => ({ semana, volumeKg }))
    .sort((a, b) => a.semana.localeCompare(b.semana));
}

// Limiares de produto (não uma norma) — fáceis de afinar aqui.
export const MIN_SEMANAS_PARA_TENDENCIA = 2;
export const LIMIAR_SUBIDA = 0.08;
export const LIMIAR_DESCIDA = -0.08;

/**
 * Direção da tendência: compara a primeira com a última semana COM
 * dados (nunca semanas preenchidas artificialmente). Menos de duas
 * semanas com sessões → "sem_dados", nunca uma linha inventada.
 */
export function direcaoTendencia(pontos: PontoTendencia[]): Direcao {
  if (pontos.length < MIN_SEMANAS_PARA_TENDENCIA) return "sem_dados";
  const primeiro = pontos[0].volumeKg;
  const ultimo = pontos[pontos.length - 1].volumeKg;
  if (primeiro <= 0) return "sem_dados";
  const variacao = (ultimo - primeiro) / primeiro;
  if (variacao >= LIMIAR_SUBIDA) return "subida";
  if (variacao <= LIMIAR_DESCIDA) return "descida";
  return "estavel";
}
