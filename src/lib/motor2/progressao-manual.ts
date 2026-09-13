/* ============================================================
   APEX — Motor v2 · Progressão de um plano de PT

   Um plano de PT (atribuirPlanoPt, em src/app/actions/treino.ts) não tem
   perfil nem seleção do motor por trás — os números em `days` são os que o
   PT escreveu à mão, e ficam IMUTÁVEIS por qualquer via que não seja o
   próprio PT (migrações 013/014: só `training_plans.progression` é gravável
   pelo aluno). A progressão do aluno vive inteiramente em `progression`; as
   cargas/reps "de agora" calculam-se em LEITURA, a partir do `days` base +
   `progression` — nunca se escreve de volta em `days`.

   Espelha o que o motor v1 já faz para os planos gerados: `progressionFactor`
   converte o estado acumulado num multiplicador aplicado FRESCO de cada vez
   (nunca muta a seleção guardada). Aqui é o mesmo princípio, só que
   `loadBonus` passa a ser uma FRAÇÃO acumulada (não kg sobre uma âncora de
   105 kg — não há um "levantamento âncora" comum a exercícios tão diversos
   como os que um PT escolhe).
   ============================================================ */

import { round25, type DiaGerado, type Injury, type PlanoGerado, type Progression } from "../motor/index.ts";
import { EXERCICIOS } from "./exercicios.ts";

const JANELA_DESCARGA = 5; // cadência igual à de advanceWeek (motor v1)
const PASSO_CARGA = 0.025; // +2,5% nas séries com carga, por semana de progresso
const FATOR_CAUTELA = 0.92; // -8%, igual ao "carga cautelar" do motor v1

/**
 * Decide a semana seguinte de um plano de PT a partir do desempenho da
 * semana atual. Mesma cadência de descarga (a cada 5 semanas, ou 2 semanas
 * seguidas de RPE ≥9) e os mesmos limiares de RPE que `advanceWeek` (motor
 * v1) já usa — reescrita local pequena em vez de reaproveitar `advanceWeek`
 * diretamente: esse espera `{goal, level}` para indexar o passo em kg, que
 * um plano de PT não tem (os 35 testes de `advanceWeek` continuam intocados).
 */
export function decidirProgressaoManual(
  prog: Progression,
  avgRpe: number,
  completion: number,
): Progression {
  const p: Progression = { ...prog, history: [...prog.history] };
  p.history.push({ week: p.week, avgRpe, completion });

  const duasSemanasDuras = !prog.deloadWeek && prog.lastRpe != null && avgRpe >= 9 && prog.lastRpe >= 9;
  const descargaDevida = !prog.deloadWeek && (p.week % JANELA_DESCARGA === 0 || duasSemanasDuras);

  if (descargaDevida) {
    p.week += 1;
    p.deloadWeek = true;
    p.lastRpe = null;
    p.reason = duasSemanasDuras
      ? "Duas semanas duras seguidas — semana de descarga para recuperares e voltares mais forte."
      : `Semana de descarga programada (a cada ${JANELA_DESCARGA} semanas) — gestão de fadiga acumulada.`;
    return p;
  }
  p.deloadWeek = false;

  if (completion < 0.8) {
    p.reason = "Não completaste todas as séries — mantenho a carga esta semana para consolidares.";
  } else if (avgRpe <= 7.5) {
    // Fácil — progressão dupla: primeiro reps, depois carga (igual ao motor).
    if (p.repBonus < 2) {
      p.repBonus += 1;
      p.streak += 1;
      p.reason = "Semana passada esteve fácil (RPE baixo) — +1 rep por série (progressão dupla).";
    } else {
      p.repBonus = 0;
      p.loadBonus += PASSO_CARGA;
      p.streak += 1;
      p.reason = `Atingiste o topo das reps — subo a carga +${Math.round(PASSO_CARGA * 100)}% e recomeço o ciclo de reps.`;
    }
  } else if (avgRpe <= 8.5) {
    p.loadBonus += PASSO_CARGA;
    p.streak += 1;
    p.reason = `Na zona ideal de esforço — progressão de +${Math.round(PASSO_CARGA * 100)}%.`;
  } else {
    p.streak = 0;
    p.reason = "Semana exigente (RPE alto) — mantenho a carga para a dominares antes de subir.";
  }
  p.week += 1;
  p.lastRpe = avgRpe;
  return p;
}

/** Fator aplicado às cargas/reps de um plano de PT — paralelo a
 *  `progressionFactor` (motor), só que `loadBonus` já é uma fração. */
export function progressaoManualFactor(prog?: Progression | null): { mult: number; repAdd: number } {
  if (!prog) return { mult: 1, repAdd: 0 };
  if (prog.deloadWeek) return { mult: 0.9, repAdd: 0 };
  return { mult: 1 + (prog.loadBonus || 0), repAdd: prog.repBonus || 0 };
}

/**
 * Função PURA de leitura — nunca escreve na BD. Devolve uma CÓPIA de
 * `diasBase` (o que o PT prescreveu) com as cargas/reps ajustadas pelo
 * estado de progressão corrente. `diasBase` nunca é mutado.
 */
export function aplicarProgressaoLeitura(diasBase: DiaGerado[], prog?: Progression | null): DiaGerado[] {
  const { mult, repAdd } = progressaoManualFactor(prog);
  if (mult === 1 && repAdd === 0) return diasBase;
  return diasBase.map((d) => {
    if (d.rest || !d.exercises) return d;
    return {
      ...d,
      exercises: d.exercises.map((e) => ({
        ...e,
        sets: e.sets.map((s) => ({
          ...s,
          w: s.w != null ? round25(s.w * mult) : s.w,
          reps: s.reps > 0 ? s.reps + repAdd : s.reps,
        })),
      })),
    };
  });
}

/**
 * Porta única para exibir um `PlanoGerado`: se for de um PT (`meta.origem
 * === "pt"`), aplica a progressão corrente em leitura (`aplicarProgressao-
 * Leitura`) e atualiza `meta.week`/`deloadWeek` para refletir o estado
 * atual. Um plano do motor já vem com a progressão aplicada na própria
 * geração (`gerarPlanoV2`) — devolve-se tal e qual.
 */
export function planoParaExibir(plano: PlanoGerado, prog: Progression | null): PlanoGerado {
  if (plano.meta.origem !== "pt") return plano;
  const semana = prog?.week ?? plano.meta.week;
  const descarga = prog?.deloadWeek ?? plano.meta.deloadWeek;
  return {
    ...plano,
    meta: { ...plano.meta, week: semana, deloadWeek: descarga },
    days: aplicarProgressaoLeitura(plano.days, prog),
  };
}

/**
 * "Carga cautelar" (−8%) em LEITURA, sobre o snapshot gravado — nunca
 * regenera nada. Usada tanto para um plano de PT como para um gerado pelo
 * motor v2 (ambos ligam os exercícios a `exercicioId`, a mesma base
 * EXERCICIOS). Só se aplica a exercícios cuja `contraindicacoes` toque numa
 * das zonas reportadas no check-in mais recente. Só usada na vista de um
 * dia específico (`/treino/[dia]`) — `/plano` mostra a semana sem isto.
 */
export function aplicarCautelaLeitura(dias: DiaGerado[], checkinZones: Injury[]): DiaGerado[] {
  if (!checkinZones.length) return dias;
  const zonas = new Set<string>(checkinZones);
  return dias.map((d) => {
    if (d.rest || !d.exercises) return d;
    let mudou = false;
    const exercises = d.exercises.map((e) => {
      if (!e.exercicioId) return e;
      const ex = EXERCICIOS.find((x) => x.id === e.exercicioId);
      if (!ex || !ex.contraindicacoes.some((z) => zonas.has(z))) return e;
      mudou = true;
      return { ...e, caution: true, sets: e.sets.map((s) => ({ ...s, w: s.w != null ? round25(s.w * FATOR_CAUTELA) : s.w })) };
    });
    return mudou ? { ...d, exercises } : d;
  });
}
