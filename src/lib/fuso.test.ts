// O servidor da Vercel corre em UTC — os testes também, para que um bug de
// fuso NÃO fique escondido por esta máquina estar em Lisboa.
process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { test } from "node:test";
import { chaveDiaLisboa, formatarData, formatarHora, partesLisboa } from "./fuso.ts";

// Domingo 27/09/2026, 23:30 UTC = SEGUNDA 28/09/2026, 00:30 em Lisboa (verão, UTC+1).
const MEIA_NOITE_LISBOA = "2026-09-27T23:30:00Z";

test("fuso: o ambiente de teste está mesmo em UTC (senão os testes abaixo não provam nada)", () => {
  assert.equal(new Date(MEIA_NOITE_LISBOA).getDate(), 27);
  assert.equal(new Date(MEIA_NOITE_LISBOA).getHours(), 23);
});

test("partesLisboa: 23:30 UTC de domingo é segunda, dia 28, em Lisboa", () => {
  assert.deepEqual(partesLisboa(MEIA_NOITE_LISBOA), { ano: 2026, mes: 9, dia: 28, diaSemana: 0 });
});

test("chaveDiaLisboa: dia de Lisboa, não o de UTC", () => {
  assert.equal(chaveDiaLisboa(MEIA_NOITE_LISBOA), "2026-09-28");
  // inverno (UTC+0): 23:30 UTC ainda é o mesmo dia em Lisboa
  assert.equal(chaveDiaLisboa("2026-01-10T23:30:00Z"), "2026-01-10");
  // passagem de ano
  assert.equal(chaveDiaLisboa("2026-12-31T23:30:00Z"), "2026-12-31");
});

test("formatarData: mostra o dia de Lisboa", () => {
  assert.equal(formatarData(MEIA_NOITE_LISBOA), "28/09/2026");
  assert.equal(formatarData(MEIA_NOITE_LISBOA, { day: "numeric", month: "short" }), "28/09");
  assert.equal(formatarData(MEIA_NOITE_LISBOA, { day: "numeric", month: "long" }), "28 de setembro");
});

test("formatarHora: hora de Lisboa (00:30), não a de UTC (23:30)", () => {
  assert.equal(formatarHora(MEIA_NOITE_LISBOA), "00:30");
  assert.equal(formatarHora("2026-07-15T12:05:00Z"), "13:05");
  assert.equal(formatarHora("2026-01-15T12:05:00Z"), "12:05");
});
