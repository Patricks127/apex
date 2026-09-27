/* ============================================================
   APEX — Motor de Programação v2 · Passo 5
   Adaptação ao histórico (spec §5).

   Lê o registo por exercício (exercise_logs), os check-ins
   (workout_checkins) e os recordes (personal_records) e decide, exercício a
   exercício: MANTER ou SUBSTITUIR por uma variante da MESMA FAMÍLIA.

   Regras (spec §5):
   - MANTER: progressão consistente, RPE no alvo, adesão alta, sem desconforto.
   - SUBSTITUIR (só com motivo registado e explicável):
       1. estagnação ≥3 semanas (mesma carga E mesmo RPE)
       2. desconforto recorrente (≥2 check-ins) numa zona que o exercício força
       3. RPE sistematicamente acima do alvo
       4. o utilizador salta o exercício repetidamente
   - NUNCA trocar por variedade. Sem gatilho → mantém-se.
   ============================================================ */

import { EXERCICIOS } from "./exercicios.ts";
import {
  ordemNivel,
  type Equipamento,
  type Exercicio,
  type Nivel,
  type Zona,
} from "./tipos.ts";
import { calcularVolume } from "./volume.ts";
import { formatarKg, formatarNumero, formatarReservaMedia, rirDeRpe } from "../formato.ts";
import {
  semanaParaEntradaVolume,
  type ObjetivoV2,
  type PerfilSelecao,
  type SemanaSelecionada,
} from "./seletor.ts";
import { gerarPlanoValidado, validarSemana, type ResultadoValidacao } from "./validador.ts";

// ---------------------------------------------------------------------------
// Entradas — o adaptador de BD monta isto (ver migração 008_exercise_logs.sql)
// ---------------------------------------------------------------------------

/** Uma linha de `exercise_logs`. */
export type LogExercicio = {
  exercicioId: string;
  semana: number; // week_number
  saltado: boolean;
  cargaKg: number | null;
  reps: number | null;
  rpe: number | null; // 6–10
};

/** Um `workout_checkins` reduzido às zonas de desconforto + a semana. */
export type CheckinHistorico = {
  semana: number;
  zonas: Zona[];
};

/** Uma linha de `personal_records`. */
export type RecordePessoal = {
  lift: string;
  valorKg: number;
  registadoEm: string; // ISO
};

export type HistoricoTreino = {
  logs: LogExercicio[];
  checkins: CheckinHistorico[];
  recordes?: RecordePessoal[];
};

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

const JANELA = 3; // semanas de logs seguidos para os gatilhos de tendência
const TOL_CARGA = 2.5; // kg — "mesma carga"
const TOL_RPE = 0.5; // pontos de RPE — "mesmo esforço"
const SALTOS_TOTAL = 3; // saltos acumulados que já chegam
const SALTOS_JANELA = 2; // saltos na janela recente que já chegam
const DESCONFORTO_MIN = 2; // check-ins com desconforto na zona

// Alvo de RPE por objetivo (spec §2.2 e §6).
const RPE_ALVO: Partial<Record<ObjetivoV2, { min: number; max: number }>> = {
  hipertrofia: { min: 7, max: 9 }, // RIR 1–3
  powerlifting: { min: 6, max: 8 }, // força — falha prejudica a técnica
  calistenia: { min: 7, max: 9 },
};
const rpeAlvo = (o?: ObjetivoV2) => RPE_ALVO[o ?? "hipertrofia"] ?? RPE_ALVO.hipertrofia!;

const NOME_ZONA: Record<Zona, string> = {
  ombro: "no ombro",
  cotovelo: "no cotovelo",
  pulso: "no pulso",
  joelho: "no joelho",
  lombar: "na lombar",
  anca: "na anca",
  tornozelo: "no tornozelo",
  pescoco: "no pescoço",
};

// ---------------------------------------------------------------------------
// Decisão
// ---------------------------------------------------------------------------

export type AccaoHistorico = "manter" | "substituir";
export type GatilhoHistorico = "estagnacao" | "desconforto" | "rpe_alto" | "saltado";

export type DecisaoHistorico = {
  exercicioId: string; // o exercício ANTES
  accao: AccaoHistorico;
  /** Frase pronta a mostrar ao utilizador. */
  motivo: string;
  substitutoId?: string;
  gatilho?: GatilhoHistorico;
  /** Diagnóstico interno (não é para o utilizador). */
  sinais: string[];
};

export type OpcoesHistorico = {
  objetivo?: ObjetivoV2;
  nivel?: Nivel;
  lesoes?: Zona[];
  /**
   * Restringe AINDA MAIS o equipamento considerado (ex.: o atleta perdeu
   * acesso a algo entretanto). Casa+Ginásio (parte 3): por omissão já não se
   * usa o equipamento da semana inteira — usa-se o do(s) PRÓPRIO(S) dia(s)
   * onde o exercício está (`dia.equipamento`, populado pelo seletor). Um
   * exercício de casa nunca é trocado por uma variante de barra que só serve
   * no dia de ginásio.
   */
  equipamento?: Equipamento[];
};

// ---------------------------------------------------------------------------

const media = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);
const clonar = (s: SemanaSelecionada): SemanaSelecionada => JSON.parse(JSON.stringify(s));
const porId = new Map(EXERCICIOS.map((e) => [e.id, e]));

/** Escolhe a variante da MESMA FAMÍLIA que menos muda o estímulo e é segura. */
function escolherSubstituto(
  ex: Exercicio,
  o: {
    nivel: Nivel;
    equip: Set<Equipamento>;
    evitarZonas: Zona[];
    usados: Set<string>;
    /** true → aceita um exercício que já está noutro dia da semana (usa-se
     *  quando a troca é por segurança e não há outra opção). */
    permitirUsados?: boolean;
  },
): Exercicio | null {
  const filtro = (c: Exercicio) =>
    c.familia === ex.familia &&
    c.id !== ex.id &&
    ordemNivel[c.nivelMinimo] <= ordemNivel[o.nivel] &&
    !c.contraindicacoes.some((z) => o.evitarZonas.includes(z)) &&
    (o.equip.size === 0 || c.equipamento.some((q) => o.equip.has(q)));
  let candidatos = EXERCICIOS.filter((c) => filtro(c) && !o.usados.has(c.id));
  if (candidatos.length === 0 && o.permitirUsados) candidatos = EXERCICIOS.filter(filtro);
  const rankProg = (p: Exercicio["progressao"]) => (p === "alta" ? 2 : p === "media" ? 1 : 0);
  candidatos.sort(
    (a, b) =>
      Math.abs(a.tier - ex.tier) - Math.abs(b.tier - ex.tier) || // tier mais próximo
      (b.perfilResistencia === ex.perfilResistencia ? 1 : 0) - // mesmo perfil de resistência
        (a.perfilResistencia === ex.perfilResistencia ? 1 : 0) ||
      rankProg(b.progressao) - rankProg(a.progressao) || // melhor progressão
      Math.abs(a.exigenciaTecnica - ex.exigenciaTecnica) -
        Math.abs(b.exigenciaTecnica - ex.exigenciaTecnica),
  );
  return candidatos[0] ?? null;
}

/** Evidência positiva para MANTER (frases curtas). */
function evidenciaPositiva(logs: LogExercicio[], alvo: { min: number; max: number }): string[] {
  const feitos = logs.filter((l) => !l.saltado);
  const out: string[] = [];
  const cargas = feitos.map((l) => l.cargaKg).filter((v): v is number => v != null);
  if (cargas.length >= 2 && cargas[cargas.length - 1] > cargas[0]) {
    out.push(`carga subiu ${cargas[0]}→${cargas[cargas.length - 1]} kg`);
  }
  const rpes = feitos.slice(-JANELA).map((l) => l.rpe).filter((v): v is number => v != null);
  if (rpes.length && rpes.every((v) => v >= alvo.min - TOL_RPE && v <= alvo.max + TOL_RPE)) {
    out.push("esforço no alvo");
  }
  if (logs.length >= JANELA && feitos.length / logs.length >= 0.8) out.push("adesão alta");
  return out;
}

// ---------------------------------------------------------------------------

/**
 * Aplica as regras da spec §5 à semana gerada. Devolve a semana (com as
 * substituições feitas) e a lista de decisões — uma por exercício.
 */
export function avaliarHistorico(
  semana: SemanaSelecionada,
  hist: HistoricoTreino,
  opcoes: OpcoesHistorico = {},
): { semana: SemanaSelecionada; decisoes: DecisaoHistorico[] } {
  const nivel = opcoes.nivel ?? semana.perfil.nivel;
  const lesoes = opcoes.lesoes ?? semana.perfil.lesoes ?? [];
  // restrição adicional explícita (rara); ver doc de `OpcoesHistorico.equipamento`.
  const restricao = opcoes.equipamento ? new Set(opcoes.equipamento) : null;
  const alvo = rpeAlvo(opcoes.objetivo ?? semana.perfil.objetivo);

  const logsDe = (id: string) =>
    hist.logs.filter((l) => l.exercicioId === id).sort((a, b) => a.semana - b.semana);

  const desconfortoPorZona = new Map<Zona, number>();
  for (const c of hist.checkins)
    for (const z of new Set(c.zonas)) desconfortoPorZona.set(z, (desconfortoPorZona.get(z) ?? 0) + 1);

  const nova = clonar(semana);

  // Um exercício pode ocupar slots em vários dias — decide-se UMA vez por
  // exercício e a mesma decisão aplica-se a todos os seus slots.
  type Slot = { pres: { exercicio: Exercicio; series: number }; dia: (typeof nova.dias)[number] };
  const slotsPorId = new Map<string, Slot[]>();
  for (const dia of nova.dias)
    for (const pres of dia.exercicios) {
      const arr = slotsPorId.get(pres.exercicio.id) ?? [];
      arr.push({ pres, dia });
      slotsPorId.set(pres.exercicio.id, arr);
    }
  const usados = new Set(slotsPorId.keys());
  const decisoes: DecisaoHistorico[] = [];

  // Casa+Ginásio (parte 3): o substituto tem de servir em TODOS os dias onde
  // o exercício está — interseção do equipamento desses dias, não a união da
  // semana. Um exercício com slots só num dia de casa nunca vê equipamento de
  // ginásio aqui, mesmo que a semana tenha dias de ginásio noutro sítio.
  const equipDoExercicio = (slots: Slot[]): Set<Equipamento> => {
    const base = slots.reduce<Set<Equipamento> | undefined>(
      (inter, { dia }) => (inter ? new Set([...inter].filter((q) => dia.equipamento.includes(q))) : new Set(dia.equipamento)),
      undefined,
    ) ?? new Set<Equipamento>();
    return restricao ? new Set([...base].filter((q) => restricao.has(q))) : base;
  };

  /** Decide para um exercício (sem aplicar). */
  const decidir = (ex: Exercicio, slots: Slot[]): DecisaoHistorico => {
    const equip = equipDoExercicio(slots);
    const logs = logsDe(ex.id);
    const recentes = logs.slice(-JANELA);
    const sub = (evitar: Zona[], seguranca = false) =>
      escolherSubstituto(ex, { nivel, equip, evitarZonas: evitar, usados, permitirUsados: seguranca });

    // ---- 2. desconforto recorrente numa zona que o exercício força ----
    const zProblema = ex.contraindicacoes
      .filter((z) => (desconfortoPorZona.get(z) ?? 0) >= DESCONFORTO_MIN)
      .sort((a, b) => (desconfortoPorZona.get(b) ?? 0) - (desconfortoPorZona.get(a) ?? 0))[0];
    if (zProblema) {
      const n = desconfortoPorZona.get(zProblema)!;
      const s = sub([zProblema, ...lesoes], true);
      if (s)
        return {
          exercicioId: ex.id,
          accao: "substituir",
          substitutoId: s.id,
          gatilho: "desconforto",
          motivo: `Troquei ${ex.nome} por ${s.nome}: reportaste desconforto ${NOME_ZONA[zProblema]} ${n} vezes e ${s.nome} não força essa zona.`,
          sinais: [`desconforto ${zProblema}×${n}`],
        };
      return {
        exercicioId: ex.id,
        accao: "manter",
        motivo: `Mantido ${ex.nome}: desconforto ${NOME_ZONA[zProblema]} ${n} vezes, mas não há variante da família ${ex.familia} sem essa contraindicação e com o teu equipamento.`,
        sinais: [`desconforto ${zProblema}×${n}`, "sem alternativa segura"],
      };
    }

    // ---- gatilhos de tendência: precisam de JANELA semanas feitas ----
    if (recentes.length >= JANELA && recentes.every((l) => !l.saltado)) {
      const cargas = recentes.map((l) => l.cargaKg).filter((v): v is number => v != null);
      const rpes = recentes.map((l) => l.rpe).filter((v): v is number => v != null);

      // ---- 1. estagnação ≥3 semanas (mesma carga E mesmo RPE) ----
      const cargaParada =
        cargas.length >= JANELA && Math.max(...cargas) - Math.min(...cargas) <= TOL_CARGA;
      const rpeParado = rpes.length >= JANELA && Math.max(...rpes) - Math.min(...rpes) <= TOL_RPE;
      if (cargaParada && rpeParado) {
        const s = sub(lesoes);
        if (s)
          return {
            exercicioId: ex.id,
            accao: "substituir",
            substitutoId: s.id,
            gatilho: "estagnacao",
            motivo: `Troquei ${ex.nome} por ${s.nome}: ${JANELA} semanas sem subir a carga (${formatarKg(cargas[cargas.length - 1])}) nem ficar mais fácil (${formatarReservaMedia(media(rpes))}).`,
            sinais: [`carga ${cargas.join("/")}`, `rpe ${rpes.join("/")}`],
          };
      }

      // ---- 3. RPE sistematicamente acima do alvo (≥3 semanas todas acima) ----
      if (rpes.length >= JANELA && rpes.every((v) => v > alvo.max)) {
        const s = sub(lesoes);
        if (s)
          return {
            exercicioId: ex.id,
            accao: "substituir",
            substitutoId: s.id,
            gatilho: "rpe_alto",
            motivo: `Troquei ${ex.nome} por ${s.nome}: o esforço andou sempre acima do alvo (${formatarReservaMedia(media(rpes))}; o alvo é pelo menos ${formatarNumero(rirDeRpe(alvo.max))}).`,
            sinais: [`rpe ${rpes.join("/")}`],
          };
      }
    }

    // ---- 4. saltado repetidamente ----
    const saltos = logs.filter((l) => l.saltado).length;
    const saltosRecentes = recentes.filter((l) => l.saltado).length;
    if (saltos >= SALTOS_TOTAL || (recentes.length >= JANELA && saltosRecentes >= SALTOS_JANELA)) {
      const s = sub(lesoes);
      if (s)
        return {
          exercicioId: ex.id,
          accao: "substituir",
          substitutoId: s.id,
          gatilho: "saltado",
          motivo: `Troquei ${ex.nome} por ${s.nome}: saltaste este exercício ${saltos} ${saltos === 1 ? "vez" : "vezes"}.`,
          sinais: [`saltos ${saltos}`],
        };
    }

    // ---- manter ----
    const ev = evidenciaPositiva(logs, alvo);
    return {
      exercicioId: ex.id,
      accao: "manter",
      motivo:
        logs.length === 0
          ? `Mantido ${ex.nome}: ainda sem histórico para avaliar.`
          : ev.length
            ? `Mantido ${ex.nome}: ${ev.join(", ")}.`
            : `Mantido ${ex.nome}: sem sinais para trocar.`,
      sinais: ev,
    };
  };

  for (const [id, slots] of slotsPorId) {
    const ex = porId.get(id);
    if (!ex) continue;
    const dec = decidir(ex, slots);
    if (dec.accao === "substituir" && dec.substitutoId) {
      const s = porId.get(dec.substitutoId)!;
      let aplicado = false;
      for (const { pres, dia } of slots) {
        // não criar um segundo exercício da mesma família no mesmo dia
        if (dia.exercicios.some((x) => x.exercicio !== pres.exercicio && x.exercicio.familia === s.familia)) continue;
        // defesa extra (a escolha já respeita a interseção dos dias, mas um
        // slot individual não fica dependente disso): nunca aplicar um
        // substituto que este dia em concreto não consiga executar.
        if (!s.equipamento.some((q) => dia.equipamento.includes(q))) continue;
        pres.exercicio = s;
        aplicado = true;
      }
      if (aplicado) {
        usados.delete(id);
        usados.add(s.id);
      } else {
        // não deu para aplicar em lado nenhum — regride para "manter"
        dec.accao = "manter";
        dec.motivo = `Mantido ${ex.nome}: quis trocar por ${s.nome} mas isso duplicaria a família no mesmo dia.`;
        delete dec.substitutoId;
        delete dec.gatilho;
      }
    }
    decisoes.push(dec);
  }

  nova.volume = calcularVolume(semanaParaEntradaVolume(nova), nivel);
  return { semana: nova, decisoes };
}

// ---------------------------------------------------------------------------

export type PlanoComHistorico = {
  semana: SemanaSelecionada;
  decisoes: DecisaoHistorico[];
  validacao: ResultadoValidacao;
  tentativas: number;
};

/** Gera + valida + adapta ao histórico, e revalida o resultado. */
export function gerarPlanoComHistorico(
  perfil: PerfilSelecao,
  hist: HistoricoTreino,
  maxTentativas = 3,
): PlanoComHistorico {
  const gerado = gerarPlanoValidado(perfil, maxTentativas);
  const { semana, decisoes } = avaliarHistorico(gerado.semana, hist, {
    objetivo: perfil.objetivo,
    nivel: perfil.nivel,
    lesoes: perfil.lesoes,
    equipamento: perfil.equipamento,
  });
  return { semana, decisoes, validacao: validarSemana(semana), tentativas: gerado.tentativas };
}
