process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { test } from "node:test";
import { leituraAdesao, leituraForca, leituraMetrica, leituraVolume } from "./leituras.ts";

const dia = (d: string) => `${d}T10:00:00Z`;
const AGORA = new Date("2026-09-27T12:00:00Z");

// ---------------------------------------------------------------- força
test("força a MELHORAR: +5 kg em 6 semanas", () => {
  const r = leituraForca("Supino", [
    { valueKg: 40, recordedAt: dia("2026-08-16") },
    { valueKg: 42.5, recordedAt: dia("2026-09-06") },
    { valueKg: 45, recordedAt: dia("2026-09-27") },
  ]);
  assert.equal(r?.texto, "Supino: +5 kg em 6 semanas.");
  assert.equal(r?.sentido, "melhor");
});

test("força a PIORAR: diz claramente que desceu e que está abaixo do máximo", () => {
  const r = leituraForca("Supino", [
    { valueKg: 45, recordedAt: dia("2026-08-16") },
    { valueKg: 50, recordedAt: dia("2026-09-06") },
    { valueKg: 42.5, recordedAt: dia("2026-09-27") },
  ]);
  assert.equal(r?.texto, "Supino: −2,5 kg em 6 semanas, 7,5 kg abaixo do teu máximo (50 kg).");
  assert.equal(r?.sentido, "pior");
});

test("força: subiu no total mas caiu do pico — não esconde a queda", () => {
  const r = leituraForca("Agachamento", [
    { valueKg: 60, recordedAt: dia("2026-08-01") },
    { valueKg: 80, recordedAt: dia("2026-09-01") },
    { valueKg: 70, recordedAt: dia("2026-09-27") },
  ]);
  assert.equal(r?.texto, "Agachamento: +10 kg em 2 meses, 10 kg abaixo do teu máximo (80 kg).");
});

test("força na perspetiva do PT: 'do máximo', não 'do teu máximo'", () => {
  const r = leituraForca("Supino", [
    { valueKg: 45, recordedAt: dia("2026-08-16") },
    { valueKg: 50, recordedAt: dia("2026-09-06") },
    { valueKg: 42.5, recordedAt: dia("2026-09-27") },
  ], "pt");
  assert.equal(r?.texto, "Supino: −2,5 kg em 6 semanas, 7,5 kg abaixo do máximo (50 kg).");
});

test("força: sem mudança", () => {
  const r = leituraForca("Press militar", [
    { valueKg: 30, recordedAt: dia("2026-08-30") },
    { valueKg: 30, recordedAt: dia("2026-09-27") },
  ]);
  assert.equal(r?.texto, "Press militar: sem mudança em 4 semanas.");
});

test("força: testado vs estimado NÃO se comparam (caso real: 85 kg testado, 55 kg estimado de um treino leve)", () => {
  const r = leituraForca("Supino", [
    { valueKg: 82.5, recordedAt: dia("2026-08-13"), source: "manual" },
    { valueKg: 85, recordedAt: dia("2026-09-13"), source: "manual" },
    { valueKg: 55, recordedAt: dia("2026-09-14"), source: "auto" },
  ]);
  // só os testados: 82,5 → 85, nunca "−27,5 kg"
  assert.equal(r?.texto, "Supino: +2,5 kg em 4 semanas.");
});

test("força: só estimativas → compara estimativas entre si", () => {
  const r = leituraForca("Supino", [
    { valueKg: 50, recordedAt: dia("2026-08-30"), source: "auto" },
    { valueKg: 52.5, recordedAt: dia("2026-09-27"), source: "auto" },
  ]);
  assert.equal(r?.texto, "Supino: +2,5 kg em 4 semanas.");
});

test("força: um testado + um estimado → sem tendência (não se misturam)", () => {
  assert.equal(
    leituraForca("Supino", [
      { valueKg: 85, recordedAt: dia("2026-08-13"), source: "manual" },
      { valueKg: 55, recordedAt: dia("2026-09-14"), source: "auto" },
    ]),
    null,
  );
});

test("força: menos de 7 dias entre o primeiro e o último → não é tendência", () => {
  assert.equal(
    leituraForca("Agachamento", [
      { valueKg: 120, recordedAt: dia("2026-09-14") },
      { valueKg: 110, recordedAt: dia("2026-09-14") },
      { valueKg: 120, recordedAt: dia("2026-09-18") },
    ]),
    null,
  );
});

test("força: um ponto só → não inventa", () => {
  assert.equal(leituraForca("Supino", [{ valueKg: 40, recordedAt: dia("2026-09-27") }]), null);
  assert.equal(leituraForca("Supino", []), null);
});

// ---------------------------------------------------------------- peso / medidas (neutro)
test("peso a descer: só o facto, sem julgar", () => {
  const r = leituraMetrica("weight_kg", [
    { value: 72.4, recordedAt: dia("2026-08-20") },
    { value: 71.8, recordedAt: dia("2026-08-28") },
    { value: 71.2, recordedAt: dia("2026-09-27") },
  ]);
  assert.equal(r?.texto, "Peso: −0,6 kg em 4 semanas.");
  assert.equal(r?.sentido, "neutro");
});

test("peso a subir: também só o facto (subir peso não é mau em si)", () => {
  const r = leituraMetrica("weight_kg", [
    { value: 60, recordedAt: dia("2026-08-27") },
    { value: 62, recordedAt: dia("2026-09-27") },
  ]);
  assert.equal(r?.texto, "Peso: +2 kg em 4 semanas.");
  assert.equal(r?.sentido, "neutro");
});

test("peso: variação mínima → estável", () => {
  const r = leituraMetrica("weight_kg", [
    { value: 70, recordedAt: dia("2026-09-06") },
    { value: 70.3, recordedAt: dia("2026-09-27") },
  ]);
  assert.equal(r?.texto, "Peso: estável nas últimas 3 semanas.");
});

test("estável: concordância certa com dias, semanas e meses", () => {
  const est = (a: string, b: string) =>
    leituraMetrica("weight_kg", [{ value: 70, recordedAt: dia(a) }, { value: 70.2, recordedAt: dia(b) }])?.texto;
  assert.equal(est("2026-09-17", "2026-09-27"), "Peso: estável nos últimos 10 dias.");
  assert.equal(est("2026-07-27", "2026-09-27"), "Peso: estável nos últimos 2 meses.");
});

test("cintura: −2 cm em 2 meses", () => {
  const r = leituraMetrica("waist_cm", [
    { value: 76, recordedAt: dia("2026-07-27") },
    { value: 74, recordedAt: dia("2026-09-27") },
  ]);
  assert.equal(r?.texto, "Cintura: −2 cm em 2 meses.");
});

test("medidas: menos de 7 dias entre registos, ou 1 registo → não inventa; altura nunca", () => {
  assert.equal(leituraMetrica("weight_kg", [{ value: 70, recordedAt: dia("2026-09-25") }, { value: 69, recordedAt: dia("2026-09-27") }]), null);
  assert.equal(leituraMetrica("weight_kg", [{ value: 70, recordedAt: dia("2026-09-27") }]), null);
  assert.equal(leituraMetrica("height_cm", [{ value: 170, recordedAt: dia("2026-06-01") }, { value: 171, recordedAt: dia("2026-09-27") }]), null);
});

// ---------------------------------------------------------------- volume
const sem = (weekNumber: number, volumeKg: number, isDeload = false, ultima = "2026-09-01") => ({ weekNumber, volumeKg, isDeload, ultimaSessao: dia(ultima) });

test("volume a SUBIR em 2 semanas seguidas", () => {
  const r = leituraVolume([sem(1, 10000), sem(2, 11000), sem(3, 12500)], AGORA);
  assert.equal(r?.texto, "Volume semanal a subir: +25% em 2 semanas.");
  assert.equal(r?.sentido, "melhor");
});

test("volume a DESCER em 2 semanas seguidas — dito claramente", () => {
  const r = leituraVolume([sem(1, 12000), sem(2, 10500), sem(3, 9000)], AGORA);
  assert.equal(r?.texto, "Volume semanal a descer: −25% nas últimas 2 semanas.");
  assert.equal(r?.sentido, "pior");
});

test("volume: a semana em curso (sessão nos últimos 7 dias) não conta", () => {
  // semana 4 ainda a meio (1 sessão ontem) — sem esta regra dava "a descer"
  const r = leituraVolume([sem(1, 10000), sem(2, 11000), sem(3, 12500), sem(4, 3000, false, "2026-09-26")], AGORA);
  assert.equal(r?.texto, "Volume semanal a subir: +25% em 2 semanas.");
});

test("volume: semana de descarga — explica, não chama queda", () => {
  const r = leituraVolume([sem(1, 10000), sem(2, 11000), sem(3, 12000), sem(4, 6000, true)], AGORA);
  assert.equal(r?.texto, "Última semana foi de descarga — volume mais baixo de propósito.");
  assert.equal(r?.sentido, "neutro");
});

test("volume: pouca variação → estável; poucas semanas → não inventa", () => {
  assert.equal(leituraVolume([sem(1, 10000), sem(2, 10300), sem(3, 9900)], AGORA)?.texto, "Volume semanal estável nas últimas 3 semanas.");
  assert.equal(leituraVolume([sem(1, 10000), sem(2, 12000)], AGORA), null);
});

// ---------------------------------------------------------------- adesão
// treinos feitos por semana, de 3 previstos (como a app guarda)
const ad = (...feitos: number[]) =>
  feitos.map((f, i) => ({ semana: `2026-W${30 + i}`, feitos: f, previstos: 3, pct: f / 3 }));

test("adesão a DESCER: 'desceu para X%' — nunca animadora", () => {
  // 6 semanas; a última (em curso) não conta
  const r = leituraAdesao(ad(3, 3, 3, 2, 1, 0));
  assert.equal(r?.texto, "A tua adesão desceu para 50% nas últimas 2 semanas (era 100%).");
  assert.equal(r?.sentido, "pior");
});

test("adesão: semana passada a zero — di-lo diretamente (caso real)", () => {
  // 2/3, 2/3, 2/3, 0/3 nas 4 semanas completas (+ a em curso)
  assert.equal(
    leituraAdesao(ad(0, 2, 2, 2, 0, 0))?.texto,
    "A tua adesão desceu para 33% nas últimas 2 semanas (era 67%) — na semana passada não treinaste.",
  );
  assert.equal(
    leituraAdesao(ad(0, 2, 2, 2, 0, 0), "pt")?.texto,
    "A adesão desceu para 33% nas últimas 2 semanas (era 67%) — na semana passada não treinou.",
  );
});

test("adesão a SUBIR", () => {
  const r = leituraAdesao(ad(1, 1, 1, 2, 3, 0));
  assert.equal(r?.texto, "A tua adesão subiu para 83% nas últimas 2 semanas (era 33%).");
  assert.equal(r?.sentido, "melhor");
});

test("adesão estável mas baixa: diz que está baixa", () => {
  const r = leituraAdesao(ad(2, 1, 2, 1, 2, 0));
  assert.equal(r?.texto, "A tua adesão está estável, mas baixa: 50% nas últimas 4 semanas.");
  assert.equal(r?.sentido, "pior");
});

test("adesão estável e boa", () => {
  const r = leituraAdesao(ad(3, 3, 3, 3, 3, 0));
  assert.equal(r?.texto, "A tua adesão está estável: 100% nas últimas 4 semanas.");
});

test("adesão: menos de 2 semanas completas com treino → não inventa", () => {
  assert.equal(leituraAdesao(ad(0, 0, 0, 0, 2, 3)), null);
  assert.equal(leituraAdesao([]), null);
});

test("adesão na perspetiva do PT: fala do aluno, não 'a tua'", () => {
  const r = leituraAdesao(ad(3, 3, 3, 2, 1, 0), "pt");
  assert.equal(r?.texto, "A adesão desceu para 50% nas últimas 2 semanas (era 100%).");
});

test("nenhuma frase é animadora vazia", () => {
  const todas = [
    leituraAdesao(ad(3, 3, 3, 2, 1, 0)),
    leituraVolume([sem(1, 12000), sem(2, 10500), sem(3, 9000)], AGORA),
    leituraForca("Supino", [{ valueKg: 50, recordedAt: dia("2026-08-16") }, { valueKg: 45, recordedAt: dia("2026-09-27") }]),
  ].map((r) => r!.texto);
  for (const t of todas) assert.doesNotMatch(t, /continua|parabéns|boa!|excelente|ótimo|força!|!/i, t);
});
