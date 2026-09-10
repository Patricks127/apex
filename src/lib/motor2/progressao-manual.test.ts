import test from "node:test";
import assert from "node:assert/strict";
import { decidirProgressaoManual, progressaoManualFactor, aplicarProgressaoLeitura } from "./progressao-manual.ts";
import { initProgression, type DiaGerado, type Progression } from "../motor/index.ts";

const dia = (w: number | null, reps: number): DiaGerado => ({
  dayIndex: 0,
  dayName: "Segunda",
  dayShort: "Seg",
  rest: false,
  title: "Peito",
  exercises: [
    { name: "Supino com halteres", swap: null, sets: [{ w, reps, rpe: "RIR 1-3" }], rest: "90 s", muscle: "peito", bw: w == null, substituted: false },
  ],
});

test("dupla progressão: RIR baixo (fácil) sobe reps até 2×, depois carga", () => {
  let p = initProgression();
  p = decidirProgressaoManual(p, 7, 1);
  assert.equal(p.repBonus, 1);
  assert.equal(p.loadBonus, 0);
  p = decidirProgressaoManual(p, 7, 1);
  assert.equal(p.repBonus, 2);
  p = decidirProgressaoManual(p, 7, 1);
  assert.equal(p.repBonus, 0);
  assert.equal(p.loadBonus, 0.025);
});

test("RPE na zona ideal (7.5–8.5) → sobe carga direto, sem passar por reps", () => {
  let p = initProgression();
  p = decidirProgressaoManual(p, 8, 1);
  assert.equal(p.loadBonus, 0.025);
  assert.equal(p.repBonus, 0);
});

test("RPE alto (>8.5) → mantém, streak reinicia", () => {
  let p = { ...initProgression(), streak: 3 };
  p = decidirProgressaoManual(p, 9, 1);
  assert.equal(p.loadBonus, 0);
  assert.equal(p.repBonus, 0);
  assert.equal(p.streak, 0);
});

test("completion < 0.8 → mantém, mesmo com RPE baixo", () => {
  let p = initProgression();
  p = decidirProgressaoManual(p, 7, 0.5);
  assert.equal(p.loadBonus, 0);
  assert.equal(p.repBonus, 0);
});

test("descarga a cada 5 semanas", () => {
  let p = initProgression();
  for (let i = 0; i < 4; i++) p = decidirProgressaoManual(p, 8, 1);
  assert.equal(p.week, 5);
  assert.equal(p.deloadWeek, false);
  p = decidirProgressaoManual(p, 8, 1);
  assert.equal(p.deloadWeek, true);
  assert.equal(p.week, 6);
});

test("descarga após 2 semanas seguidas de RPE ≥9 (nunca duas descargas seguidas)", () => {
  let p = initProgression();
  p = decidirProgressaoManual(p, 9, 1);
  assert.equal(p.deloadWeek, false);
  p = decidirProgressaoManual(p, 9, 1);
  assert.equal(p.deloadWeek, true);
  // a seguir a uma descarga, mesmo com RPE alto outra vez, não descarrega logo
  p = decidirProgressaoManual(p, 9, 1);
  assert.equal(p.deloadWeek, false);
});

test("progressaoManualFactor: sem progression → identidade", () => {
  assert.deepEqual(progressaoManualFactor(null), { mult: 1, repAdd: 0 });
  assert.deepEqual(progressaoManualFactor(undefined), { mult: 1, repAdd: 0 });
});

test("progressaoManualFactor: loadBonus é fração direta, deload ignora bonus", () => {
  const prog: Progression = { ...initProgression(), loadBonus: 0.05, repBonus: 1 };
  assert.deepEqual(progressaoManualFactor(prog), { mult: 1.05, repAdd: 1 });
  const deload: Progression = { ...prog, deloadWeek: true };
  assert.deepEqual(progressaoManualFactor(deload), { mult: 0.9, repAdd: 0 });
});

test("aplicarProgressaoLeitura: sem progression, devolve o MESMO array (sem cópia desnecessária)", () => {
  const dias = [dia(50, 8)];
  assert.equal(aplicarProgressaoLeitura(dias, null), dias);
});

test("aplicarProgressaoLeitura: nunca muta o dias base", () => {
  const dias = [dia(50, 8)];
  const antes = JSON.stringify(dias);
  aplicarProgressaoLeitura(dias, { ...initProgression(), loadBonus: 0.1, repBonus: 1 });
  assert.equal(JSON.stringify(dias), antes);
});

test("aplicarProgressaoLeitura: aplica mult à carga (arredondado a 2.5) e soma reps", () => {
  const dias = [dia(50, 8)];
  const prog: Progression = { ...initProgression(), loadBonus: 0.05, repBonus: 1 };
  const out = aplicarProgressaoLeitura(dias, prog);
  assert.equal(out[0].exercises![0].sets[0].w, 52.5); // 50*1.05=52.5, já múltiplo de 2.5
  assert.equal(out[0].exercises![0].sets[0].reps, 9);
});

test("aplicarProgressaoLeitura: séries de peso corporal (w=null) só ganham reps, nunca carga", () => {
  const dias = [dia(null, 12)];
  const prog: Progression = { ...initProgression(), loadBonus: 0.1, repBonus: 2 };
  const out = aplicarProgressaoLeitura(dias, prog);
  assert.equal(out[0].exercises![0].sets[0].w, null);
  assert.equal(out[0].exercises![0].sets[0].reps, 14);
});

test("aplicarProgressaoLeitura: descarga reduz carga em 10% e não mexe em reps", () => {
  const dias = [dia(100, 8)];
  const prog: Progression = { ...initProgression(), loadBonus: 0.1, repBonus: 1, deloadWeek: true };
  const out = aplicarProgressaoLeitura(dias, prog);
  assert.equal(out[0].exercises![0].sets[0].w, 90);
  assert.equal(out[0].exercises![0].sets[0].reps, 8);
});

test("aplicarProgressaoLeitura: dia de descanso passa intocado", () => {
  const descanso: DiaGerado = { dayIndex: 1, dayName: "Terça", dayShort: "Ter", rest: true };
  const out = aplicarProgressaoLeitura([descanso], { ...initProgression(), loadBonus: 0.5 });
  assert.deepEqual(out[0], descanso);
});
