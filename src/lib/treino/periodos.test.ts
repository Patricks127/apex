import assert from "node:assert/strict";
import { test } from "node:test";
import { PERIODOS, filtrarPeriodo, inicioPeriodo, minDiasTendencia } from "./periodos.ts";

const AGORA = new Date("2026-09-28T12:00:00Z");
const d = (s: string) => ({ quando: `${s}T10:00:00Z` });

test("PERIODOS: 7 d · 30 d · 3 m · 6 m · 1 ano, por esta ordem", () => {
  assert.deepEqual(PERIODOS.map((p) => p.rotulo), ["7 d", "30 d", "3 m", "6 m", "1 ano"]);
});

test("filtrarPeriodo: só o que está dentro do período", () => {
  const itens = [d("2026-09-27"), d("2026-09-20"), d("2026-09-01"), d("2026-07-15"), d("2025-12-01")];
  const n = (id: Parameters<typeof filtrarPeriodo>[2]) => filtrarPeriodo(itens, (i) => i.quando, id, AGORA).length;
  assert.equal(n("7d"), 1);
  assert.equal(n("30d"), 3);
  assert.equal(n("3m"), 4);
  assert.equal(n("1a"), 5);
});

test("inicioPeriodo e minDiasTendencia", () => {
  assert.equal(inicioPeriodo("7d", AGORA), Date.parse("2026-09-21T12:00:00Z"));
  assert.equal(minDiasTendencia("7d"), 3);
  assert.equal(minDiasTendencia("30d"), 7);
});
