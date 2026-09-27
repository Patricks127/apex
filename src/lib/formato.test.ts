import assert from "node:assert/strict";
import { test } from "node:test";
import { MUSCULO_LABEL } from "./motor2/plano.ts";
import { formatarKg, formatarNumero, rotuloEsforco, rotuloMusculo } from "./formato.ts";

test("formatarNumero/formatarKg: vírgula decimal, formato de Portugal", () => {
  assert.equal(formatarKg(32.5), "32,5 kg");
  assert.equal(formatarKg(40), "40 kg");
  assert.equal(formatarKg(1.25), "1,25 kg");
  assert.equal(formatarNumero(7.46, 1), "7,5");
  assert.doesNotMatch(formatarKg(102.5), /\./);
});

test("rotuloMusculo: nunca um identificador interno", () => {
  assert.equal(rotuloMusculo("deltoide_lateral"), "Deltoide lateral");
  assert.equal(rotuloMusculo("dorsais"), "Costas");
  assert.equal(rotuloMusculo("triceps"), "Tríceps");
  // planos do motor v1 já guardam nomes — passam intactos
  assert.equal(rotuloMusculo("Pernas"), "Pernas");
  // um identificador que o mapa ainda não conheça também não sai cru
  assert.equal(rotuloMusculo("musculo_novo"), "Musculo novo");
  assert.equal(rotuloMusculo(null), null);
});

test("rotuloMusculo: TODOS os músculos do motor v2 têm nome legível, sem underscore", () => {
  for (const id of Object.keys(MUSCULO_LABEL)) {
    assert.doesNotMatch(rotuloMusculo(id)!, /_/, id);
  }
});

test("rotuloEsforco: RIR só — nunca 'RPE RIR'", () => {
  assert.equal(rotuloEsforco("RIR 1–3", true), "RIR 1–3");
  assert.equal(rotuloEsforco("RIR 1-3", true), "RIR 1–3");
  // RPE do motor v1 convertido: RPE 8 = 2 reps na reserva
  assert.equal(rotuloEsforco("7–8", true), "RIR 2–3");
  assert.equal(rotuloEsforco("8", true), "RIR 2");
  assert.equal(rotuloEsforco("8-9", true), "RIR 1–2");
  for (const alvo of ["RIR 1–3", "7–8", "8"]) assert.doesNotMatch(rotuloEsforco(alvo, true)!, /RPE/);
});

test("rotuloEsforco: cardio sem repetições não usa RIR", () => {
  assert.equal(rotuloEsforco("Z2", false), "Zona 2");
  assert.equal(rotuloEsforco("Z4–5", false), "Zona 4–5");
  assert.equal(rotuloEsforco("8–9", false), "Esforço 8–9/10");
});

test("rotuloEsforco: sem alvo (planos do PT) → nada", () => {
  assert.equal(rotuloEsforco("—", true), null);
  assert.equal(rotuloEsforco("", true), null);
  assert.equal(rotuloEsforco(null, true), null);
});
