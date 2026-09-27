import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularImc, imcAtual } from "./imc.ts";

test("calcularImc: peso / (altura em m)², arredondado a 1 casa", () => {
  assert.equal(calcularImc(70, 175), 22.9); // 70 / 1,75² = 22,857…
  assert.equal(calcularImc(60, 160), 23.4); // 60 / 1,6² = 23,4375
  assert.equal(calcularImc(90, 180), 27.8); // 90 / 1,8² = 27,777…
  assert.equal(calcularImc(50, 170), 17.3); // 50 / 1,7² = 17,301…
});

test("calcularImc: sem peso ou altura válidos → null (nunca um número inventado)", () => {
  assert.equal(calcularImc(null, 175), null);
  assert.equal(calcularImc(70, null), null);
  assert.equal(calcularImc(70, 0), null);
});

const m = (metric: string, value: number, recordedAt: string) => ({ id: recordedAt + metric, metric, value, recordedAt });

test("imcAtual: usa o registo MAIS RECENTE de peso e de altura", () => {
  const r = imcAtual([
    m("weight_kg", 80, "2026-08-01T10:00:00Z"),
    m("height_cm", 175, "2026-07-01T10:00:00Z"),
    m("weight_kg", 70, "2026-09-20T10:00:00Z"),
    m("waist_cm", 80, "2026-09-21T10:00:00Z"),
  ] as never);
  assert.deepEqual(r, { imc: 22.9, pesoKg: 70, alturaCm: 175, pesoEm: "2026-09-20T10:00:00Z" });
});

test("imcAtual: só com peso, ou só com altura → null (não se mostra)", () => {
  assert.equal(imcAtual([m("weight_kg", 70, "2026-09-20T10:00:00Z")] as never), null);
  assert.equal(imcAtual([m("height_cm", 175, "2026-09-20T10:00:00Z")] as never), null);
  assert.equal(imcAtual([]), null);
});
