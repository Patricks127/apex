import test from "node:test";
import assert from "node:assert/strict";
import { avaliarAtencao } from "./atencao.ts";

test("aluno em dia: sem motivos", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 2,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: 0.95,
    rpeMedioNaJanela: 7.5,
  });
  assert.deepEqual(m, []);
});

test("nunca treinou → inativo", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: null,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: null,
    rpeMedioNaJanela: null,
  });
  assert.deepEqual(m, ["inativo"]);
});

test("mais de 10 dias sem treinar → inativo", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 11,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: 0.9,
    rpeMedioNaJanela: 7,
  });
  assert.equal(m.includes("inativo"), true);
});

test("exatamente 10 dias ainda NÃO é inativo (o limiar é '> 10', não '>=')", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 10,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: 0.9,
    rpeMedioNaJanela: 7,
  });
  assert.equal(m.includes("inativo"), false);
});

test("2 check-ins com desconforto NA JANELA → dor recorrente", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 1,
    checkinsComDesconfortoNaJanela: 2,
    completionMediaNaJanela: 1,
    rpeMedioNaJanela: 7,
  });
  assert.deepEqual(m, ["dor_recorrente"]);
});

test("1 check-in não basta (recorrente = ≥2)", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 1,
    checkinsComDesconfortoNaJanela: 1,
    completionMediaNaJanela: 1,
    rpeMedioNaJanela: 7,
  });
  assert.deepEqual(m, []);
});

test("completion médio NA JANELA abaixo de 75% → adesão baixa", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 2,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: 0.6,
    rpeMedioNaJanela: 7,
  });
  assert.deepEqual(m, ["adesao_baixa"]);
});

test("uma sessão antiga incompleta FORA da janela não conta — quem chama já não a inclui na média", () => {
  // completionMediaNaJanela vem já calculado só com sessões da janela; se
  // a única sessão incompleta ficou de fora, chega aqui como 1 (ou null).
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 3,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: 1,
    rpeMedioNaJanela: 7,
  });
  assert.deepEqual(m, []);
});

test("RPE médio ≥9 na janela → esforço muito alto", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 1,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: 1,
    rpeMedioNaJanela: 9,
  });
  assert.deepEqual(m, ["esforco_alto"]);
});

test("RPE 8.9 não chega (limiar é 9)", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 1,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: 1,
    rpeMedioNaJanela: 8.9,
  });
  assert.deepEqual(m, []);
});

test("rpeMedioNaJanela null (menos de 2 sessões com RPE) → nunca acende esforço_alto, mesmo que a única sessão fosse RPE 10", () => {
  // é o CALLER que decide null quando há <2 amostras — aqui só confirmamos
  // que null nunca aciona o motivo.
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 1,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: 1,
    rpeMedioNaJanela: null,
  });
  assert.deepEqual(m, []);
});

test("inativo NÃO acumula adesão baixa nem esforço alto — sem sessões na janela nenhuma média informa nada", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 30,
    checkinsComDesconfortoNaJanela: 0,
    completionMediaNaJanela: 0.1,
    rpeMedioNaJanela: 9.5,
  });
  assert.deepEqual(m, ["inativo"]);
});

test("dor recorrente NÃO depende de estar ativo — pode acontecer mesmo perto do limiar de inatividade", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 10,
    checkinsComDesconfortoNaJanela: 3,
    completionMediaNaJanela: 0.5,
    rpeMedioNaJanela: 9,
  });
  assert.deepEqual(m.sort(), ["adesao_baixa", "dor_recorrente", "esforco_alto"]);
});

test("pode acumular vários motivos ao mesmo tempo (não são exclusivos)", () => {
  const m = avaliarAtencao({
    diasDesdeUltimaSessao: 3,
    checkinsComDesconfortoNaJanela: 3,
    completionMediaNaJanela: 0.5,
    rpeMedioNaJanela: 9.2,
  });
  assert.deepEqual(m.sort(), ["adesao_baixa", "dor_recorrente", "esforco_alto"]);
});
