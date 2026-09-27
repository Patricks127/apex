import assert from "node:assert/strict";
import { test } from "node:test";
import { MUSCULO_LABEL } from "./motor2/rotulos.ts";
import {
  OPCOES_RESERVA,
  formatarKg,
  formatarNumero,
  formatarReservaMedia,
  lerDecimal,
  rirDeRpe,
  rotuloEsforco,
  rotuloMusculo,
  textoReserva,
} from "./formato.ts";

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

test("reporte em reps na reserva: conversão exata para o RPE que a lógica usa", () => {
  assert.deepEqual(
    OPCOES_RESERVA.map((o) => [o.rotulo, o.rpe]),
    [["4+", 6], ["3", 7], ["2", 8], ["1", 9], ["0", 10]],
  );
  for (const o of OPCOES_RESERVA) assert.equal(rirDeRpe(o.rpe), o.rotulo === "4+" ? 4 : Number(o.rotulo));
});

test("textos do esforço reportado nunca dizem RPE", () => {
  assert.equal(textoReserva(8), "2 reps na reserva");
  assert.equal(textoReserva(9), "1 rep na reserva");
  assert.equal(textoReserva(6), "4 ou mais reps na reserva");
  assert.equal(textoReserva(10), "0 reps na reserva (até à falha)");
  assert.equal(formatarReservaMedia(7.5), "2,5 reps na reserva (média)");
  assert.equal(formatarReservaMedia(9), "1 rep na reserva (média)");
  assert.equal(formatarReservaMedia(9.04), "1 rep na reserva (média)"); // arredonda para "1"
  assert.equal(formatarReservaMedia(8.5), "1,5 reps na reserva (média)");
  for (const r of [6, 7, 8, 9, 10, 7.5]) {
    assert.doesNotMatch(textoReserva(r), /RPE/);
    assert.doesNotMatch(formatarReservaMedia(r), /RPE/);
  }
});

test("lerDecimal: aceita vírgula E ponto, e dá o número certo (nunca 72 nem 725)", () => {
  assert.equal(lerDecimal("72,5"), 72.5);
  assert.equal(lerDecimal("72.5"), 72.5);
  assert.equal(lerDecimal("72"), 72);
  assert.equal(lerDecimal(" 72,5 "), 72.5);
  assert.equal(lerDecimal("0,75"), 0.75);
  assert.equal(lerDecimal(",5"), 0.5);
  // o erro clássico: parseFloat("72,5") dá 72 — aqui nunca
  assert.notEqual(lerDecimal("72,5"), 72);
});

test("lerDecimal: rejeita o que não é um número limpo (em vez de adivinhar)", () => {
  for (const mau of ["", "  ", "abc", "72,5kg", "7a", "72,5,1", "1.072,5", "72..5", "-5", "1e3"]) {
    assert.ok(Number.isNaN(lerDecimal(mau)), `devia rejeitar "${mau}"`);
  }
});
