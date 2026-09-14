import test from "node:test";
import assert from "node:assert/strict";
import {
  GOALS,
  E1RM,
  SEX_MULT,
  MAJOR_MUSCLES,
  buildWeek,
  buildDay,
  weekSummary,
  weekMuscleFrequency,
  checkHypertrophyFrequency,
  estimateMaxes,
  baseLifts,
  maxesFromPRs,
  swapNote,
  round25,
  type Goal,
  type Level,
  type Sex,
  type MotorProfile,
} from "./index.ts";

const GOAL_IDS = GOALS.map((g) => g.id);
const DAYS = [3, 4, 5, 6];

function profile(over: Partial<MotorProfile> = {}): MotorProfile {
  return {
    goal: "hipertrofia",
    sex: "homem",
    level: "intermedio",
    daysPerWeek: 4,
    location: "ginasio",
    injuries: [],
    focus: [],
    ...over,
  };
}

// ===========================================================================
test("todos os objetivos estão cobertos", () => {
  assert.deepEqual(
    [...GOAL_IDS].sort(),
    ["calistenia", "corrida", "hibrido", "hipertrofia", "hyrox", "powerlifting"],
  );
});

// ===========================================================================
// Estrutura da semana — todas as combinações objetivo × dias
// ===========================================================================
test("estrutura válida em todas as combinações objetivo × dias", () => {
  for (const goal of GOAL_IDS) {
    for (const days of DAYS) {
      const plan = buildWeek(profile({ goal, daysPerWeek: days }));
      const label = `${goal}/${days}d`;

      assert.equal(plan.days.length, 7, `${label}: 7 dias`);

      const treino = plan.days.filter((d) => !d.rest);
      const descanso = plan.days.filter((d) => d.rest);
      assert.equal(treino.length, days, `${label}: ${days} dias de treino`);
      assert.ok(descanso.length >= 1, `${label}: pelo menos 1 dia de descanso`);

      for (const d of treino) {
        assert.ok(d.title && d.title.length > 0, `${label}: dia com título`);
        assert.ok(
          d.exercises && d.exercises.length >= 1,
          `${label}: ${d.title} tem exercícios`,
        );
        for (const e of d.exercises!) {
          assert.ok(e.sets.length >= 1, `${label}: ${e.name} tem séries`);
          assert.ok(e.name.length > 0, `${label}: exercício com nome`);
        }
        assert.ok(Array.isArray(d.warmup) && d.warmup.length > 0, `${label}: aquecimento`);
        assert.ok(Array.isArray(d.cooldown) && d.cooldown.length > 0, `${label}: retorno à calma`);
      }
    }
  }
});

// ===========================================================================
// REGRA CIENTÍFICA CRÍTICA — hipertrofia: cada grupo muscular ≥ 2×/semana
// ===========================================================================
test("hipertrofia (freq): cada grupo muscular grande treinado ≥ 2×/semana", () => {
  for (const days of DAYS) {
    const plan = buildWeek(profile({ goal: "hipertrofia", daysPerWeek: days, splitStyle: "freq" }));
    const res = checkHypertrophyFrequency(plan, 2);
    console.log(`  hipertrofia/${days}d  freq =`, JSON.stringify(res.freq));
    assert.ok(
      res.ok,
      `hipertrofia/${days}d — grupos abaixo de 2×: ${res.failing.join(", ") || "nenhum"} | freq=${JSON.stringify(res.freq)}`,
    );
    for (const m of MAJOR_MUSCLES) {
      assert.ok(
        (res.freq[m] || 0) >= 2,
        `hipertrofia/${days}d: ${m} = ${res.freq[m] || 0}×/semana (mínimo 2)`,
      );
    }
    // Posterior (isquios/lombar) também sai sempre ≥ 2×
    assert.ok(
      (res.freq["Posterior"] || 0) >= 2,
      `hipertrofia/${days}d: Posterior = ${res.freq["Posterior"] || 0}× (mínimo 2)`,
    );
    // Ombros só tem dia próprio a partir de 4 dias (no full-body de 3 é indireto)
    if (days >= 4) {
      assert.ok(
        (res.freq["Ombros"] || 0) >= 2,
        `hipertrofia/${days}d: Ombros = ${res.freq["Ombros"] || 0}× (mínimo 2)`,
      );
    }
  }
});

test("hipertrofia 3 dias é full-body: grupos grandes treinados 3×", () => {
  const plan = buildWeek(profile({ goal: "hipertrofia", daysPerWeek: 3, splitStyle: "freq" }));
  const freq = weekMuscleFrequency(plan);
  for (const m of ["Peito", "Costas", "Pernas"]) {
    assert.equal(freq[m], 3, `3 dias: ${m} = ${freq[m]}× (esperado 3)`);
  }
});

test("bro split é a exceção assumida: frequência 1×/semana", () => {
  for (const days of DAYS) {
    const plan = buildWeek(profile({ goal: "hipertrofia", daysPerWeek: days, splitStyle: "bro" }));
    const freq = weekMuscleFrequency(plan);
    assert.equal(freq["Peito"], 1, `bro/${days}d: Peito deveria ser 1×, foi ${freq["Peito"]}`);
    assert.equal(freq["Costas"], 1, `bro/${days}d: Costas deveria ser 1×, foi ${freq["Costas"]}`);
  }
});

test("frequência 2× também nos objetivos com base de força (powerlifting, híbrido) para os padrões principais", () => {
  for (const goal of ["powerlifting", "hibrido"] as Goal[]) {
    for (const days of DAYS) {
      const plan = buildWeek(profile({ goal, daysPerWeek: days }));
      const freq = weekMuscleFrequency(plan);
      // Pernas + Posterior (agachar/dobrar a anca) aparecem em vários dias
      const pernas = (freq["Pernas"] || 0) + (freq["Posterior"] || 0);
      assert.ok(pernas >= 2, `${goal}/${days}d: padrão de pernas/posterior ${pernas}× (mínimo 2)`);
    }
  }
});

// ===========================================================================
// Cargas — estimativa por nível/sexo e recordes reais
// ===========================================================================
test("estimateMaxes: homem intermédio = tabela E1RM", () => {
  assert.deepEqual(estimateMaxes({ sex: "homem", level: "intermedio" }), E1RM.intermedio);
});

test("estimateMaxes: mulher aplica o multiplicador por sexo", () => {
  const m = estimateMaxes({ sex: "mulher", level: "intermedio" });
  assert.equal(m.agachamento, E1RM.intermedio.agachamento * SEX_MULT.mulher.agachamento);
  assert.equal(m.supino, E1RM.intermedio.supino * SEX_MULT.mulher.supino);
});

test("baseLifts: usa o recorde real quando existe, estima o resto", () => {
  const { lvl, usedReal } = baseLifts({ sex: "homem", level: "avancado" }, { agachamento: 220 });
  assert.equal(lvl.agachamento, 220);
  assert.equal(lvl.supino, E1RM.avancado.supino);
  assert.deepEqual(usedReal, ["agachamento"]);
});

test("maxesFromPRs: mapeia texto livre para os 4 levantamentos e escolhe o máximo", () => {
  const out = maxesFromPRs([
    { lift: "Agachamento", value_kg: 150 },
    { lift: "agachamento (comp.)", value_kg: 160 },
    { lift: "Bench Press", value_kg: 120 },
    { lift: "Corrida 5k", value_kg: 0 },
    { lift: "peso morto", value_kg: 200 },
  ]);
  assert.equal(out.agachamento, 160);
  assert.equal(out.supino, 120);
  assert.equal(out.terra, 200);
  assert.equal(out.press, undefined);
});

test("maxesFromPRs: sem source (linhas anteriores à migração 016) conta como manual", () => {
  const out = maxesFromPRs([{ lift: "supino", value_kg: 100 }]);
  assert.equal(out.supino, 100);
});

test("maxesFromPRs: manual vence auto mesmo quando o auto é mais alto (guarda-costas 2 — nunca prescrever a partir de estimativa inflacionada)", () => {
  const out = maxesFromPRs([
    { lift: "supino", value_kg: 100, source: "manual" },
    { lift: "supino", value_kg: 140, source: "auto" },
  ]);
  assert.equal(out.supino, 100);
});

test("maxesFromPRs: auto só entra na ausência de qualquer manual para o mesmo levantamento", () => {
  const out = maxesFromPRs([
    { lift: "supino", value_kg: 90, source: "auto" },
    { lift: "agachamento", value_kg: 150, source: "manual" },
  ]);
  assert.equal(out.supino, 90);
  assert.equal(out.agachamento, 150);
});

test("maxesFromPRs: entre vários manuais do mesmo levantamento, ainda escolhe o máximo", () => {
  const out = maxesFromPRs([
    { lift: "supino", value_kg: 80, source: "manual" },
    { lift: "supino", value_kg: 85, source: "manual" },
  ]);
  assert.equal(out.supino, 85);
});

test("as cargas geradas saem dos 1RM (round25) e não passam a estimativa em bruto", () => {
  const plan = buildWeek(profile({ goal: "hipertrofia", daysPerWeek: 4, level: "intermedio", sex: "homem" }));
  const dia0 = plan.days.find((d) => !d.rest)!;
  const supino = dia0.exercises!.find((e) => e.name.toLowerCase().startsWith("supino com barra"))!;
  // pct 0.72 sobre E1RM.intermedio.supino (75) => round25(54) => 55
  assert.equal(supino.sets[0].w, round25(E1RM.intermedio.supino * 0.72));
  assert.equal(supino.sets[0].w, 55);
});

test("plano assinala quais as cargas que vieram de recordes reais", () => {
  const plan = buildWeek(profile({ goal: "powerlifting", daysPerWeek: 3 }), { agachamento: 200, supino: 140 });
  assert.deepEqual([...plan.meta.maxes.real].sort(), ["agachamento", "supino"]);
  assert.ok(plan.meta.maxes.estimated.includes("terra"));
});

// ===========================================================================
// Substituição de exercícios por lesão
// ===========================================================================
test("swapNote: notas de coaching por lesão", () => {
  assert.equal(swapNote("agachamento", ["joelho"]), "Protege o joelho");
  assert.equal(swapNote("terra", ["lombar"]), "Sem carga axial na lombar");
  assert.equal(swapNote("supino", ["ombro"]), "Pega neutra (poupa ombro)");
  assert.equal(swapNote("agachamento", []), null);
});

test("hipertrofia + lesão de ombro: supino com barra é substituído por variante segura", () => {
  const plan = buildWeek(profile({ goal: "hipertrofia", daysPerWeek: 4, injuries: ["ombro"] }));
  const exercicios = plan.days.filter((d) => !d.rest).flatMap((d) => d.exercises!);
  const supinoBarra = exercicios.find((e) => e.name === "Supino com barra");
  assert.equal(supinoBarra, undefined, "não devia restar 'Supino com barra' cru com lesão de ombro");
  const substituido = exercicios.find((e) => e.substituted && /neutra/i.test(e.name));
  assert.ok(substituido, "devia existir um exercício de peito substituído (pega neutra)");
});

test("lesão declarada adiciona mobilidade específica no aquecimento (rehab)", () => {
  const dia = buildDay(profile({ goal: "hipertrofia", daysPerWeek: 4, injuries: ["ombro"] }), 0)!;
  assert.ok(dia.rehab && dia.rehab.some((m) => /rotação externa/i.test(m.name)));
});

test("calistenia + lesão de ombro: escolhe a progressão poupada", () => {
  const plan = buildWeek(profile({ goal: "calistenia", daysPerWeek: 3, injuries: ["ombro"] }));
  const push = plan.days.find((d) => !d.rest && /push|empurrar/i.test(d.title || ""))!;
  assert.equal(push.exercises![0].name, "Flexões inclinadas");
});

test("substituir por lesão mantém o grupo muscular (não quebra a frequência 2×)", () => {
  const plan = buildWeek(profile({ goal: "hipertrofia", daysPerWeek: 5, injuries: ["ombro", "joelho", "lombar"], splitStyle: "freq" }));
  const res = checkHypertrophyFrequency(plan, 2);
  assert.ok(res.ok, `com lesões, grupos abaixo de 2×: ${res.failing.join(", ")} | ${JSON.stringify(res.freq)}`);
});

// ===========================================================================
// Trabalho de foco
// ===========================================================================
test("foco de glúteo (hipertrofia) acrescenta trabalho no dia de pernas", () => {
  const plan = buildWeek(profile({ goal: "hipertrofia", daysPerWeek: 4, focus: ["gluteo"] }));
  const comFoco = plan.days
    .filter((d) => !d.rest)
    .flatMap((d) => d.exercises!)
    .filter((e) => e.focusTag === "Glúteo");
  assert.ok(comFoco.length >= 1, "devia haver pelo menos um exercício marcado como foco de Glúteo");
});

test("foco não se aplica a objetivos não-hipertrofia", () => {
  const plan = buildWeek(profile({ goal: "powerlifting", daysPerWeek: 4, focus: ["gluteo", "peito"] }));
  const comFoco = plan.days.filter((d) => !d.rest).flatMap((d) => d.exercises ?? []).filter((e) => e.focusTag);
  assert.equal(comFoco.length, 0);
});

// ===========================================================================
// weekSummary / serialização
// ===========================================================================
test("weekSummary devolve 7 dias com nomes PT e marca descanso", () => {
  const s = weekSummary(profile({ daysPerWeek: 4 }));
  assert.equal(s.length, 7);
  assert.equal(s[0].dayName, "Segunda");
  assert.equal(s.filter((d) => d.rest).length, 3);
});

test("buildWeek produz JSON serializável (sem funções)", () => {
  const plan = buildWeek(profile({ goal: "hyrox", daysPerWeek: 5 }));
  const roundtrip = JSON.parse(JSON.stringify(plan));
  assert.deepEqual(roundtrip, plan);
});

test("dias fora de 3–6 são ajustados para o intervalo", () => {
  const p2 = buildWeek(profile({ daysPerWeek: 2 }));
  const p9 = buildWeek(profile({ daysPerWeek: 9 }));
  assert.equal(p2.meta.daysPerWeek, 3);
  assert.equal(p9.meta.daysPerWeek, 6);
  assert.equal(p2.days.filter((d) => !d.rest).length, 3);
  assert.equal(p9.days.filter((d) => !d.rest).length, 6);
});

// silencia "unused" em ambientes que reclamem dos type-only imports
void (null as unknown as Level);
void (null as unknown as Sex);
