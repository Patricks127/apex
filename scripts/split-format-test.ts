/**
 * Verificação da migração 009 (profiles.split_format) contra a BD real.
 *
 * Confirma que:
 *   - a coluna existe com omissão 'auto';
 *   - o dono consegue definir 'frequencia' e 'muscular';
 *   - o CHECK rejeita um valor fora da lista;
 *   - um terceiro NÃO consegue alterar o split_format de outro perfil
 *     (a RLS de profiles é por linha, como goal/level/focus_muscles).
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/split-format-test.ts
 */
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const URL_ = /^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)![1].trim();
const KEY = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m.exec(env)![1].trim();
const AUTH = `${URL_}/auth/v1`;
const REST = `${URL_}/rest/v1`;

let pass = 0;
let fail = 0;
const ok = (m: string) => {
  pass++;
  console.log(`  \x1b[32mPASS\x1b[0m  ${m}`);
};
const ko = (m: string, extra?: unknown) => {
  fail++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`);
  if (extra !== undefined) console.log("        ", extra);
};

type U = { token: string; id: string };

async function signup(tag: string): Promise<U> {
  const email = `patrick00santos+${tag}${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
  const j = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Testpass123!", data: { name: tag, role: "atleta" } }),
  }).then((r) => r.json());
  if (!j.access_token) {
    console.error("Signup sem sessão — 'Confirm email' ligado?", j);
    process.exit(2);
  }
  return { token: j.access_token, id: j.user.id };
}

const H = (u: U) => ({ apikey: KEY, authorization: `Bearer ${u.token}`, "content-type": "application/json" });
const get = (u: U, path: string) => fetch(`${REST}/${path}`, { headers: H(u) }).then((r) => r.json());
const patch = (u: U, path: string, body: unknown) =>
  fetch(`${REST}/${path}`, { method: "PATCH", headers: H(u), body: JSON.stringify(body) });

async function main() {
  const A = await signup("sfA");
  const B = await signup("sfB");
  console.log(`Setup — A=${A.id.slice(0, 8)}  B=${B.id.slice(0, 8)}\n`);

  // 1. omissão 'auto'
  const aInicial = await get(A, `profiles?id=eq.${A.id}&select=split_format`);
  if (Array.isArray(aInicial) && aInicial[0]?.split_format === "auto") ok("omissão é 'auto'");
  else ko("omissão não é 'auto'", aInicial);

  // 2. dono define 'muscular'
  await patch(A, `profiles?id=eq.${A.id}`, { split_format: "muscular" });
  const aMusc = await get(A, `profiles?id=eq.${A.id}&select=split_format`);
  if (Array.isArray(aMusc) && aMusc[0]?.split_format === "muscular") ok("dono define 'muscular'");
  else ko("não ficou 'muscular'", aMusc);

  // 3. dono define 'frequencia'
  await patch(A, `profiles?id=eq.${A.id}`, { split_format: "frequencia" });
  const aFreq = await get(A, `profiles?id=eq.${A.id}&select=split_format`);
  if (Array.isArray(aFreq) && aFreq[0]?.split_format === "frequencia") ok("dono define 'frequencia'");
  else ko("não ficou 'frequencia'", aFreq);

  // 4. CHECK rejeita valor inválido
  const mau = await patch(A, `profiles?id=eq.${A.id}`, { split_format: "bro_split" });
  const aAposMau = await get(A, `profiles?id=eq.${A.id}&select=split_format`);
  if (mau.status >= 400 || (Array.isArray(aAposMau) && aAposMau[0]?.split_format === "frequencia")) {
    ok("CHECK rejeita valor fora da lista (fica 'frequencia')");
  } else {
    ko("valor inválido foi aceite", aAposMau);
  }

  // 5. terceiro não altera o split_format de A
  await patch(B, `profiles?id=eq.${A.id}`, { split_format: "muscular" });
  const aAposB = await get(A, `profiles?id=eq.${A.id}&select=split_format`);
  if (Array.isArray(aAposB) && aAposB[0]?.split_format === "frequencia") {
    ok("terceiro NÃO altera o split_format de outro perfil");
  } else {
    ko("um terceiro conseguiu alterar o split_format de A", aAposB);
  }

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
