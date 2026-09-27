/* ============================================================
   Fuso horário da app — UM sítio só.

   Todas as datas visíveis ao utilizador, e todas as decisões do tipo "que
   dia é hoje" (treino de hoje, agrupar por dia, semana de adesão), são
   feitas em Europe/Lisbon, explicitamente — nunca no fuso do ambiente onde
   o código corre. O servidor da Vercel está em UTC e o telemóvel pode
   estar em qualquer fuso; sem isto, entre a meia-noite e a 1h de Lisboa
   (horário de verão) o servidor achava que ainda era ontem — e mostrava o
   treino de ontem como "o treino de hoje".

   Regra: nenhum ficheiro da app chama `toLocaleDateString`/
   `toLocaleTimeString`/`getDay()`/`getDate()` para mostrar ou decidir um
   dia sem passar por aqui (ou por `FUSO`).

   Puro — sem dependências, testável com `npm run test:fuso`.
   ============================================================ */

export const FUSO = "Europe/Lisbon";

type EntradaData = Date | string | number;

const paraData = (d: EntradaData): Date => (d instanceof Date ? d : new Date(d));

// Criar um Intl.DateTimeFormat é caro — um por processo chega.
const FORMATO_PARTES = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

const DIA_SEMANA: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Ano/mês/dia e dia da semana DE LISBOA para um instante.
 *  `diaSemana`: 0 = Segunda … 6 = Domingo (o formato do plano). */
export function partesLisboa(d: EntradaData): { ano: number; mes: number; dia: number; diaSemana: number } {
  const partes = Object.fromEntries(FORMATO_PARTES.formatToParts(paraData(d)).map((p) => [p.type, p.value]));
  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    diaSemana: DIA_SEMANA[partes.weekday],
  };
}

/** "AAAA-MM-DD" do dia em Lisboa — comparável como string (agrupar por
 *  dia, "hoje"/"ontem"), correto à volta da mudança de hora. */
export function chaveDiaLisboa(d: EntradaData): string {
  const { ano, mes, dia } = partesLisboa(d);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Data para mostrar, em pt-PT, no dia de Lisboa. Sem opções: "27/09/2026"
 *  (o mesmo formato que `toLocaleDateString("pt-PT")` dava). */
export function formatarData(d: EntradaData, opcoes: Intl.DateTimeFormatOptions = {}): string {
  return paraData(d).toLocaleDateString("pt-PT", { ...opcoes, timeZone: FUSO });
}

/** Hora "HH:MM" de Lisboa. */
export function formatarHora(d: EntradaData): string {
  return paraData(d).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
}
