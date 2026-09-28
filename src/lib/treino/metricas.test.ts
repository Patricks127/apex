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

test("METRICAS = a lista da CHECK de body_metrics (migração 022) — nunca divergem", async () => {
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../../../supabase/migrations/022_body_metrics_metric_check.sql", import.meta.url), "utf8");
  const naCheck = [...sql.slice(sql.indexOf("add constraint")).matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);
  assert.deepEqual(naCheck.sort(), Object.keys(METRICAS).sort());
});
