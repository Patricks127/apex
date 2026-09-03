/* ============================================================
   APEX — Motor de Programação v2 · Passo 3
   Seletor de exercícios (spec §3.3 e §3.4). Foco: hipertrofia.
   (Os outros objetivos entram no passo 6.)
   ============================================================ */

import { EXERCICIOS } from "./exercicios.ts";
import {
  ordemNivel,
  MUSCULOS_GRANDES,
  type Equipamento,
  type Exercicio,
  type Familia,
  type Musculo,
  type Nivel,
  type PerfilResistencia,
  type Zona,
} from "./tipos.ts";
import {
  INTERVALO_VOLUME,
  calcularVolume,
  type EntradaVolume,
  type RelatorioVolume,
} from "./volume.ts";

export type ObjetivoV2 =
  | "hipertrofia"
  | "powerlifting"
  | "hibrido"
  | "hyrox"
  | "corrida"
  | "calistenia";

export type PerfilSelecao = {
  objetivo: ObjetivoV2;
  nivel: Nivel;
  dias: number; // 3–6
  equipamento: Equipamento[];
  lesoes: Zona[];
  foco?: Musculo[]; // 0–2 músculos prioritários
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
const FAMILIAS_RESISTENCIA: Familia[] = [
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
};

function splitPara(dias: number): { tipo: string; nome: string }[] {
  const nome = (base: string, i: number, ns: string[]) =>
    ns.filter((x) => x === base).length > 1 ? `${cap(base)} ${String.fromCharCode(65 + i)}` : cap(base);
  const cap = (s: string) =>
    ({ upper: "Superior", lower: "Inferior", push: "Empurrar", pull: "Puxar", legs: "Pernas", full: "Full body" }[s] ?? s);
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

// ---------------------------------------------------------------------------

const SERIES_TIER: Record<number, number> = { 1: 4, 2: 3, 3: 3 };
const CAP_EXERCICIOS_DIA = 9;
const MAX_FADIGA3_DIA = 2;
const LIMITE_FADIGA_SISTEMICA_DIA = 12;
const LIMITE_FADIGA_SEC_ACUM = 5;

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

export function selecionarSemana(perfil: PerfilSelecao): SemanaSelecionada {
  const avisos: string[] = [];
  const dias = Math.min(6, Math.max(3, Math.round(perfil.dias || 4)));
  if (perfil.objetivo !== "hipertrofia") {
    avisos.push(
      `Objetivo '${perfil.objetivo}' ainda não é suportado pelo seletor v2 — a usar a lógica de hipertrofia. (Passo 6.)`,
    );
  }

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
  const grelha = splitPara(dias);
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

      // teto semanal: não empurrar um músculo (direto + fração de secundário)
      // acima do teto do nível — trava a acumulação em splits de alta frequência.
      for (const p of ex.primarios) {
        if ((volSemana.get(p.musculo) ?? 0) + SERIES_TIER[ex.tier] * p.contributo > r.teto) s -= 6;
      }
      for (const x of ex.secundarios) {
        if ((volSemana.get(x.musculo) ?? 0) + SERIES_TIER[ex.tier] * x.contributo > r.teto) s -= 2;
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
      while (adicionados < limite && ctx.escolhidos.length < CAP_EXERCICIOS_DIA) {
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

        let best: Exercicio | null = null;
        let bestScore = -Infinity;
        for (const c of cand) {
          const sc = pontuar(c);
          if (sc > bestScore) {
            bestScore = sc;
            best = c;
          }
        }
        if (!best || bestScore <= -50) break;

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

  return semana;
}
