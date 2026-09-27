// O servidor da Vercel corre em UTC — os testes também, para que um bug de
// fuso NÃO fique escondido por esta máquina estar em Lisboa.
process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chaveSemanaIso,
  agruparAdesaoPorSemanaCalendario,
  pontosAdesaoComFallback,
  direcaoAdesao,
  estadoAdesao,
  JANELAS_ADESAO_SEMANAS,
} from "./adesao-semanal.ts";

// Datas de referência conhecidas da norma ISO 8601 (semana começa
// segunda; a semana 1 é a que contém a primeira quinta-feira do ano).
// Movidos de tendencia-volume.test.ts quando chaveSemanaIso passou a
// viver aqui (o único módulo que ainda a usava).
test("chaveSemanaIso: casos de referência da norma ISO 8601", () => {
  assert.equal(chaveSemanaIso("2026-01-01T12:00:00Z"), "2026-W01");
  assert.equal(chaveSemanaIso("2025-12-29T12:00:00Z"), "2026-W01"); // segunda da mesma semana ISO que 1 jan 2026
  assert.equal(chaveSemanaIso("2026-01-05T12:00:00Z"), "2026-W02");
  assert.equal(chaveSemanaIso("2024-12-31T12:00:00Z"), "2025-W01");
  // 1 jan 2027 é sexta-feira — pertence à última semana ISO de 2026, não à W01 de 2027
  assert.equal(chaveSemanaIso("2027-01-01T12:00:00Z"), "2026-W53");
});

// "Agora" fixo numa quinta-feira (2026-W38) para todos os testes datarem
// de forma previsível.
const AGORA = new Date("2026-09-17T12:00:00Z");

test("agruparAdesaoPorSemanaCalendario: preenche TODAS as semanas da janela, mesmo sem sessão (0 é um ponto real)", () => {
  const out = agruparAdesaoPorSemanaCalendario([], 3, 6, AGORA);
  assert.equal(out.length, 6);
  assert.ok(out.every((p) => p.feitos === 0 && p.previstos === 3 && p.pct === 0));
});

test("agruparAdesaoPorSemanaCalendario: conta sessões da semana certa, termina na semana atual", () => {
  const out = agruparAdesaoPorSemanaCalendario(
    [
      { performedAt: "2026-09-15T10:00:00Z" }, // W38 (semana de "agora")
      { performedAt: "2026-09-16T10:00:00Z" }, // W38
      { performedAt: "2026-09-08T10:00:00Z" }, // W37
    ],
    3,
    6,
    AGORA,
  );
  assert.equal(out.length, 6);
  const ultima = out[out.length - 1];
  const penultima = out[out.length - 2];
  assert.equal(ultima.feitos, 2);
  assert.equal(ultima.pct, 2 / 3);
  assert.equal(penultima.feitos, 1);
});

test("agruparAdesaoPorSemanaCalendario: previstos=0 nunca divide por zero", () => {
  const out = agruparAdesaoPorSemanaCalendario([{ performedAt: "2026-09-15T10:00:00Z" }], 0, 6, AGORA);
  assert.ok(out.every((p) => p.pct === 0));
});

test("agruparAdesaoPorSemanaCalendario: respeita o nº de janelas pedido", () => {
  const out = agruparAdesaoPorSemanaCalendario([], 3, 12, AGORA);
  assert.equal(out.length, 12);
  assert.equal(agruparAdesaoPorSemanaCalendario([], 3, undefined, AGORA).length, JANELAS_ADESAO_SEMANAS);
});

test("direcaoAdesao: sem pontos, ou menos de 2 semanas com treino → sem_dados", () => {
  assert.equal(direcaoAdesao([]), "sem_dados");
  const umaSoSemanaComTreino = agruparAdesaoPorSemanaCalendario([{ performedAt: "2026-09-15T10:00:00Z" }], 3, 6, AGORA);
  assert.equal(direcaoAdesao(umaSoSemanaComTreino), "sem_dados");
});

test("direcaoAdesao: subida clara (+8pp ou mais entre a primeira e a última semana)", () => {
  const sessoes = [
    { performedAt: "2026-08-11T10:00:00Z" }, // W33, 1 sessão
    { performedAt: "2026-09-14T10:00:00Z" }, // W38 (atual), 3 sessões
    { performedAt: "2026-09-15T10:00:00Z" },
    { performedAt: "2026-09-16T10:00:00Z" },
  ];
  const pontos = agruparAdesaoPorSemanaCalendario(sessoes, 3, 6, AGORA);
  assert.equal(direcaoAdesao(pontos), "subida");
});

test("direcaoAdesao: descida clara (-8pp ou menos)", () => {
  const sessoes = [
    { performedAt: "2026-08-11T10:00:00Z" }, // W33, 3 sessões
    { performedAt: "2026-08-12T10:00:00Z" },
    { performedAt: "2026-08-13T10:00:00Z" },
    { performedAt: "2026-09-15T10:00:00Z" }, // W38 (atual), 1 sessão
  ];
  const pontos = agruparAdesaoPorSemanaCalendario(sessoes, 3, 6, AGORA);
  assert.equal(direcaoAdesao(pontos), "descida");
});

test("direcaoAdesao: variação pequena → estável", () => {
  const sessoes = [
    { performedAt: "2026-08-11T10:00:00Z" }, // W33, 2 sessões
    { performedAt: "2026-08-12T10:00:00Z" },
    { performedAt: "2026-09-15T10:00:00Z" }, // W38 (atual), 2 sessões
    { performedAt: "2026-09-16T10:00:00Z" },
  ];
  const pontos = agruparAdesaoPorSemanaCalendario(sessoes, 3, 6, AGORA);
  assert.equal(direcaoAdesao(pontos), "estavel");
});

test("estadoAdesao: sem_dados propaga", () => {
  assert.equal(estadoAdesao([], "sem_dados"), "sem_dados");
});

test("estadoAdesao: nível atual baixo (<75%) → 'baixa', mesmo que a direção seja 'estavel' ou 'subida'", () => {
  // sempre a 1 de 3 (33%) — estável, mas baixo há semanas: mais urgente
  // do que "a descer" a partir de um nível alto.
  const sessoes = Array.from({ length: 6 }, (_, i) => ({
    performedAt: new Date(AGORA.getTime() - i * 7 * 86_400_000).toISOString(),
  }));
  const pontos = agruparAdesaoPorSemanaCalendario(sessoes, 3, 6, AGORA);
  assert.equal(direcaoAdesao(pontos), "estavel");
  assert.equal(estadoAdesao(pontos, "estavel"), "baixa");
});

test("estadoAdesao: a descer mas ainda acima do limiar (75%) → 'a_descer', não 'baixa'", () => {
  const sessoes = [
    { performedAt: "2026-08-11T10:00:00Z" }, // W33, 5 de 5 (100%)
    { performedAt: "2026-08-11T11:00:00Z" },
    { performedAt: "2026-08-11T12:00:00Z" },
    { performedAt: "2026-08-11T13:00:00Z" },
    { performedAt: "2026-08-11T14:00:00Z" },
    { performedAt: "2026-09-15T10:00:00Z" }, // W38 (atual), 4 de 5 (80%) — desce 20pp, mas continua ≥75%
    { performedAt: "2026-09-15T11:00:00Z" },
    { performedAt: "2026-09-15T12:00:00Z" },
    { performedAt: "2026-09-15T13:00:00Z" },
  ];
  const pontos = agruparAdesaoPorSemanaCalendario(sessoes, 5, 6, AGORA);
  assert.equal(pontos[pontos.length - 1].pct, 0.8);
  assert.equal(direcaoAdesao(pontos), "descida");
  assert.equal(estadoAdesao(pontos, "descida"), "a_descer");
});

test("estadoAdesao: nível atual bom e a subir/estável → 'boa'", () => {
  const sessoes = [
    { performedAt: "2026-08-11T10:00:00Z" },
    { performedAt: "2026-09-14T10:00:00Z" },
    { performedAt: "2026-09-15T10:00:00Z" },
    { performedAt: "2026-09-16T10:00:00Z" },
  ];
  const pontos = agruparAdesaoPorSemanaCalendario(sessoes, 3, 6, AGORA);
  assert.equal(pontos[pontos.length - 1].pct, 1);
  assert.equal(estadoAdesao(pontos, direcaoAdesao(pontos)), "boa");
});

// pontosAdesaoComFallback — sem plano estruturado (inclui quem só tem
// plano em PDF: a app não lê o conteúdo, não sabe o previsto real).
test("pontosAdesaoComFallback: com plano estruturado, é idêntico à chamada direta (previsto real)", () => {
  const sessoes = [{ performedAt: "2026-09-15T10:00:00Z" }, { performedAt: "2026-09-16T10:00:00Z" }];
  const comPlano = pontosAdesaoComFallback(sessoes, 3, 6, AGORA);
  const direto = agruparAdesaoPorSemanaCalendario(sessoes, 3, 6, AGORA);
  assert.deepEqual(comPlano, direto);
});

test("pontosAdesaoComFallback: sem plano (null), 1 sessão numa semana → 100%, não 'sem dados' para sempre", () => {
  const sessoes = [{ performedAt: "2026-09-15T10:00:00Z" }]; // semana atual (W38)
  const pontos = pontosAdesaoComFallback(sessoes, null, 6, AGORA);
  assert.equal(pontos[pontos.length - 1].pct, 1);
  assert.equal(pontos[pontos.length - 1].previstos, 1);
});

test("pontosAdesaoComFallback: sem plano, 0 (diasPrevistosSemana=0) tratado igual a null", () => {
  const sessoes = [{ performedAt: "2026-09-15T10:00:00Z" }];
  const comZero = pontosAdesaoComFallback(sessoes, 0, 6, AGORA);
  const comNull = pontosAdesaoComFallback(sessoes, null, 6, AGORA);
  assert.deepEqual(comZero, comNull);
});

test("pontosAdesaoComFallback: sem plano, 3 sessões na mesma semana → capado a 100%, nunca 300%", () => {
  const sessoes = [
    { performedAt: "2026-09-15T10:00:00Z" },
    { performedAt: "2026-09-16T10:00:00Z" },
    { performedAt: "2026-09-17T10:00:00Z" },
  ];
  const pontos = pontosAdesaoComFallback(sessoes, null, 6, AGORA);
  assert.equal(pontos[pontos.length - 1].pct, 1);
});

test("pontosAdesaoComFallback: sem plano e sem sessão nenhuma → todas as semanas a 0%, direção sem_dados", () => {
  const pontos = pontosAdesaoComFallback([], null, 6, AGORA);
  assert.equal(pontos.length, 6);
  assert.ok(pontos.every((p) => p.pct === 0 && p.feitos === 0));
  assert.equal(direcaoAdesao(pontos), "sem_dados");
});

test("pontosAdesaoComFallback: sem plano, 2 semanas com treino → sinal real (não sem_dados), coerente com o painel do PT", () => {
  const sessoes = [
    { performedAt: "2026-08-11T10:00:00Z" }, // semana antiga, 1 sessão
    { performedAt: "2026-09-15T10:00:00Z" }, // semana atual, 1 sessão
  ];
  const pontos = pontosAdesaoComFallback(sessoes, null, 6, AGORA);
  assert.notEqual(direcaoAdesao(pontos), "sem_dados");
});

test("chaveSemanaIso: treino à 00:30 de segunda em Lisboa (23:30 UTC de domingo) conta na semana NOVA", () => {
  assert.equal(chaveSemanaIso("2026-09-27T23:30:00Z"), chaveSemanaIso("2026-09-28T12:00:00Z"));
  assert.notEqual(chaveSemanaIso("2026-09-27T23:30:00Z"), chaveSemanaIso("2026-09-27T12:00:00Z"));
});
