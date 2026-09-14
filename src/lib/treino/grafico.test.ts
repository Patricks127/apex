import assert from "node:assert/strict";
import { test } from "node:test";
import { escalarPontos, pathLinha, escalarBarras } from "./grafico.ts";

test("escalarPontos: série vazia devolve array vazio", () => {
  assert.deepEqual(escalarPontos([], 100, 100), []);
});

test("escalarPontos: um só ponto fica centrado horizontalmente", () => {
  const [p] = escalarPontos([50], 100, 100, 20);
  assert.equal(p.x, 50);
});

test("escalarPontos: valor mínimo fica em baixo, máximo em cima (Y invertido)", () => {
  const pontos = escalarPontos([0, 100], 100, 100, 0);
  assert.equal(pontos[0].y, 100); // valor 0 → em baixo
  assert.equal(pontos[1].y, 0); // valor 100 → em cima
});

test("escalarPontos: todos os valores iguais não rebenta (span 0) — fica a meia altura", () => {
  const pontos = escalarPontos([50, 50, 50], 100, 100, 0);
  for (const p of pontos) assert.equal(p.y, 50);
});

test("escalarPontos: pontos espaçados uniformemente no eixo X", () => {
  const pontos = escalarPontos([1, 2, 3, 4], 100, 100, 0);
  const passos = [1, 2, 3].map((i) => pontos[i].x - pontos[i - 1].x);
  assert.ok(Math.abs(passos[0] - passos[1]) < 1e-9);
  assert.ok(Math.abs(passos[1] - passos[2]) < 1e-9);
});

test("pathLinha: série vazia devolve string vazia", () => {
  assert.equal(pathLinha([]), "");
});

test("pathLinha: começa com M e liga o resto com L", () => {
  const d = pathLinha([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }]);
  assert.match(d, /^M 0\.0 0\.0 L 10\.0 10\.0 L 20\.0 5\.0$/);
});

test("escalarBarras: proporcional ao máximo da série", () => {
  const alturas = escalarBarras([50, 100, 25], 200);
  assert.equal(alturas[1], 200); // o máximo ocupa a altura toda
  assert.equal(alturas[0], 100);
  assert.equal(alturas[2], 50);
});

test("escalarBarras: série vazia devolve array vazio", () => {
  assert.deepEqual(escalarBarras([], 200), []);
});
