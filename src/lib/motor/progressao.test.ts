import test from "node:test";
import assert from "node:assert/strict";
import {
  autoregulate,
  initProgression,
  advanceWeek,
  progressionFactor,
  buildDay,
  buildWeek,
  round25,
  E1RM,
  type MotorProfile,
  type Progression,
} from "./index.ts";

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

const supinoW = (dia: ReturnType<typeof buildDay>) =>
  dia!.exercises!.find((e) => e.name.toLowerCase().startsWith("supino com barra"))!.sets[0].w;

// ===========================================================================
// autoregulação
// ===========================================================================
test("autoregulate — séries com carga", () => {
  assert.equal(autoregulate({ w: 100, reps: 8 }, 9.5).w, round25(100 * 0.93)); // −7%
  assert.equal(autoregulate({ w: 100, reps: 8 }, 9).w, round25(100 * 0.96)); // −4%
  assert.equal(autoregulate({ w: 100, reps: 8 }, 6).w, round25(102.5)); // +2,5 kg
  assert.equal(autoregulate({ w: 100, reps: 8 }, 8).w, 100); // na zona → mantém
});

test("autoregulate — séries de peso corporal ajustam reps", () => {
  assert.equal(autoregulate({ w: null, reps: 10 }, 9.5).reps, 7);
  assert.equal(autoregulate({ w: null, reps: 10 }, 9).reps, 8);
  assert.equal(autoregulate({ w: null, reps: 10 }, 6).reps, 12);
  assert.equal(autoregulate({ w: null, reps: 10 }, 8).reps, 10);
  assert.equal(autoregulate({ w: null, reps: 4 }, 9.5).reps, 3); // nunca abaixo de 3
});

// ===========================================================================
// progressão semanal
// ===========================================================================
test("progressão dupla: primeiro reps (×2), depois carga", () => {
  const p0 = initProgression();
  const prof = profile({ level: "intermedio" }); // step = 2.5
  const p1 = advanceWeek(p0, prof, 7, 1); // fácil → +1 rep
  assert.equal(p1.repBonus, 1);
  assert.equal(p1.loadBonus, 0);
  assert.equal(p1.week, 2);
  const p2 = advanceWeek(p1, prof, 7, 1); // fácil → +1 rep (total 2)
  assert.equal(p2.repBonus, 2);
  assert.equal(p2.loadBonus, 0);
  const p3 = advanceWeek(p2, prof, 7, 1); // topo das reps → +carga, reps a zero
  assert.equal(p3.repBonus, 0);
  assert.equal(p3.loadBonus, 2.5);
});

test("RPE 8–8.5 → só sobe carga; RPE ≥9 → mantém; volume <80% → mantém", () => {
  const prof = profile();
  const meio = advanceWeek(initProgression(), prof, 8.3, 1);
  assert.equal(meio.loadBonus, 2.5);

  const duro = advanceWeek({ ...initProgression(), week: 2 }, prof, 9.2, 1);
  assert.equal(duro.loadBonus, 0);
  assert.equal(duro.streak, 0);

  const incompleto = advanceWeek(initProgression(), prof, 7, 0.5);
  assert.equal(incompleto.loadBonus, 0);
  assert.equal(incompleto.repBonus, 0);
});

test("iniciante progride +5 kg (step maior)", () => {
  const p = advanceWeek(initProgression(), profile({ level: "iniciante" }), 8.2, 1);
  assert.equal(p.loadBonus, 5);
});

test("deload automático a cada 5 semanas (completadas 5 → a seguinte é descarga)", () => {
  const prof = profile();
  let p: Progression = { ...initProgression(), week: 5 };
  p = advanceWeek(p, prof, 8, 1); // completou a semana 5 → semana 6 é deload
  assert.equal(p.week, 6);
  assert.equal(p.deloadWeek, true);
  assert.match(p.reason ?? "", /descarga programada/i);
  // nunca dois deloads seguidos
  const depois = advanceWeek(p, prof, 8, 1);
  assert.equal(depois.deloadWeek, false);
});

test("deload após 2 semanas seguidas com RPE ≥9", () => {
  const prof = profile();
  let p = advanceWeek(initProgression(), prof, 9.1, 1); // semana dura 1 (lastRpe=9.1)
  assert.equal(p.deloadWeek, false);
  p = advanceWeek(p, prof, 9.3, 1); // 2ª dura seguida → deload
  assert.equal(p.deloadWeek, true);
  assert.match(p.reason ?? "", /duas semanas duras/i);
});

test("progressionFactor converte loadBonus em multiplicador (âncora 105)", () => {
  assert.deepEqual(progressionFactor(null), { mult: 1, repAdd: 0 });
  assert.deepEqual(progressionFactor({ ...initProgression(), deloadWeek: true }), {
    mult: 0.9,
    repAdd: 0,
  });
  const f = progressionFactor({ ...initProgression(), loadBonus: 21, repBonus: 1 });
  assert.equal(f.mult, 1 + 21 / 105); // 1.2
  assert.equal(f.repAdd, 1);
});

// ===========================================================================
// EFEITO NAS CARGAS — registar semana fácil → avançar → cargas SOBEM
// ===========================================================================
test("semana fácil (RPE baixo) → avançar semana → as cargas sobem", () => {
  const prof = profile({ level: "intermedio", sex: "homem" });
  const maxes = { agachamento: 140, supino: 100 }; // recordes reais

  const supBase = supinoW(buildDay(prof, 0, maxes, { progression: initProgression() }))!;
  const agBase = buildDay(prof, 1, maxes, { progression: initProgression() })!
    .exercises!.find((e) => e.name === "Agachamento com barra")!.sets[0].w!;

  // 8 semanas de RPE 7 e volume completo (inclui 1 deload pelo meio).
  let prog = initProgression();
  for (let i = 0; i < 8; i++) prog = advanceWeek(prog, prof, 7, 1);
  assert.equal(prog.deloadWeek, false);
  assert.ok(prog.loadBonus >= 5, `loadBonus deveria acumular (foi ${prog.loadBonus})`);

  const semanaN = buildDay(prof, 0, maxes, { progression: prog })!;
  const supN = supinoW(semanaN)!;
  const agN = buildDay(prof, 1, maxes, { progression: prog })!
    .exercises!.find((e) => e.name === "Agachamento com barra")!.sets[0].w!;

  console.log(
    `  Agachamento — semana 1: ${agBase} kg  →  semana ${prog.week}: ${agN} kg\n` +
      `  Supino      — semana 1: ${supBase} kg  →  semana ${prog.week}: ${supN} kg  ` +
      `(loadBonus ${prog.loadBonus} kg, repBonus ${prog.repBonus})`,
  );
  assert.ok(agN > agBase, `agachamento devia subir: ${agBase} → ${agN}`);
  assert.ok(supN > supBase, `supino devia subir: ${supBase} → ${supN}`);

  // reps refletem o repBonus quando não zerou
  const repsBase = buildDay(prof, 0, maxes, { progression: initProgression() })!
    .exercises![0].sets[0].reps;
  assert.equal(semanaN.exercises![0].sets[0].reps, repsBase + prog.repBonus);
});

test("semana de descarga → cargas 10% abaixo da base", () => {
  const prof = profile();
  const maxes = { supino: 100 };
  const base = supinoW(buildDay(prof, 0, maxes, { progression: initProgression() }))!;
  const deload = supinoW(
    buildDay(prof, 0, maxes, { progression: { ...initProgression(), deloadWeek: true } }),
  )!;
  assert.ok(deload < base, `deload ${deload} deveria ser < base ${base}`);
  assert.equal(deload, round25(base * 0.9 / 1)); // −10% (mult 0.9 sobre a base)
});

// ===========================================================================
// EFEITO DO CHECK-IN NA SESSÃO SEGUINTE
// ===========================================================================
test("check-in com desconforto no ombro → −8% e aviso nos exercícios de peito/ombro", () => {
  const prof = profile();
  const maxes = { supino: 100, press: 60 };
  const normal = buildDay(prof, 0, maxes)!;
  const cauteloso = buildDay(prof, 0, maxes, { checkinZones: ["ombro"] })!;

  const sN = normal.exercises!.find((e) => e.name === "Supino com barra")!;
  const sC = cauteloso.exercises!.find((e) => e.name === "Supino com barra")!;
  assert.equal(sC.sets[0].w, round25(sN.sets[0].w! * 0.92), "supino a −8%");
  assert.equal(sC.caution, true);
  assert.match(sC.swap ?? "", /cautelar/i);

  assert.ok(
    cauteloso.adjustments!.some((a) => /−8%.*ombro/i.test(a)),
    "ajuste explica o −8% no ombro",
  );
  assert.ok(
    cauteloso.why!.some((w) => /check-in.*desconforto/i.test(w)),
    "o 'porquê' explica o efeito do check-in",
  );
});

test("check-in numa zona que não toca os músculos do dia → sem alteração", () => {
  const prof = profile();
  const maxes = { supino: 100 };
  // Dia 0 = Superior A (peito/costas/ombros/braços). 'joelho' → Pernas, não afeta.
  const a = buildDay(prof, 0, maxes)!;
  const b = buildDay(prof, 0, maxes, { checkinZones: ["joelho"] })!;
  assert.deepEqual(
    b.exercises!.map((e) => e.sets[0].w),
    a.exercises!.map((e) => e.sets[0].w),
  );
  assert.ok(!b.exercises!.some((e) => e.caution));
});

test("buildWeek expõe a semana de progressão e não coze o check-in", () => {
  const prof = profile();
  const prog = { ...initProgression(), week: 3, loadBonus: 5 };
  const plano = buildWeek(prof, { supino: 100 }, { progression: prog });
  assert.equal(plano.meta.week, 3);
  assert.equal(plano.meta.deloadWeek, false);
  // sem caution na semana guardada
  const temCaution = plano.days
    .filter((d) => !d.rest)
    .flatMap((d) => d.exercises ?? [])
    .some((e) => e.caution);
  assert.equal(temCaution, false);
});

// evita "unused" em type-only import quando o linter reclama
void E1RM;
