import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparVolumePorSemana } from "./volume-historico.ts";

test("soma o volume das sessões da mesma semana", () => {
  const out = agruparVolumePorSemana([
    { weekNumber: 1, volumeKg: 1000, isDeload: false },
    { weekNumber: 1, volumeKg: 1500, isDeload: false },
    { weekNumber: 2, volumeKg: 2000, isDeload: false },
  ]);
  assert.deepEqual(out, [
    { weekNumber: 1, volumeKg: 2500, isDeload: false, nSessoes: 2, ultimaSessao: null },
    { weekNumber: 2, volumeKg: 2000, isDeload: false, nSessoes: 1, ultimaSessao: null },
  ]);
});

test("isDeload fica true se QUALQUER sessão da semana foi descarga", () => {
  const out = agruparVolumePorSemana([
    { weekNumber: 5, volumeKg: 900, isDeload: true },
    { weekNumber: 5, volumeKg: 850, isDeload: false },
  ]);
  assert.equal(out[0].isDeload, true);
});

test("sessões sem weekNumber ficam de fora (planos antigos)", () => {
  const out = agruparVolumePorSemana([
    { weekNumber: null, volumeKg: 5000, isDeload: false },
    { weekNumber: 1, volumeKg: 1000, isDeload: false },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].weekNumber, 1);
});

test("devolve ordenado por semana ascendente, independentemente da ordem de entrada", () => {
  const out = agruparVolumePorSemana([
    { weekNumber: 3, volumeKg: 100, isDeload: false },
    { weekNumber: 1, volumeKg: 100, isDeload: false },
    { weekNumber: 2, volumeKg: 100, isDeload: false },
  ]);
  assert.deepEqual(
    out.map((s) => s.weekNumber),
    [1, 2, 3],
  );
});

test("ultimaSessao: a data mais recente da semana (para saber se ainda está em curso)", () => {
  const out = agruparVolumePorSemana([
    { weekNumber: 3, volumeKg: 1000, isDeload: false, performedAt: "2026-09-20T10:00:00Z" },
    { weekNumber: 3, volumeKg: 1000, isDeload: false, performedAt: "2026-09-24T10:00:00Z" },
    { weekNumber: 3, volumeKg: 1000, isDeload: false, performedAt: "2026-09-22T10:00:00Z" },
  ]);
  assert.equal(out[0].ultimaSessao, "2026-09-24T10:00:00Z");
});
