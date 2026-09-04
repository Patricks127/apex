/* ============================================================
   APEX — Motor de Programação v2 · Passo 3
   Seletor de exercícios (spec §3.3 e §3.4). Foco: hipertrofia.
   (Os outros objetivos entram no passo 6.)
   ============================================================ */

import { EXERCICIOS } from "./exercicios.ts";
import {
  ordemNivel,
  MUSCULOS_GRANDES,
  FAMILIAS_EMPURRAR,
  FAMILIAS_PUXAR,
  type Equipamento,
  type Exercicio,
  type Familia,
  type Musculo,
  type Nivel,
  type Padrao,
  type PerfilResistencia,
  type Zona,
} from "./tipos.ts";
import {
  INTERVALO_VOLUME,
  calcularVolume,
  type EntradaVolume,
  type RelatorioVolume,
} from "./volume.ts";
import {
  CARDIO_DURO,
  EQUIP_CALISTENIA,
  PARAMS,
  grelhaObjetivo,
  type DiaGrelha,
  type TipoSessao,
} from "./objetivos.ts";

export type ObjetivoV2 =
  | "hipertrofia"
  | "powerlifting"
  | "hibrido"
  | "hyrox"
  | "corrida"
  | "calistenia";

export type SplitFormato = "frequencia" | "muscular" | "auto";

export type PerfilSelecao = {
  objetivo: ObjetivoV2;
  nivel: Nivel;
  dias: number; // 3–6
  equipamento: Equipamento[];
  lesoes: Zona[];
  foco?: Musculo[]; // 0–2 músculos prioritários
  minutosSessao?: number; // tempo disponível por sessão (default 75)
  /** Só hipertrofia. "frequencia" = Upper/Lower·PPL (2×/músculo);
   *  "muscular" = split clássico por grupo (1×/músculo); "auto" = frequencia. */
  splitFormato?: SplitFormato;
};

// Perfis de equipamento por local de treino (o onboarding mapeia local → isto).
export const EQUIP_DISPONIVEL: Record<string, Equipamento[]> = {
  ginasio: [
    "barra", "halteres", "maquina", "cabos", "peso_corporal", "kettlebell",
    "banda", "trx", "barra_fixa", "paralelas", "banco", "caixa", "corda_saltar",
    "sled", "remo_ergometro", "bicicleta", "passadeira", "wall_ball", "skierg",
  ],
  hibrido: [
    "barra", "halteres", "maquina", "cabos", "peso_corporal", "kettlebell",
    "banda", "trx", "barra_fixa", "paralelas", "banco", "caixa", "bicicleta",
    "passadeira", "remo_ergometro",
  ],
  casa: ["halteres", "banco", "peso_corporal", "banda", "kettlebell", "barra_fixa"],
  parque: ["peso_corporal", "barra_fixa", "paralelas", "banda", "caixa"],
  outro: [
    "barra", "halteres", "maquina", "cabos", "peso_corporal", "kettlebell",
    "banda", "barra_fixa", "paralelas", "banco",
  ],
};

// Famílias que o seletor de hipertrofia usa (resistência pura).
export const FAMILIAS_RESISTENCIA: Familia[] = [
  "squat", "hinge", "unilateral_inferior", "knee_flexion", "hip_extension",
  "horizontal_push", "incline_push", "vertical_push", "chest_isolation",
  "vertical_pull", "horizontal_pull", "rear_delt_scap", "lateral_raise",
  "trapezio", "elbow_flexion", "elbow_extension", "calf", "core",
];

// Músculos com alvo de volume explícito.
const MUSCULOS_ALVO: Musculo[] = [
  "peito", "dorsais", "trapezio_medio", "deltoide_anterior", "deltoide_lateral",
  "deltoide_posterior", "biceps", "triceps", "quadriceps", "isquiotibiais",
  "gluteo", "gemeos", "core",
];

// Fator sobre o alvo-base — músculos muito alimentados por compostos pedem
// menos volume DIRETO (a fração de secundário completa).
const FATOR_ALVO: Partial<Record<Musculo, number>> = {
  deltoide_anterior: 0.35,
  triceps: 0.5,
  biceps: 0.55,
  trapezio_medio: 0.6,
  deltoide_posterior: 0.7,
  gemeos: 0.45, // servido por 1 família; num split de baixa frequência não chega ao topo
  core: 0.55,
};

// Quando o foco é X, reduz-se o volume direto destes secundários que competem
// pela performance nos press/puxadas (spec §3.4.5).
const COMPETIDORES: Partial<Record<Musculo, Musculo[]>> = {
  peito: ["triceps", "deltoide_anterior"],
  deltoide_anterior: ["triceps"],
  deltoide_lateral: ["triceps"],
  dorsais: ["biceps"],
};

// Que músculos treina cada tipo de dia.
const MUSC_DIA: Record<string, Musculo[]> = {
  upper: ["peito", "dorsais", "trapezio_medio", "deltoide_anterior", "deltoide_lateral", "deltoide_posterior", "biceps", "triceps"],
  lower: ["quadriceps", "isquiotibiais", "gluteo", "gemeos"],
  push: ["peito", "deltoide_anterior", "deltoide_lateral", "triceps"],
  pull: ["dorsais", "trapezio_medio", "deltoide_posterior", "biceps"],
  legs: ["quadriceps", "isquiotibiais", "gluteo", "gemeos"],
  full: ["peito", "dorsais", "trapezio_medio", "deltoide_anterior", "deltoide_lateral", "deltoide_posterior", "biceps", "triceps", "quadriceps", "isquiotibiais", "gluteo", "gemeos"],
  // split clássico por grupo muscular (1×/semana por músculo)
  peito_triceps: ["peito", "deltoide_anterior", "triceps"],
  costas_biceps: ["dorsais", "trapezio_medio", "deltoide_posterior", "biceps"],
  pernas_ombros: ["quadriceps", "isquiotibiais", "gluteo", "gemeos", "deltoide_lateral", "deltoide_anterior", "deltoide_posterior"],
  pernas: ["quadriceps", "isquiotibiais", "gluteo", "gemeos"],
  ombros_bracos: ["deltoide_anterior", "deltoide_lateral", "deltoide_posterior", "biceps", "triceps"],
  peito_dia: ["peito", "deltoide_anterior", "triceps"],
  costas_dia: ["dorsais", "trapezio_medio", "deltoide_posterior", "biceps"],
  ombros_dia: ["deltoide_anterior", "deltoide_lateral", "deltoide_posterior", "trapezio_medio"],
  bracos_dia: ["biceps", "triceps"],
  pontos_fracos: ["deltoide_lateral", "biceps", "triceps", "gemeos", "deltoide_posterior"],
};

// Dias com nome composto (split muscular) têm de ter ≥1 exercício primário de
// CADA músculo/grupo no nome — cada lista interna é um "ou" (qualquer músculo
// dela satisfaz), cada entrada do array externo é um "e" obrigatório.
export const GRUPOS_NOMEADOS: Partial<Record<string, Musculo[][]>> = {
  peito_triceps: [["peito"], ["triceps"]],
  costas_biceps: [["dorsais"], ["biceps"]],
  pernas_ombros: [
    ["quadriceps", "isquiotibiais", "gluteo"],
    ["deltoide_lateral", "deltoide_anterior", "deltoide_posterior"],
  ],
  pernas: [["quadriceps", "isquiotibiais", "gluteo"]],
  ombros_bracos: [["deltoide_lateral", "deltoide_anterior", "deltoide_posterior"], ["biceps"], ["triceps"]],
  peito_dia: [["peito"]],
  costas_dia: [["dorsais"]],
  ombros_dia: [["deltoide_lateral", "deltoide_anterior", "deltoide_posterior"]],
  bracos_dia: [["biceps"], ["triceps"]],
};

const NOME_DIA: Record<string, string> = {
  upper: "Superior", lower: "Inferior", push: "Empurrar", pull: "Puxar", legs: "Pernas", full: "Full body",
  peito_triceps: "Peito + Tríceps", costas_biceps: "Costas + Bíceps", pernas_ombros: "Pernas + Ombros",
  pernas: "Pernas", ombros_bracos: "Ombros + Braços", peito_dia: "Peito", costas_dia: "Costas",
  ombros_dia: "Ombros", bracos_dia: "Braços", pontos_fracos: "Pontos fracos",
};

function splitPara(dias: number): { tipo: string; nome: string }[] {
  const nome = (base: string, i: number, ns: string[]) =>
    ns.filter((x) => x === base).length > 1 ? `${cap(base)} ${String.fromCharCode(65 + i)}` : cap(base);
  const cap = (s: string) => NOME_DIA[s] ?? s;
  let tipos: string[];
  if (dias <= 3) tipos = ["full", "full", "full"];
  else if (dias === 4) tipos = ["upper", "lower", "upper", "lower"];
  else if (dias === 5) tipos = ["upper", "lower", "push", "pull", "legs"];
  else tipos = ["push", "pull", "legs", "push", "pull", "legs"];
  const contador: Record<string, number> = {};
  return tipos.map((t) => {
    contador[t] = (contador[t] ?? 0) + 1;
    return { tipo: t, nome: nome(t, contador[t] - 1, tipos) };
  });
}

/** Split clássico por grupo muscular — cada músculo 1×/semana (spec do pedido). */
function splitMuscular(dias: number, foco: Musculo[]): { tipo: string; nome: string }[] {
  let tipos: string[];
  if (dias <= 3) tipos = ["peito_triceps", "costas_biceps", "pernas_ombros"];
  else if (dias === 4) tipos = ["peito_triceps", "costas_biceps", "pernas", "ombros_bracos"];
  else if (dias === 5) tipos = ["peito_dia", "costas_dia", "pernas", "ombros_dia", "bracos_dia"];
  else tipos = ["peito_dia", "costas_dia", "pernas", "ombros_dia", "bracos_dia", "pontos_fracos"];
  return tipos.map((t) => {
    if (t === "pontos_fracos" && foco.length) {
      return { tipo: "pontos_fracos", nome: `Pontos fracos (${foco.join(" + ")})` };
    }
    return { tipo: t, nome: NOME_DIA[t] ?? t };
  });
}

// ---------------------------------------------------------------------------

const SERIES_TIER: Record<number, number> = { 1: 4, 2: 3, 3: 3 };
const CAP_EXERCICIOS_DIA = 9;
const MAX_FADIGA3_DIA = 2;
const LIMITE_FADIGA_SISTEMICA_DIA = 12;
const LIMITE_FADIGA_SEC_ACUM = 5;

// Estimativa de duração (min): aquecimento + Σ séries·(trabalho+descanso por
// fadiga sistémica) + transição por exercício. Igual ao validador.
const MIN_POR_SERIE: Record<number, number> = { 1: 1.9, 2: 2.4, 3: 3.1 };
const estimarMinutos = (exs: { exercicio: Exercicio; series: number }[]): number =>
  Math.round(
    8 + exs.reduce((a, e) => a + e.series * (MIN_POR_SERIE[e.exercicio.fadigaSistemica] ?? 2.4) + 1, 0),
  );

export type ExercicioPrescrito = {
  exercicio: Exercicio;
  series: number;
  ordem: number;
  foco: boolean;
};
export type DiaSelecionado = {
  indice: number;
  nome: string;
  tipo: string;
  musculosAlvo: Musculo[];
  exercicios: ExercicioPrescrito[];
};
export type SemanaSelecionada = {
  perfil: PerfilSelecao;
  split: string;
  alvoVolume: Partial<Record<Musculo, number>>;
  dias: DiaSelecionado[];
  volume: RelatorioVolume;
  avisos: string[];
};

/** Converte a semana selecionada para a entrada da calculadora de volume. */
export function semanaParaEntradaVolume(s: SemanaSelecionada): EntradaVolume {
  return s.dias.flatMap((d) =>
    d.exercicios.map((e) => ({ exercicioId: e.exercicio.id, series: e.series, dia: d.indice })),
  );
}

// ---------------------------------------------------------------------------

/**
 * @param variacao  0 = seleção ótima determinística. >0 escolhe entre os
 *   candidatos quase-ótimos (score a ≤2 do melhor) — usado pelo validador para
 *   regenerar um plano que não passou (spec §3.3 passo 5, máx. 3 tentativas).
 */
export function selecionarSemana(perfil: PerfilSelecao, variacao = 0): SemanaSelecionada {
  // Só a hipertrofia usa o otimizador de volume (passos 3–4). Os outros
  // objetivos têm estrutura própria (spec §6) — ver `construirSemanaModal`.
  if (perfil.objetivo !== "hipertrofia") return construirSemanaModal(perfil, variacao);

  const avisos: string[] = [];
  const dias = Math.min(6, Math.max(3, Math.round(perfil.dias || 4)));
  const minutosSessao = Math.max(30, Math.round(perfil.minutosSessao ?? 75));
  // ~9 min por exercício (séries + descanso + setup) + 6 de aquecimento
  const capDia = Math.min(CAP_EXERCICIOS_DIA, Math.max(4, Math.round((minutosSessao - 6) / 9)));

  const disp = new Set(perfil.equipamento);
  const foco = (perfil.foco ?? []).slice(0, 2);
  const r = INTERVALO_VOLUME[perfil.nivel];
  const base = Math.round((r.min + r.max) / 2);

  // ---- 1. alvo de volume semanal por músculo ----
  const alvo: Partial<Record<Musculo, number>> = {};
  for (const m of MUSCULOS_ALVO) {
    let v = Math.round(base * (FATOR_ALVO[m] ?? 1));
    if (foco.includes(m)) v = r.max; // topo do intervalo (§3.4.3)
    alvo[m] = v;
  }
  // reduzir competidores do foco (§3.4.5): os secundários que competem pela
  // performance nos press/puxadas já recebem muito do próprio foco — corta-se
  // o trabalho DIRETO (isolamento) e prefere-se isolamento do foco sem eles.
  const focoCompetidores = new Set<Musculo>();
  for (const f of foco) {
    for (const c of COMPETIDORES[f] ?? []) {
      if (foco.includes(c)) continue; // se também é foco, não se penaliza
      focoCompetidores.add(c);
      alvo[c] = Math.max(2, Math.round(base * 0.3));
    }
  }

  // ---- split + frequência ----
  const muscular = perfil.splitFormato === "muscular";
  const grelha = muscular ? splitMuscular(dias, foco) : splitPara(dias);
  if (muscular) {
    avisos.push(
      "Split por grupo muscular: cada músculo é treinado 1×/semana. É o formato clássico de ginásio, mas dividir o mesmo volume em 2 sessões costuma dar séries de melhor qualidade — se a progressão abrandar, experimenta Superior/Inferior.",
    );
  }
  const diasDoMusculo = new Map<Musculo, number[]>();
  grelha.forEach((g, i) => {
    for (const m of MUSC_DIA[g.tipo]) {
      const arr = diasDoMusculo.get(m) ?? [];
      arr.push(i);
      diasDoMusculo.set(m, arr);
    }
  });
  // garantir foco ≥2×/semana
  for (const f of foco) {
    if ((diasDoMusculo.get(f)?.length ?? 0) < 2) {
      avisos.push(`Foco em ${f}: o split de ${dias} dias só o treina 1×; considera mais dias.`);
    }
  }

  // ---- estado semanal ----
  const padroesSemana = new Map<string, number>();
  const perfisSemana = new Map<Musculo, Set<PerfilResistencia>>();
  const volSemana = new Map<Musculo, number>(); // volume DIRETO acumulado

  const registaEscolha = (
    ex: Exercicio,
    series: number,
    ctxDia: CtxDia,
  ) => {
    padroesSemana.set(ex.padrao, (padroesSemana.get(ex.padrao) ?? 0) + 1);
    const pm = ex.primarios[0].musculo;
    const set = perfisSemana.get(pm) ?? new Set<PerfilResistencia>();
    set.add(ex.perfilResistencia);
    perfisSemana.set(pm, set);
    for (const p of ex.primarios) volSemana.set(p.musculo, (volSemana.get(p.musculo) ?? 0) + series * p.contributo);
    for (const s of ex.secundarios) volSemana.set(s.musculo, (volSemana.get(s.musculo) ?? 0) + series * s.contributo);
    ctxDia.familias.add(ex.familia);
    if (ex.fadigaSistemica === 3) ctxDia.fadiga3 += 1;
    ctxDia.fadigaSistemicaTotal += ex.fadigaSistemica;
    for (const p of ex.primarios) ctxDia.volDireto.set(p.musculo, (ctxDia.volDireto.get(p.musculo) ?? 0) + series * p.contributo);
    for (const s of ex.secundarios) {
      ctxDia.volDireto.set(s.musculo, (ctxDia.volDireto.get(s.musculo) ?? 0) + series * s.contributo);
      ctxDia.fadigaLocal.set(s.musculo, (ctxDia.fadigaLocal.get(s.musculo) ?? 0) + ex.fadigaLocal);
    }
    ctxDia.escolhidos.push(ex);
  };

  type CtxDia = {
    familias: Set<Familia>;
    fadiga3: number;
    fadigaSistemicaTotal: number;
    volDireto: Map<Musculo, number>;
    fadigaLocal: Map<Musculo, number>;
    escolhidos: Exercicio[];
  };

  // candidatos base (exclusões duras, spec §3.3.3)
  const candidatosBase = EXERCICIOS.filter(
    (e) =>
      FAMILIAS_RESISTENCIA.includes(e.familia) &&
      ordemNivel[e.nivelMinimo] <= ordemNivel[perfil.nivel] &&
      !e.contraindicacoes.some((z) => perfil.lesoes.includes(z)) &&
      e.equipamento.some((q) => disp.has(q)),
  );

  const diasSel: DiaSelecionado[] = grelha.map((g, i) => {
    const musculosAlvoDia = MUSC_DIA[g.tipo].filter((m) => MUSCULOS_ALVO.includes(m));
    const ndias = (m: Musculo) => Math.max(1, diasDoMusculo.get(m)?.length ?? 1);
    const alvoDia = (m: Musculo) => (alvo[m] ?? 0) / ndias(m);

    const ctx: CtxDia = {
      familias: new Set(),
      fadiga3: 0,
      fadigaSistemicaTotal: 0,
      volDireto: new Map(),
      fadigaLocal: new Map(),
      escolhidos: [],
    };

    const deficit = (m: Musculo) => alvoDia(m) - (ctx.volDireto.get(m) ?? 0);

    const pontuar = (ex: Exercicio): number => {
      let s = 10;
      const defs = ex.primarios.map((p) => deficit(p.musculo));
      const maxDef = Math.max(...defs);
      if (maxDef <= 0) s -= 8;
      else s += Math.min(6, maxDef);

      const éFoco = ex.primarios.some((p) => foco.includes(p.musculo));
      if (éFoco) s += 5;
      s += ex.progressao === "alta" ? 2 : ex.progressao === "media" ? 1 : 0;

      if ((padroesSemana.get(ex.padrao) ?? 0) === 0) s += 2;
      if ((padroesSemana.get(ex.padrao) ?? 0) >= 2) s -= 4;

      const pm = ex.primarios[0].musculo;
      const perfisM = perfisSemana.get(pm);
      if (!perfisM || !perfisM.has(ex.perfilResistencia)) {
        s += 2;
        if (éFoco) s += 3; // ≥2 perfis no músculo em foco (§3.4.4)
      } else {
        s -= 1; // perfil repetido → penalização leve
      }

      // penalizações fortes
      if (ctx.familias.has(ex.familia)) s -= 100;
      if (ex.fadigaSistemica === 3 && ctx.fadiga3 >= MAX_FADIGA3_DIA) s -= 100;

      // teto semanal (§2.1: "acima do teto, rejeitar"). O trabalho DIRETO
      // primário de um músculo não-foco não deve passar do `max` do nível; o de
      // um músculo em foco pode chegar ao `teto` mas não passar. Ultrapassar o
      // teto é veto absoluto (dispara a quebra do ciclo).
      for (const p of ex.primarios) {
        const proj = (volSemana.get(p.musculo) ?? 0) + SERIES_TIER[ex.tier] * p.contributo;
        const limiteAlto = foco.includes(p.musculo) ? r.teto : r.max;
        if (proj > r.teto) s -= 500;
        else if (proj > limiteAlto) s -= 40;
      }
      for (const x of ex.secundarios) {
        const proj = (volSemana.get(x.musculo) ?? 0) + SERIES_TIER[ex.tier] * x.contributo;
        if (proj > r.teto) s -= 12;
        else if (proj > r.max) s -= 3;
      }

      // competidores do foco: evitar variações de press/puxada que empilham
      // fadiga secundária no músculo que se quer poupar (prefere isolamento
      // do foco que não os toca — ex.: aberturas em vez de mais supinos).
      if (focoCompetidores.size && !éFoco) {
        const toca = ex.secundarios.filter((x) => focoCompetidores.has(x.musculo)).length;
        if (toca) s -= 3 * toca;
      }

      // fadiga sistémica do dia
      if (ctx.fadigaSistemicaTotal + ex.fadigaSistemica > LIMITE_FADIGA_SISTEMICA_DIA) s -= 3;
      // fadiga secundária acumulada nos músculos que este ex. também usa
      const fadSec = ex.secundarios.reduce((a, x) => a + (ctx.fadigaLocal.get(x.musculo) ?? 0), 0);
      if (fadSec > LIMITE_FADIGA_SEC_ACUM) s -= 3;

      return s;
    };

    const jaEscolhido = (ex: Exercicio) => ctx.escolhidos.some((x) => x.id === ex.id);

    // "grandes" do dia sem âncora de composto (Tier 1 ou 2) ainda.
    const grandesDia = musculosAlvoDia.filter((m) => MUSCULOS_GRANDES.includes(m));
    const temAncora = (m: Musculo) =>
      ctx.escolhidos.some((e) => e.tier <= 2 && e.primarios.some((p) => p.musculo === m));

    for (const tier of [1, 2, 3] as const) {
      const limite = tier === 1 ? 2 : tier === 2 ? 3 : 6;
      // limiar de déficit para continuar a adicionar exercícios neste tier
      const limiar = tier === 3 ? 0.5 : 1.0;
      let adicionados = 0;
      while (adicionados < limite && ctx.escolhidos.length < capDia) {
        const comDeficit = musculosAlvoDia.filter((m) => deficit(m) > limiar);
        const grandesSemAncora = grandesDia.filter((m) => deficit(m) > 0 && !temAncora(m));

        // parar o tier quando não há mais nada útil a fazer
        if (tier === 1 && grandesSemAncora.length === 0 && adicionados >= 1) break;
        if (tier !== 1 && comDeficit.length === 0) break;

        let cand = candidatosBase.filter((e) => e.tier === tier && !jaEscolhido(e));
        // sem isolamento direto para competidores do foco (§3.4.5)
        if (focoCompetidores.size) {
          cand = cand.filter((e) => !focoCompetidores.has(e.primarios[0].musculo));
        }
        if (tier === 3) {
          cand = cand.filter((e) => e.primarios.some((p) => comDeficit.includes(p.musculo)));
        } else if (tier === 1) {
          const alvoT1 = grandesSemAncora.length ? grandesSemAncora : comDeficit;
          cand = cand.filter((e) => e.primarios.some((p) => alvoT1.includes(p.musculo)));
        } else {
          cand = cand.filter((e) => e.primarios.some((p) => comDeficit.includes(p.musculo)));
        }
        if (cand.length === 0) break;

        const pontuados = cand
          .map((c) => ({ c, sc: pontuar(c) }))
          .sort((a, b) => b.sc - a.sc);
        const bestScore = pontuados.length ? pontuados[0].sc : -Infinity;
        if (!pontuados.length || bestScore <= -50) break;
        // variação: rodar entre os candidatos quase-ótimos (score a ≤2 do topo)
        const quaseOtimos = pontuados.filter((p) => p.sc >= bestScore - 2);
        const best = quaseOtimos[variacao % quaseOtimos.length].c;

        registaEscolha(best, SERIES_TIER[tier], ctx);
        adicionados += 1;
      }
    }

    // ---- 4. ordenar a sessão ----
    const ordenados = ctx.escolhidos
      .map((ex) => ({
        exercicio: ex,
        series: SERIES_TIER[ex.tier],
        foco: ex.primarios.some((p) => foco.includes(p.musculo)),
      }))
      .sort((a, b) => {
        // compostos antes de isolamentos (tier), foco primeiro dentro do tier,
        // depois exigência técnica e fadiga sistémica à frente.
        if (a.exercicio.tier !== b.exercicio.tier) return a.exercicio.tier - b.exercicio.tier;
        if (a.foco !== b.foco) return a.foco ? -1 : 1;
        if (a.exercicio.fadigaSistemica !== b.exercicio.fadigaSistemica)
          return b.exercicio.fadigaSistemica - a.exercicio.fadigaSistemica;
        if (a.exercicio.exigenciaTecnica !== b.exercicio.exigenciaTecnica)
          return b.exercicio.exigenciaTecnica - a.exercicio.exigenciaTecnica;
        return b.exercicio.fadigaLocal - a.exercicio.fadigaLocal;
      })
      .map((e, idx) => ({ ...e, ordem: idx + 1 }));

    return {
      indice: i,
      nome: g.nome,
      tipo: g.tipo,
      musculosAlvo: musculosAlvoDia,
      exercicios: ordenados,
    };
  });

  const semana: SemanaSelecionada = {
    perfil,
    split: grelha.map((g) => g.nome).join(" · "),
    alvoVolume: alvo,
    dias: diasSel,
    volume: calcularVolume(
      diasSel.flatMap((d) =>
        d.exercicios.map((e) => ({ exercicioId: e.exercicio.id, series: e.series, dia: d.indice })),
      ),
      perfil.nivel,
    ),
    avisos,
  };

  // ---- 5. reparação de perfis do foco (garantir ≥2) ----
  for (const f of foco) {
    const perfisF = perfisSemana.get(f) ?? new Set();
    if (perfisF.size >= 2) continue;
    // procurar um dia com ≥2 exercícios do foco e trocar o último (tier 3) por
    // um candidato de perfil diferente.
    for (const d of semana.dias) {
      const doFoco = d.exercicios.filter((e) => e.exercicio.primarios.some((p) => p.musculo === f));
      if (doFoco.length < 2) continue;
      const alvoTroca = [...doFoco].sort((a, b) => b.ordem - a.ordem)[0];
      const subst = candidatosBase
        .filter(
          (e) =>
            e.primarios.some((p) => p.musculo === f) &&
            !d.exercicios.some((x) => x.exercicio.id === e.id) &&
            !d.exercicios.some((x) => x.exercicio.familia === e.familia && x.exercicio.id !== alvoTroca.exercicio.id) &&
            !perfisF.has(e.perfilResistencia),
        )
        .sort((a, b) => a.tier - b.tier)[0];
      if (subst) {
        alvoTroca.exercicio = subst;
        alvoTroca.series = SERIES_TIER[subst.tier];
        perfisF.add(subst.perfilResistencia);
        perfisSemana.set(f, perfisF);
        semana.avisos.push(`Foco ${f}: troquei um exercício para cobrir ≥2 perfis de resistência.`);
        break;
      }
    }
  }
  // recalcular volume se houve trocas
  semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);

  // ---- 6. ajustar ao tempo disponível (§4.1: sessão não pode exceder o tempo) ----
  const reordenar = (d: DiaSelecionado) => {
    d.exercicios.sort((a, b) => {
      if (a.exercicio.tier !== b.exercicio.tier) return a.exercicio.tier - b.exercicio.tier;
      if (a.foco !== b.foco) return a.foco ? -1 : 1;
      if (a.exercicio.fadigaSistemica !== b.exercicio.fadigaSistemica)
        return b.exercicio.fadigaSistemica - a.exercicio.fadigaSistemica;
      if (a.exercicio.exigenciaTecnica !== b.exercicio.exigenciaTecnica)
        return b.exercicio.exigenciaTecnica - a.exercicio.exigenciaTecnica;
      return b.exercicio.fadigaLocal - a.exercicio.fadigaLocal;
    });
    d.exercicios.forEach((e, idx) => (e.ordem = idx + 1));
  };
  for (const d of semana.dias) {
    let cortou = false;
    while (d.exercicios.length > 4 && estimarMinutos(d.exercicios) > minutosSessao) {
      d.exercicios.pop(); // remove o de menor prioridade (maior ordem)
      cortou = true;
    }
    if (cortou) reordenar(d);
  }

  // ---- 8. equilibrar o rácio empurrar:puxar (§4.1: 1:1 ± 30%) ----
  {
    const empSet = new Set<Familia>(FAMILIAS_EMPURRAR);
    const puxSet = new Set<Familia>(FAMILIAS_PUXAR);
    const ladoDe = (e: Exercicio): "emp" | "pux" | null => {
      if (empSet.has(e.familia)) return "emp";
      if (puxSet.has(e.familia)) return "pux";
      return null;
    };
    for (let iter = 0; iter < 8; iter++) {
      const rac = semana.volume.racioEmpurrarPuxar;
      if (rac.equilibrado) break;
      const faltaEmpurrar = rac.racio < 0.7 || !Number.isFinite(rac.racio);
      const ladoAlvo: "emp" | "pux" = faltaEmpurrar ? "emp" : "pux";
      const volM = (m: Musculo) => semana.volume.porMusculo.find((v) => v.musculo === m)?.direto ?? 0;
      const idsUsados = new Set(semana.dias.flatMap((d) => d.exercicios.map((e) => e.exercicio.id)));
      const cand = candidatosBase
        .filter((e) => !idsUsados.has(e.id) && ladoDe(e) === ladoAlvo && volM(e.primarios[0].musculo) + SERIES_TIER[e.tier] <= r.teto)
        .sort((a, b) => a.tier - b.tier);
      let colocou = false;
      for (const ex of cand) {
        const dia = [...semana.dias]
          .sort(
            (a, b) =>
              a.exercicios.filter((x) => ladoDe(x.exercicio) === ladoAlvo).length -
              b.exercicios.filter((x) => ladoDe(x.exercicio) === ladoAlvo).length,
          )
          .find(
            (d) =>
              d.exercicios.length < 9 &&
              !d.exercicios.some((x) => x.exercicio.familia === ex.familia) &&
              // não pôr um exercício num dia que não treina esse músculo
              d.musculosAlvo.some((m) => ex.primarios.some((p) => p.musculo === m)) &&
              !(ex.fadigaSistemica === 3 && d.exercicios.filter((x) => x.exercicio.fadigaSistemica === 3).length >= MAX_FADIGA3_DIA),
          );
        if (!dia) continue;
        dia.exercicios.push({
          exercicio: ex,
          series: SERIES_TIER[ex.tier],
          ordem: dia.exercicios.length + 1,
          foco: ex.primarios.some((p) => foco.includes(p.musculo)),
        });
        reordenar(dia);
        semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
        colocou = true;
        break;
      }
      if (!colocou) {
        // sem espaço para novo composto: +1 série num exercício do lado em falta
        const bump = semana.dias
          .flatMap((d) => d.exercicios)
          .filter((e) => ladoDe(e.exercicio) === ladoAlvo && e.series < 5 && volM(e.exercicio.primarios[0].musculo) < r.teto)
          .sort((a, b) => a.series - b.series)[0];
        if (bump) {
          bump.series += 1;
          semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
          continue;
        }
        // último recurso: aparar isolamento (T3) do lado a mais
        const ladoExcesso: "emp" | "pux" = ladoAlvo === "emp" ? "pux" : "emp";
        let aparou = false;
        for (const d of semana.dias) {
          const alvo = d.exercicios
            .filter((e) => e.exercicio.tier === 3 && ladoDe(e.exercicio) === ladoExcesso)
            .sort((a, b) => b.ordem - a.ordem)[0];
          if (alvo && d.exercicios.length > 3) {
            if (alvo.series > 2) alvo.series -= 1;
            else d.exercicios = d.exercicios.filter((x) => x !== alvo);
            reordenar(d);
            semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
            aparou = true;
            break;
          }
        }
        if (!aparou) break;
      }
    }
  }

  // ---- 9. cortar excesso acima do teto (§2.1: "acima do teto, reduzir") ----
  {
    const ancoraDoDia = (d: DiaSelecionado, ex: ExercicioPrescrito) => {
      // é o único composto (tier ≤ 2) de um dos músculos-alvo do dia?
      return ex.exercicio.tier <= 2 && ex.exercicio.primarios.some((p) =>
        d.musculosAlvo.includes(p.musculo) &&
        d.exercicios.filter(
          (x) => x.exercicio.tier <= 2 && x.exercicio.primarios.some((q) => q.musculo === p.musculo),
        ).length === 1,
      );
    };
    const protegidos = new Set<Musculo>([...MUSCULOS_GRANDES, ...foco]);
    // baixar 1 série não pode deixar um músculo protegido abaixo de 8
    const seguro = (ex: ExercicioPrescrito) =>
      !ex.exercicio.primarios.some((p) => {
        if (!protegidos.has(p.musculo)) return false;
        const atual = semana.volume.porMusculo.find((v) => v.musculo === p.musculo)?.direto ?? 0;
        return atual - p.contributo < 8;
      });
    for (let iter = 0; iter < 6; iter++) {
      const excesso = semana.volume.porMusculo.find(
        (v) => v.estado === "acima_teto" && v.primario > v.teto,
      );
      if (!excesso) break;
      const contribs: { d: DiaSelecionado; ex: ExercicioPrescrito }[] = [];
      for (const d of semana.dias)
        for (const ex of d.exercicios)
          if (ex.exercicio.primarios.some((p) => p.musculo === excesso.musculo) && seguro(ex))
            contribs.push({ d, ex });
      contribs.sort((a, b) => {
        const anc = Number(ancoraDoDia(a.d, a.ex)) - Number(ancoraDoDia(b.d, b.ex));
        if (anc) return anc; // não-âncora primeiro
        return b.ex.exercicio.tier - a.ex.exercicio.tier; // tier 3 primeiro
      });
      const bump = contribs.find((c) => c.ex.series > 2);
      if (bump && excesso.primario - excesso.teto <= 1.5) {
        bump.ex.series -= 1;
        semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
        continue;
      }
      const alvo = contribs.find((c) => c.d.exercicios.length > 3);
      if (!alvo) {
        if (bump) {
          bump.ex.series -= 1;
          semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
          continue;
        }
        break;
      }
      alvo.d.exercicios = alvo.d.exercicios.filter((x) => x !== alvo.ex);
      reordenar(alvo.d);
      semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
    }
  }

  // ---- 10. cobertura de padrões essenciais em falta — só se houver folga ----
  {
    const essenciais: Padrao[] = [
      "agachar", "dobrar_anca", "empurrar_horizontal", "empurrar_vertical",
      "puxar_horizontal", "puxar_vertical",
    ];
    const presentes = () => new Set(semana.dias.flatMap((d) => d.exercicios.map((e) => e.exercicio.padrao)));
    for (const pad of essenciais) {
      if (presentes().has(pad)) continue;
      const idsUsados = new Set(semana.dias.flatMap((d) => d.exercicios.map((e) => e.exercicio.id)));
      const cand = candidatosBase
        .filter((e) => e.padrao === pad && !idsUsados.has(e.id))
        .sort((a, b) => a.tier - b.tier);
      for (const ex of cand) {
        const dia = semana.dias
          .filter((d) => d.musculosAlvo.some((mm) => ex.primarios.some((p) => p.musculo === mm)))
          .sort((a, b) => a.exercicios.length - b.exercicios.length)
          .find(
            (d) =>
              !d.exercicios.some((x) => x.exercicio.familia === ex.familia) &&
              estimarMinutos([...d.exercicios, { exercicio: ex, series: SERIES_TIER[ex.tier] }]) <= minutosSessao &&
              !(ex.fadigaSistemica === 3 && d.exercicios.filter((x) => x.exercicio.fadigaSistemica === 3).length >= MAX_FADIGA3_DIA) &&
              ex.primarios.every(
                (p) =>
                  (semana.volume.porMusculo.find((v) => v.musculo === p.musculo)?.direto ?? 0) +
                    SERIES_TIER[ex.tier] * p.contributo <=
                  r.teto,
              ),
          );
        if (!dia) continue;
        dia.exercicios.push({
          exercicio: ex,
          series: SERIES_TIER[ex.tier],
          ordem: dia.exercicios.length + 1,
          foco: ex.primarios.some((p) => foco.includes(p.musculo)),
        });
        reordenar(dia);
        semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
        break;
      }
    }
  }

  // ---- 11. piso de volume: nenhum grupo grande / foco abaixo de 8 séries ----
  //  (corre por último, depois do corte de teto, para não se anularem)
  {
    const tetoMais = (m: Musculo) => (foco.includes(m) ? r.teto + 2 : r.teto + 1);
    const excedeTeto = (ex: Exercicio, serie: number) =>
      ex.primarios.some(
        (p) => (semana.volume.porMusculo.find((v) => v.musculo === p.musculo)?.direto ?? 0) + serie * p.contributo > tetoMais(p.musculo),
      );
    for (const m of new Set<Musculo>([...MUSCULOS_GRANDES, ...foco])) {
      const atual = () => semana.volume.porMusculo.find((v) => v.musculo === m)?.direto ?? 0;
      let guarda = 0;
      while (atual() < 8 && guarda++ < 6) {
        const idsUsados = new Set(semana.dias.flatMap((d) => d.exercicios.map((e) => e.exercicio.id)));
        const cand = candidatosBase
          .filter((e) => e.primarios.some((p) => p.musculo === m) && !idsUsados.has(e.id) && !excedeTeto(e, SERIES_TIER[e.tier]))
          .sort((a, b) => a.tier - b.tier);
        // só dias cujos músculos-alvo incluem `m` — nunca um exercício de um
        // músculo fora do que o dia se propõe a treinar (mesmo sem espaço).
        const diaBase = (diasDoMusculo.get(m) ?? [])
          .map((ix) => semana.dias.find((d) => d.indice === ix))
          .filter((d): d is DiaSelecionado => !!d && d.musculosAlvo.includes(m));
        let mexeu = false;
        for (const ex of cand) {
          const dia = diaBase
            .sort((a, b) => a.exercicios.length - b.exercicios.length)
            .find(
              (d) =>
                d.exercicios.length < 9 &&
                !d.exercicios.some((x) => x.exercicio.familia === ex.familia) &&
                !(ex.fadigaSistemica === 3 && d.exercicios.filter((x) => x.exercicio.fadigaSistemica === 3).length >= MAX_FADIGA3_DIA),
            );
          if (!dia) continue;
          dia.exercicios.push({
            exercicio: ex,
            series: SERIES_TIER[ex.tier],
            ordem: dia.exercicios.length + 1,
            foco: ex.primarios.some((p) => foco.includes(p.musculo)),
          });
          reordenar(dia);
          semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
          mexeu = true;
          break;
        }
        if (!mexeu) {
          const bump = semana.dias
            .flatMap((d) => d.exercicios)
            .filter((e) => e.exercicio.primarios.some((p) => p.musculo === m) && e.series < 6 && !excedeTeto(e.exercicio, 1))
            .sort((a, b) => a.series - b.series)[0];
          if (!bump) break;
          bump.series += 1;
          semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
        }
      }
      if (atual() < 8)
        semana.avisos.push(`${m}: ${atual()} séries/semana — lesões/equipamento/tempo limitam o volume possível.`);
    }
  }

  // ---- 12. corte final ao tempo (as passagens 8/10/11 podem ter alongado) ----
  for (const d of semana.dias) {
    let cortou = false;
    while (d.exercicios.length > 4 && estimarMinutos(d.exercicios) > minutosSessao) {
      // remover o de menor prioridade que não deixe um protegido abaixo de 8
      const ordenadosPorPrioridade = [...d.exercicios].sort((a, b) => b.ordem - a.ordem);
      const rem =
        ordenadosPorPrioridade.find(
          (e) =>
            !e.exercicio.primarios.some((p) => {
              if (![...MUSCULOS_GRANDES, ...foco].includes(p.musculo)) return false;
              const v = semana.volume.porMusculo.find((x) => x.musculo === p.musculo)?.direto ?? 0;
              return v - e.series * p.contributo < 8;
            }),
        ) ?? ordenadosPorPrioridade[0];
      d.exercicios = d.exercicios.filter((x) => x !== rem);
      cortou = true;
      semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
    }
    if (cortou) reordenar(d);
  }
  semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);

  // ---- 13. split muscular: garantir ≥1 exercício de cada músculo do nome ----
  //  (por último — nada a seguir pode voltar a tirá-los)
  if (muscular) {
    for (const dia of semana.dias) {
      const grupos = GRUPOS_NOMEADOS[dia.tipo];
      if (!grupos) continue;
      const protegidos = new Set<string>();
      for (const grupo of grupos) {
        const jaTem = dia.exercicios.find((e) => e.exercicio.primarios.some((p) => grupo.includes(p.musculo)));
        if (jaTem) {
          protegidos.add(jaTem.exercicio.id);
          continue;
        }
        const famUsadas = new Set(dia.exercicios.map((e) => e.exercicio.familia));
        const fs3Atual = dia.exercicios.filter((e) => e.exercicio.fadigaSistemica === 3).length;
        const cand = candidatosBase
          .filter((e) => e.primarios.some((p) => grupo.includes(p.musculo)) && !famUsadas.has(e.familia))
          .sort((a, b) => a.tier - b.tier);
        // nunca o 3º composto pesado do dia, a não ser que seja mesmo a única opção
        const semExcesso = cand.filter((e) => !(e.fadigaSistemica === 3 && fs3Atual >= MAX_FADIGA3_DIA));
        const ex = semExcesso[0] ?? cand[0];
        if (!ex) {
          semana.avisos.push(
            `${dia.nome}: sem exercício viável para ${grupo[0]} com as lesões/equipamento — o dia fica incompleto para esse músculo.`,
          );
          continue;
        }
        if (dia.exercicios.length >= capDia) {
          const menor = [...dia.exercicios]
            .filter((e) => !protegidos.has(e.exercicio.id))
            .sort((a, b) => b.ordem - a.ordem)[0];
          if (menor) dia.exercicios = dia.exercicios.filter((x) => x !== menor);
        }
        dia.exercicios.push({
          exercicio: ex,
          series: SERIES_TIER[ex.tier],
          ordem: dia.exercicios.length + 1,
          foco: ex.primarios.some((p) => foco.includes(p.musculo)),
        });
        protegidos.add(ex.id);
        reordenar(dia);
      }
      // acerta o tempo sem sacrificar os que acabaram de ser garantidos
      let guarda3 = 0;
      while (
        dia.exercicios.length > 4 &&
        estimarMinutos(dia.exercicios) > minutosSessao * 1.08 &&
        guarda3++ < 6
      ) {
        const alvo = [...dia.exercicios]
          .filter((e) => !protegidos.has(e.exercicio.id))
          .sort((a, b) => b.ordem - a.ordem)[0];
        if (!alvo) break;
        dia.exercicios = dia.exercicios.filter((x) => x !== alvo);
        reordenar(dia);
      }
    }
    semana.volume = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
  }

  return semana;
}

// ===========================================================================
// PASSO 6 — modalidades não-hipertrofia (spec §6) + treino concorrente (§2.5)
// ===========================================================================

// Ordem de preferência do cardio. Com a força como prioridade (§2.5),
// bicicleta/remo antes de corrida (menos dano excêntrico nos membros inferiores).
const CARDIO_Z2_CORRIDA = ["corrida_z2", "bicicleta_z2", "remo_ergometro_z2"];
const CARDIO_Z2_FORCA = ["bicicleta_z2", "remo_ergometro_z2", "corrida_z2", "skierg_intervalos"];
const CARDIO_QUALIDADE_CORRIDA = ["corrida_intervalos_vo2", "corrida_tempo_limiar"];
const CARDIO_QUALIDADE_FORCA = [
  "bicicleta_intervalos",
  "remo_ergometro_intervalos",
  "assault_bike_sprint",
  "corrida_intervalos_vo2",
];

/** Ordena os dias para respeitar o treino concorrente (spec §2.5):
 *  nada de cardio duro imediatamente antes de um dia de pernas pesado. */
function agendarInterferencia(
  grelha: DiaGrelha[],
  _objetivo: ObjetivoV2,
  avisos: string[],
): DiaGrelha[] {
  const g = [...grelha];
  const duro = (t: TipoSessao) => (CARDIO_DURO as string[]).includes(t);
  const pernasPesado = (d: DiaGrelha) => d.tipo === "forca_principal" || !!d.pernasPesado;
  for (let passo = 0; passo < g.length; passo++) {
    let mexeu = false;
    for (let i = 1; i < g.length; i++) {
      if (duro(g[i - 1].tipo) && pernasPesado(g[i])) {
        // afasta o cardio duro para trás, se houver um dia "neutro" onde encaixar
        for (let j = i - 2; j >= 0; j--) {
          if (!duro(g[j].tipo) && !pernasPesado(g[j]) && (j === 0 || !duro(g[j - 1].tipo))) {
            const [d] = g.splice(i - 1, 1);
            g.splice(j, 0, d);
            mexeu = true;
            break;
          }
        }
        if (!mexeu) {
          // sem sítio — troca com o dia seguinte para pelo menos não ser adjacente antes
          if (i + 1 < g.length) {
            [g[i - 1], g[i + 1]] = [g[i + 1], g[i - 1]];
            mexeu = true;
          }
        }
      }
    }
    if (!mexeu) break;
  }
  const aindaColidem = g.some(
    (d, i) => i > 0 && duro(g[i - 1].tipo) && pernasPesado(d),
  );
  if (aindaColidem) {
    avisos.push("Atenção: o nº de dias não deixa separar totalmente o cardio duro do dia de pernas pesado — coloca um dia de descanso entre eles.");
  }
  return g;
}

type CtxModal = {
  objetivo: ObjetivoV2;
  nivel: Nivel;
  disp: Set<Equipamento>;
  lesoes: Zona[];
  foco: Musculo[];
  minutosSessao: number;
  forcaPrioridade: boolean;
  variacao: number;
  avisos: string[];
};

const EQUIP_CALIS = new Set<Equipamento>(EQUIP_CALISTENIA);
const viavelModal = (e: Exercicio, c: CtxModal) =>
  ordemNivel[e.nivelMinimo] <= ordemNivel[c.nivel] &&
  !e.contraindicacoes.some((z) => c.lesoes.includes(z)) &&
  e.equipamento.some((q) => c.disp.has(q)) &&
  // calistenia: progressão por alavanca/reps → só exercícios de peso corporal
  (c.objetivo !== "calistenia" ||
    e.familia === "cardio" ||
    e.equipamento.some((q) => EQUIP_CALIS.has(q)));

/** Escolhe UM exercício de cardio para um dia. */
function escolherCardio(
  g: DiaGrelha,
  c: CtxModal,
  avisos: string[],
): ExercicioPrescrito | null {
  const corridaPrimeiro = c.objetivo === "corrida";
  const prefIds =
    g.zona === "qualidade"
      ? corridaPrimeiro
        ? CARDIO_QUALIDADE_CORRIDA
        : CARDIO_QUALIDADE_FORCA
      : corridaPrimeiro
        ? CARDIO_Z2_CORRIDA
        : CARDIO_Z2_FORCA;
  const porId = new Map(EXERCICIOS.map((e) => [e.id, e]));
  const cardios = EXERCICIOS.filter((e) => e.familia === "cardio");
  const nivelOk = (e: Exercicio) => ordemNivel[e.nivelMinimo] <= ordemNivel[c.nivel];
  const equipOk = (e: Exercicio) => e.equipamento.some((q) => c.disp.has(q));
  const contraOk = (e: Exercicio) => !e.contraindicacoes.some((z) => c.lesoes.includes(z));

  // cascata: preferido & totalmente viável → qualquer cardio viável → ignora
  // equipamento (corre na rua) → ignora contraindicação (com nota de cautela)
  let pool = prefIds.map((id) => porId.get(id)!).filter((e) => e && viavelModal(e, c));
  if (!pool.length) pool = cardios.filter(viavelModal_ => nivelOk(viavelModal_) && equipOk(viavelModal_) && contraOk(viavelModal_));
  if (!pool.length) pool = prefIds.map((id) => porId.get(id)!).filter((e) => e && nivelOk(e) && contraOk(e));
  if (!pool.length) pool = cardios.filter((e) => nivelOk(e) && contraOk(e));
  let cautela = false;
  if (!pool.length) {
    pool = prefIds.map((id) => porId.get(id)!).filter(Boolean);
    cautela = true;
  }
  if (!pool.length) return null;
  const pick = pool[c.variacao % pool.length] ?? pool[0];
  if (cautela) {
    const zonas = pick.contraindicacoes.filter((z) => c.lesoes.includes(z));
    if (zonas.length)
      avisos.push(`${g.nome}: ${pick.nome} está sinalizado para ${zonas.join("/")} — faz sem dor e em piso macio, ou troca por bicicleta/remo.`);
  }
  return { exercicio: pick, series: 1, ordem: 1, foco: false };
}

/** Preenche um dia de FORÇA com N exercícios (greedy, sem repetir família).
 *  `volSemana` acumula volume PRIMÁRIO direto ao longo da semana — não se
 *  ultrapassa o teto do nível (evita o 25×/semana de glúteo num split de
 *  força de alta frequência). */
function preencherForca(
  musculos: Musculo[],
  familiasPermitidas: Familia[] | undefined,
  alvoN: number,
  c: CtxModal,
  volSemana: Map<Musculo, number>,
  jaEscolhidos: ExercicioPrescrito[] = [],
): ExercicioPrescrito[] {
  const fams = familiasPermitidas ?? FAMILIAS_RESISTENCIA;
  const rank = (p: Exercicio["progressao"]) => (p === "alta" ? 2 : p === "media" ? 1 : 0);
  const teto = INTERVALO_VOLUME[c.nivel].teto + (c.objetivo === "powerlifting" ? 2 : 0);
  const pool = EXERCICIOS.filter(
    (e) =>
      viavelModal(e, c) &&
      fams.includes(e.familia) &&
      e.primarios.some((p) => musculos.includes(p.musculo)),
  ).sort((a, b) => a.tier - b.tier || rank(b.progressao) - rank(a.progressao));
  const rot = c.variacao % Math.max(1, pool.length);
  const ordenado = [...pool.slice(rot), ...pool.slice(0, rot)];

  const escolhidos = [...jaEscolhidos];
  const famUsadas = new Set(escolhidos.map((e) => e.exercicio.familia));
  const cobertura = new Map<Musculo, number>();
  const acresc = (e: Exercicio) => {
    for (const p of e.primarios) {
      cobertura.set(p.musculo, (cobertura.get(p.musculo) ?? 0) + 1);
      volSemana.set(p.musculo, (volSemana.get(p.musculo) ?? 0) + SERIES_TIER[e.tier] * p.contributo);
    }
  };
  for (const e of escolhidos) acresc(e.exercicio);

  const nT1 = () => escolhidos.filter((x) => x.exercicio.tier === 1).length;
  const estouraTeto = (e: Exercicio) =>
    e.primarios.some((p) => (volSemana.get(p.musculo) ?? 0) + SERIES_TIER[e.tier] * p.contributo > teto);

  for (const tierAlvo of [1, 2, 3]) {
    for (const e of ordenado) {
      if (escolhidos.length >= alvoN) break;
      if (e.tier !== tierAlvo) continue;
      if (famUsadas.has(e.familia)) continue;
      if (e.tier === 1 && nT1() >= 2) continue; // no máx. 2 compostos pesados/dia
      if (estouraTeto(e)) continue;
      const pm = e.primarios[0].musculo;
      const subCoberto = (cobertura.get(pm) ?? 0) < 2;
      if (!subCoberto && escolhidos.length >= Math.max(3, alvoN - 2)) continue;
      escolhidos.push({
        exercicio: e,
        series: SERIES_TIER[e.tier],
        ordem: escolhidos.length + 1,
        foco: e.primarios.some((p) => c.foco.includes(p.musculo)),
      });
      famUsadas.add(e.familia);
      acresc(e);
    }
  }
  return escolhidos;
}

const LIFT_FAMILIA: Record<string, Familia> = {
  agachamento: "squat",
  supino: "horizontal_push",
  terra: "hinge",
  press: "vertical_push",
};

function construirDiaModal(g: DiaGrelha, c: CtxModal, volSemana: Map<Musculo, number>): ExercicioPrescrito[] {
  const alvoN = Math.min(8, Math.max(4, Math.round((c.minutosSessao - 8) / 11)));

  if (g.tipo === "cardio_z2" || g.tipo === "cardio_qualidade") {
    const ex = escolherCardio(g, c, c.avisos);
    return ex ? [ex] : [];
  }

  if (g.tipo === "circuito") {
    const fams = g.estacoes ?? (["conditioning", "carry"] as Familia[]);
    let pool = EXERCICIOS.filter((e) => viavelModal(e, c) && fams.includes(e.familia));
    // fallback: se as lesões esvaziam o circuito, usa cardio + core seguros
    if (pool.length < 3)
      pool = EXERCICIOS.filter(
        (e) => viavelModal(e, c) && ["conditioning", "carry", "cardio", "core"].includes(e.familia),
      );
    pool = pool.sort((a, b) => b.fadigaSistemica - a.fadigaSistemica);
    const rot = c.variacao % Math.max(1, pool.length);
    const ord = [...pool.slice(rot), ...pool.slice(0, rot)];
    const out: ExercicioPrescrito[] = [];
    const fam = new Set<Familia>();
    for (const e of ord) {
      if (out.length >= Math.min(6, alvoN)) break;
      if (fam.has(e.familia) && out.length >= 3) continue;
      out.push({ exercicio: e, series: 3, ordem: out.length + 1, foco: false });
      fam.add(e.familia);
    }
    return out;
  }

  if (g.tipo === "skill") {
    const skills = EXERCICIOS.filter((e) => e.familia === "skill" && viavelModal(e, c));
    const rot = c.variacao % Math.max(1, skills.length);
    const primeiros = [...skills.slice(rot), ...skills.slice(0, rot)]
      .slice(0, 2)
      .map((e, i) => ({ exercicio: e, series: 4, ordem: i + 1, foco: false }));
    const fill = g.familias?.filter((f) => f !== "skill");
    return rescatar(preencherForca(g.musculos ?? [], fill, alvoN, c, volSemana, primeiros), g, c, alvoN, volSemana);
  }

  if (g.tipo === "forca_principal") {
    let base: ExercicioPrescrito[] = [];
    const fam = g.principal ? LIFT_FAMILIA[g.principal] : undefined;
    if (fam) {
      // T1 é o ideal; sem barra (casa/parque) aceita-se o melhor T2 da família
      const cand = EXERCICIOS.filter(
        (e) => e.familia === fam && e.tier <= 2 && viavelModal(e, c),
      ).sort(
        (a, b) => a.tier - b.tier || b.fadigaSistemica - a.fadigaSistemica || b.exigenciaTecnica - a.exigenciaTecnica,
      );
      const principal = cand[c.variacao % Math.max(1, cand.length)] ?? cand[0];
      if (principal) base = [{ exercicio: principal, series: principal.tier === 1 ? 5 : 4, ordem: 1, foco: false }];
    }
    return rescatar(preencherForca(g.musculos ?? [], g.familias, alvoN, c, volSemana, base), g, c, alvoN, volSemana);
  }

  // forca (hibrido / corrida-manutenção / calistenia PPL)
  return rescatar(preencherForca(g.musculos ?? [], g.familias, alvoN, c, volSemana), g, c, alvoN, volSemana);
}

/** Se o dia ficou (quase) vazio por causa das lesões/equipamento, tenta de
 *  novo sem restrição de família — qualquer exercício seguro para os músculos
 *  do dia. */
function rescatar(
  exs: ExercicioPrescrito[],
  g: DiaGrelha,
  c: CtxModal,
  alvoN: number,
  volSemana: Map<Musculo, number>,
): ExercicioPrescrito[] {
  if (exs.length >= 2 || !g.musculos?.length) return exs;
  return preencherForca(g.musculos, undefined, alvoN, c, volSemana, exs);
}

export function construirSemanaModal(perfil: PerfilSelecao, variacao = 0): SemanaSelecionada {
  const objetivo = perfil.objetivo;
  const nivel = perfil.nivel;
  let dias = Math.min(6, Math.max(3, Math.round(perfil.dias || 4)));
  const minutosSessao = Math.max(30, Math.round(perfil.minutosSessao ?? 75));
  const params = PARAMS[objetivo];
  const avisos = [...params.regras];

  // powerlifting: um iniciante não aguenta 5–6 dias de levantamentos pesados
  if (objetivo === "powerlifting" && nivel === "iniciante" && dias > 4) {
    avisos.push(`Powerlifting para iniciante: ${dias} dias é demais — ajustei para 4. Prioriza a técnica e a recuperação.`);
    dias = 4;
  } else if (objetivo === "powerlifting" && nivel === "intermedio" && dias > 5) {
    avisos.push("Powerlifting intermédio: ajustei para 5 dias para a recuperação dos levantamentos pesados.");
    dias = 5;
  }

  const c: CtxModal = {
    objetivo,
    nivel,
    disp: new Set(perfil.equipamento),
    lesoes: perfil.lesoes ?? [],
    foco: (perfil.foco ?? []).slice(0, 2),
    minutosSessao,
    forcaPrioridade: objetivo === "hibrido" || objetivo === "hyrox" || objetivo === "powerlifting",
    variacao,
    avisos,
  };

  const volSemana = new Map<Musculo, number>();
  const grelha = agendarInterferencia(grelhaObjetivo(objetivo, dias), objetivo, avisos);

  const diasSel: DiaSelecionado[] = grelha.map((g, i) => ({
    indice: i,
    nome: g.nome,
    tipo: g.tipo,
    musculosAlvo: (g.musculos ?? []).slice(),
    exercicios: construirDiaModal(g, c, volSemana),
  }));

  const semana: SemanaSelecionada = {
    perfil,
    split: grelha.map((g) => g.nome).join(" · "),
    alvoVolume: {},
    dias: diasSel,
    volume: calcularVolume([], nivel),
    avisos,
  };
  semana.volume = calcularVolume(semanaParaEntradaVolume(semana), nivel);
  return semana;
}
