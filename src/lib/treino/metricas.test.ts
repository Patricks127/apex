import assert from "node:assert/strict";
import { test } from "node:test";
import { METRICAS } from "./metricas.ts";

test("METRICAS: exatamente as 8 medidas de balança + fita, pela ordem do ecrã", () => {
  assert.deepEqual(
    Object.values(METRICAS).map((m) => m.label),
    ["Peso", "Altura", "Cintura", "Abdómen", "Anca", "Peito", "Braço", "Coxa"],
  );
});

test("METRICAS: nada que exija bioimpedância, e o IMC não se regista (é calculado)", () => {
  const ids = Object.keys(METRICAS).join(" ");
  assert.doesNotMatch(ids, /fat|gordura|muscle|muscul|bmi|imc/i);
});

test("METRICAS: limites válidos e o exemplo de cada uma cabe nos próprios limites", () => {
  for (const [id, m] of Object.entries(METRICAS)) {
    assert.ok(m.min > 0 && m.max > m.min, id);
    const ex = Number(m.exemplo.replace(",", "."));
    assert.ok(ex >= m.min && ex <= m.max, `${id}: exemplo ${m.exemplo}`);
  }
});
