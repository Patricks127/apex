import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chaveSemanaIso,
  agruparVolumePorSemanaCalendario,
  direcaoTendencia,
} from "./tendencia-volume.ts";

// Datas de referência conhecidas da norma ISO 8601 (semana começa
// segunda; a semana 1 é a que contém a primeira quinta-feira do ano).
test("chaveSemanaIso: casos de referência da norma ISO 8601", () => {
  assert.equal(chaveSemanaIso("2026-01-01T12:00:00Z"), "2026-W01");
  assert.equal(chaveSemanaIso("2025-12-29T12:00:00Z"), "2026-W01"); // segunda da mesma semana ISO que 1 jan 2026
  assert.equal(chaveSemanaIso("2026-01-05T12:00:00Z"), "2026-W02");
  assert.equal(chaveSemanaIso("2024-12-31T12:00:00Z"), "2025-W01");
  // 1 jan 2027 é sexta-feira — pertence à última semana ISO de 2026, não à W01 de 2027
  assert.equal(chaveSemanaIso("2027-01-01T12:00:00Z"), "2026-W53");
});

test("agruparVolumePorSemanaCalendario: soma sessões da mesma semana ISO", () => {
  const out = agruparVolumePorSemanaCalendario([
    { performedAt: "2026-01-05T10:00:00Z", volumeKg: 1000 }, // W02
    { performedAt: "2026-01-07T10:00:00Z", volumeKg: 1500 }, // W02
    { performedAt: "2026-01-12T10:00:00Z", volumeKg: 2000 }, // W03
  ]);
  assert.deepEqual(out, [
    { semana: "2026-W02", volumeKg: 2500 },
    { semana: "2026-W03", volumeKg: 2000 },
  ]);
});

test("agruparVolumePorSemanaCalendario: nunca preenche semanas sem sessão com 0", () => {
  const out = agruparVolumePorSemanaCalendario([
    { performedAt: "2026-01-01T10:00:00Z", volumeKg: 1000 }, // W01
    { performedAt: "2026-01-19T10:00:00Z", volumeKg: 1000 }, // W04 — salta W02/W03 de propósito
  ]);
  assert.equal(out.length, 2);
  assert.equal(
    out.some((p) => p.semana === "2026-W02" || p.semana === "2026-W03"),
    false,
  );
});

test("agruparVolumePorSemanaCalendario: ordenado cronologicamente mesmo com entrada desordenada", () => {
  const out = agruparVolumePorSemanaCalendario([
    { performedAt: "2026-01-19T10:00:00Z", volumeKg: 500 },
    { performedAt: "2026-01-01T10:00:00Z", volumeKg: 500 },
  ]);
  assert.deepEqual(
    out.map((p) => p.semana),
    ["2026-W01", "2026-W04"],
  );
});

test("direcaoTendencia: menos de 2 semanas com dados → sem_dados, nunca uma linha inventada", () => {
  assert.equal(direcaoTendencia([]), "sem_dados");
  assert.equal(direcaoTendencia([{ semana: "2026-W01", volumeKg: 1000 }]), "sem_dados");
});

test("direcaoTendencia: subida clara (+8% ou mais entre a primeira e a última semana com dados)", () => {
  const dir = direcaoTendencia([
    { semana: "2026-W01", volumeKg: 1000 },
    { semana: "2026-W02", volumeKg: 1100 },
  ]);
  assert.equal(dir, "subida");
});

test("direcaoTendencia: descida clara (-8% ou menos)", () => {
  const dir = direcaoTendencia([
    { semana: "2026-W01", volumeKg: 1000 },
    { semana: "2026-W02", volumeKg: 850 },
  ]);
  assert.equal(dir, "descida");
});

test("direcaoTendencia: variação pequena → estável (nem subida nem descida)", () => {
  const dir = direcaoTendencia([
    { semana: "2026-W01", volumeKg: 1000 },
    { semana: "2026-W02", volumeKg: 1030 },
  ]);
  assert.equal(dir, "estavel");
});

test("direcaoTendencia: usa só a primeira e a última semana COM dados, ignora o meio", () => {
  const dir = direcaoTendencia([
    { semana: "2026-W01", volumeKg: 1000 },
    { semana: "2026-W02", volumeKg: 50 }, // uma quebra a meio não muda a direção geral
    { semana: "2026-W03", volumeKg: 1200 },
  ]);
  assert.equal(dir, "subida");
});
