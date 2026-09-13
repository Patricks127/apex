import test from "node:test";
import assert from "node:assert/strict";
import { calcularDiscosPorLado } from "./discos.ts";

const kgs = (pesoTotal: number, pesoBarra?: number) =>
  calcularDiscosPorLado(pesoTotal, pesoBarra).map((d) => d.kg);

test("60 kg (barra 20) → 20 de cada lado", () => {
  assert.deepEqual(kgs(60), [20]);
});

test("100 kg → dois discos de 20 de cada lado", () => {
  assert.deepEqual(kgs(100), [20, 20]);
});

test("52,5 kg → 15 + 1,25 de cada lado (16,25 kg/lado)", () => {
  assert.deepEqual(kgs(52.5), [15, 1.25]);
});

test("47,5 kg → 10 + 2,5 + 1,25 de cada lado (13,75 kg/lado)", () => {
  assert.deepEqual(kgs(47.5), [10, 2.5, 1.25]);
});

test("carga ≤ peso da barra vazia → sem discos", () => {
  assert.deepEqual(kgs(20), []);
  assert.deepEqual(kgs(15), []);
  assert.deepEqual(kgs(0), []);
});

test("peso corporal (null) → sem discos, não rebenta", () => {
  assert.deepEqual(kgs(null as unknown as number), []);
});

test("barra diferente da omissa (ex.: 15 kg, barra feminina) usa-se o parâmetro", () => {
  assert.deepEqual(kgs(45, 15), [15]);
});

test("ordem é sempre do maior para o mais pequeno (mais perto da barra por último)", () => {
  const d = kgs(140); // 60/lado
  for (let i = 1; i < d.length; i++) assert.ok(d[i] <= d[i - 1]);
});

test("cada denominação tem cor definida", () => {
  const discos = calcularDiscosPorLado(100);
  for (const d of discos) assert.ok(/^#[0-9A-Fa-f]{6}$/.test(d.cor));
});
