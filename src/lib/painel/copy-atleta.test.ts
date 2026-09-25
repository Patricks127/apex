import assert from "node:assert/strict";
import { test } from "node:test";
import { linhaMotivadora } from "./copy-atleta.ts";

test("linhaMotivadora: mesma data -> sempre a mesma frase (determinístico, não muda a cada reload)", () => {
  const d = new Date("2026-03-15T10:00:00Z");
  const a = linhaMotivadora(d);
  const b = linhaMotivadora(new Date("2026-03-15T23:59:00Z"));
  assert.equal(a, b);
  assert.equal(typeof a, "string");
  assert.ok(a.length > 0);
});

test("linhaMotivadora: dias diferentes podem dar frases diferentes (roda ao longo do tempo)", () => {
  const frases = new Set<string>();
  for (let dia = 1; dia <= 20; dia++) {
    frases.add(linhaMotivadora(new Date(`2026-01-${String(dia).padStart(2, "0")}T12:00:00Z`)));
  }
  assert.ok(frases.size > 1, "20 dias seguidos nunca variaram a frase");
});

test("linhaMotivadora: nunca rebenta em nenhum dia do ano (365/366 dias)", () => {
  for (let dia = 0; dia < 366; dia++) {
    const d = new Date(Date.UTC(2024, 0, 1) + dia * 86_400_000); // 2024 é bissexto
    const frase = linhaMotivadora(d);
    assert.equal(typeof frase, "string");
    assert.ok(frase.length > 0);
  }
});
