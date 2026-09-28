import assert from "node:assert/strict";
import { test } from "node:test";
import { avatarDoProprio } from "./perfil.ts";

const SB = "https://abc.supabase.co";
const EU = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";

test("avatarDoProprio: aceita um ficheiro na pasta do próprio", () => {
  assert.ok(avatarDoProprio(`${SB}/storage/v1/object/public/avatars/${EU}/foto.jpg`, EU, SB));
});

test("avatarDoProprio: recusa o avatar de outra pessoa, domínios externos e truques de caminho", () => {
  for (const mau of [
    `${SB}/storage/v1/object/public/avatars/${OUTRO}/foto.jpg`, // de outra pessoa
    `https://mau.example/storage/v1/object/public/avatars/${EU}/foto.jpg`, // outro domínio
    `https://mau.example/?x=${SB}/storage/v1/object/public/avatars/${EU}/f.jpg`, // contém o texto, não começa por ele
    `${SB}/storage/v1/object/public/avatars/${EU}/../${OUTRO}/foto.jpg`, // ".."
    `${SB}/storage/v1/object/public/avatars/${EU}/`, // pasta vazia
    `${SB}/storage/v1/object/public/private-media/${EU}/foto.jpg`, // bucket privado
    "javascript:alert(1)",
  ]) {
    assert.equal(avatarDoProprio(mau, EU, SB), false, mau);
  }
});
