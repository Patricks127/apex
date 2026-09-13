import test from "node:test";
import assert from "node:assert/strict";
import { avaliarAtencao } from "./atencao.ts";

test("aluno em dia: sem motivos", () => {
  const m = avaliarAtencao({ diasDesdeUltimaSessao: 2, checkinsComDesconforto: 0, completionMedia: 0.95 });
  assert.deepEqual(m, []);
});

test("nunca treinou → inativo", () => {
  const m = avaliarAtencao({ diasDesdeUltimaSessao: null, checkinsComDesconforto: 0, completionMedia: null });
  assert.deepEqual(m, ["inativo"]);
});

test("mais de 10 dias sem treinar → inativo", () => {
  assert.deepEqual(
    avaliarAtencao({ diasDesdeUltimaSessao: 11, checkinsComDesconforto: 0, completionMedia: 0.9 }).includes("inativo"),
    true,
  );
});

test("exatamente 10 dias ainda NÃO é inativo (o limiar é '> 10', não '>=')", () => {
  const m = avaliarAtencao({ diasDesdeUltimaSessao: 10, checkinsComDesconforto: 0, completionMedia: 0.9 });
  assert.equal(m.includes("inativo"), false);
});

test("2 check-ins com desconforto → dor recorrente", () => {
  const m = avaliarAtencao({ diasDesdeUltimaSessao: 1, checkinsComDesconforto: 2, completionMedia: 1 });
  assert.deepEqual(m, ["dor_recorrente"]);
});

test("1 check-in com desconforto não basta (recorrente = ≥2)", () => {
  const m = avaliarAtencao({ diasDesdeUltimaSessao: 1, checkinsComDesconforto: 1, completionMedia: 1 });
  assert.deepEqual(m, []);
});

test("completion médio abaixo de 75% → adesão baixa", () => {
  const m = avaliarAtencao({ diasDesdeUltimaSessao: 2, checkinsComDesconforto: 0, completionMedia: 0.6 });
  assert.deepEqual(m, ["adesao_baixa"]);
});

test("inativo NÃO acumula adesão baixa — sem sessões recentes a média não informa nada", () => {
  const m = avaliarAtencao({ diasDesdeUltimaSessao: 30, checkinsComDesconforto: 0, completionMedia: 0.1 });
  assert.deepEqual(m, ["inativo"]);
});

test("pode acumular dor recorrente + adesão baixa ao mesmo tempo (não são exclusivos)", () => {
  const m = avaliarAtencao({ diasDesdeUltimaSessao: 3, checkinsComDesconforto: 3, completionMedia: 0.5 });
  assert.deepEqual(m.sort(), ["adesao_baixa", "dor_recorrente"]);
});
