import test from "node:test";
import assert from "node:assert/strict";
import { decidirDescanso } from "./descanso.ts";

test("RPE ≤7 → base −15s", () => {
  assert.equal(decidirDescanso(90, 6, "normal").seg, 75);
  assert.equal(decidirDescanso(90, 7, "normal").seg, 75);
});

test("RPE 8 → base, sem motivo (nada a explicar)", () => {
  const d = decidirDescanso(90, 8, "normal");
  assert.equal(d.seg, 90);
  assert.equal(d.ajusteSeg, 0);
  assert.equal(d.motivo, null);
});

test("RPE 9 → base +30s", () => {
  assert.equal(decidirDescanso(90, 9, "normal").seg, 120);
});

test("RPE 10 → base +45s", () => {
  assert.equal(decidirDescanso(90, 10, "normal").seg, 135);
});

test("nunca abaixo do chão geral de 45s, mesmo com RPE baixo e base curta", () => {
  assert.equal(decidirDescanso(50, 6, "normal").seg, 45); // 50-15=35 → sobe a 45
});

test("composto pesado com RPE ≥9 nunca abaixo de 120s, mesmo que a base seja curta", () => {
  const d = decidirDescanso(60, 9, "composto_pesado"); // 60+30=90, mas é composto pesado a RPE9
  assert.equal(d.seg, 120);
  assert.equal(d.ajusteSeg, 60); // o que realmente mudou (para a mensagem)
});

test("composto pesado com RPE <9 NÃO tem o chão de 120s — só o geral", () => {
  const d = decidirDescanso(60, 7, "composto_pesado"); // 60-15=45
  assert.equal(d.seg, 45);
});

test("isolamento nunca acima de 120s, mesmo com RPE 10 e base alta", () => {
  const d = decidirDescanso(90, 10, "isolamento"); // 90+45=135 → desce a 120
  assert.equal(d.seg, 120);
  assert.equal(d.ajusteSeg, 30);
});

test("isolamento com RPE baixo não é afetado pelo teto (fica bem abaixo dele)", () => {
  assert.equal(decidirDescanso(60, 6, "isolamento").seg, 45);
});

test("motivo descreve o ajuste REAL (depois dos limites), não o ajuste bruto do RPE", () => {
  // sem o limite seria "+45s"; com o limite de isolamento fica "+30s"
  const d = decidirDescanso(90, 10, "isolamento");
  assert.equal(d.motivo, "Mais 30s — a última série custou-te 10.");
});

test("motivo em falta (0) quando um limite anula o ajuste do RPE", () => {
  // base já no teto do isolamento; RPE 9 pediria +30s mas o teto não deixa
  const d = decidirDescanso(120, 9, "isolamento");
  assert.equal(d.seg, 120);
  assert.equal(d.motivo, null);
});

test("motivo de redução usa a frase de RPE baixo", () => {
  const d = decidirDescanso(90, 6, "normal");
  assert.equal(d.motivo, "Menos 15s — a última série esteve fácil (RPE 6).");
});
