import assert from "node:assert/strict";
import { test } from "node:test";
import { estimativa1RM, estimarRecordesDaSessao } from "./estimativa-1rm.ts";

test("estimativa1RM: RIR=0 (RPE10) — Epley puro sobre as reps feitas", () => {
  // 100kg × 5 reps a RPE10 → RIR 0 → efetivas 5 → 100×(1+5/30) = 116.67 → round25 = 117.5? não, round25 arredonda a 2.5
  const v = estimativa1RM({ loadKg: 100, reps: 5, rpe: 10 });
  assert.ok(v != null);
  // 100*(1+5/30) = 116.666..., round25 → 117.5? round25 = round(x/2.5)*2.5, floor 10
  assert.equal(v, Math.max(10, Math.round((100 * (1 + 5 / 30)) / 2.5) * 2.5));
});

test("estimativa1RM: RIR ajusta reps efetivas (RPE8 → RIR2)", () => {
  const semRir = estimativa1RM({ loadKg: 100, reps: 5, rpe: 10 });
  const comRir = estimativa1RM({ loadKg: 100, reps: 5, rpe: 8 });
  assert.ok(comRir! > semRir!); // mais RIR → mais reps efetivas → 1RM estimado maior
});

test("estimativa1RM: reps efetivas >8 não estima (guarda-costas 1 — reps altas)", () => {
  // 10 reps a RPE10 (RIR 0) → 10 efetivas > 8 → null
  assert.equal(estimativa1RM({ loadKg: 60, reps: 10, rpe: 10 }), null);
  // 6 reps a RPE6 (RIR 4) → 10 efetivas > 8 → null
  assert.equal(estimativa1RM({ loadKg: 60, reps: 6, rpe: 6 }), null);
});

test("estimativa1RM: exatamente 8 reps efetivas ainda estima (limite inclusivo)", () => {
  // 8 reps a RPE10 → 8 efetivas → no limite, deve estimar
  assert.ok(estimativa1RM({ loadKg: 60, reps: 8, rpe: 10 }) != null);
});

test("estimativa1RM: falta de dados (carga/reps/RPE) → null", () => {
  assert.equal(estimativa1RM({ loadKg: null, reps: 5, rpe: 8 }), null);
  assert.equal(estimativa1RM({ loadKg: 60, reps: null, rpe: 8 }), null);
  assert.equal(estimativa1RM({ loadKg: 60, reps: 5, rpe: null }), null);
  assert.equal(estimativa1RM({ loadKg: 0, reps: 5, rpe: 8 }), null);
});

test("estimativa1RM: RPE fora de [6,10] → null", () => {
  assert.equal(estimativa1RM({ loadKg: 60, reps: 5, rpe: 5 }), null);
  assert.equal(estimativa1RM({ loadKg: 60, reps: 5, rpe: 10.5 }), null);
});

test("estimarRecordesDaSessao: só considera as 4 variantes principais", () => {
  const out = estimarRecordesDaSessao([
    { exercise_id: "supino_halteres", load_kg: 40, reps: 5, rpe: 8 }, // acessório, ignorado
    { exercise_id: "supino_barra", load_kg: 80, reps: 5, rpe: 8 },
    { exercise_id: "exercicio_desconhecido", load_kg: 999, reps: 1, rpe: 10 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].lift, "supino");
});

test("estimarRecordesDaSessao: ignora séries saltadas", () => {
  const out = estimarRecordesDaSessao([
    { exercise_id: "supino_barra", load_kg: 80, reps: 5, rpe: 8, skipped: true },
  ]);
  assert.equal(out.length, 0);
});

test("estimarRecordesDaSessao: ignora séries de reps altas (sem estimativa fiável)", () => {
  const out = estimarRecordesDaSessao([
    { exercise_id: "agachamento_barra_costas", load_kg: 60, reps: 15, rpe: 8 },
  ]);
  assert.equal(out.length, 0);
});

test("estimarRecordesDaSessao: com dois levantamentos principais na mesma sessão, devolve os dois", () => {
  const out = estimarRecordesDaSessao([
    { exercise_id: "supino_barra", load_kg: 80, reps: 5, rpe: 8 },
    { exercise_id: "terra_convencional", load_kg: 140, reps: 3, rpe: 9 },
  ]);
  const lifts = out.map((o) => o.lift).sort();
  assert.deepEqual(lifts, ["supino", "terra"]);
});
