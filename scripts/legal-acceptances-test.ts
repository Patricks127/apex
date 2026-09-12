/**
 * Verificação da migração 015 (legal_acceptances) contra a BD real.
 *
 * Confirma que:
 *   - registar com signUp({data: {terms_accepted, health_accepted, ...}})
 *     grava as DUAS linhas (termos_privacidade + aviso_saude), com a versão
 *     certa, via o trigger em auth.users;
 *   - registar SEM esses campos (compatibilidade com chamadas antigas) não
 *     grava nada e não rebenta o signup;
 *   - o dono lê o seu próprio histórico;
 *   - um estranho não lê o histórico de outro utilizador;
 *   - um estranho não consegue inserir uma aceitação em nome de outro.
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/legal-acceptances-test.ts
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

async function signup(tag: string, data: Record<string, unknown>): Promise<U> {
  const email = `patrick00santos+${tag}${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
  const j = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Testpass123!", data }),
  }).then((r) => r.json());
  if (!j.access_token) {
    console.error("Signup sem sessão — 'Confirm email' ligado?", j);
    process.exit(2);
  }
  return { token: j.access_token, id: j.user.id };
}

const H = (u: U) => ({ apikey: KEY, authorization: `Bearer ${u.token}`, "content-type": "application/json" });
const get = (u: U, path: string) => fetch(`${REST}/${path}`, { headers: H(u) }).then((r) => r.json());
const post = (u: U, path: string, body: unknown) =>
  fetch(`${REST}/${path}`, { method: "POST", headers: { ...H(u), prefer: "return=representation" }, body: JSON.stringify(body) });

async function main() {
  const A = await signup("laA", {
    name: "Aluno A",
    role: "atleta",
    terms_accepted: "true",
    terms_version: "1.0",
    health_accepted: "true",
    health_version: "1.0",
  });
  const B = await signup("laB", { name: "Estranho B", role: "atleta" }); // sem os campos — chamada "antiga"
  console.log(`Setup — A=${A.id.slice(0, 8)}  B=${B.id.slice(0, 8)}\n`);

  // 1. A tem as duas linhas de aceitação, com versão certa
  const linhasA = await get(A, `legal_acceptances?user_id=eq.${A.id}&select=kind,version&order=kind`);
  if (Array.isArray(linhasA) && linhasA.length === 2) {
    ok("registo com os dois campos grava as DUAS aceitações");
    const termos = linhasA.find((l: { kind: string }) => l.kind === "termos_privacidade");
    const saude = linhasA.find((l: { kind: string }) => l.kind === "aviso_saude");
    if (termos?.version === "1.0" && saude?.version === "1.0") ok("as duas ficam com a versão 1.0");
    else ko("versão errada nas aceitações de A", linhasA);
  } else {
    ko("A não ficou com as duas aceitações", linhasA);
  }

  // 2. B (sem os campos no signup) não tem NENHUMA linha — compatibilidade
  const linhasB = await get(B, `legal_acceptances?user_id=eq.${B.id}&select=kind`);
  if (Array.isArray(linhasB) && linhasB.length === 0) {
    ok("signup sem terms_accepted/health_accepted não grava nada (compat, sem rebentar)");
  } else {
    ko("B ficou com aceitações sem as ter enviado", linhasB);
  }

  // 3. estranho não lê o histórico de A
  const bLeA = await get(B, `legal_acceptances?user_id=eq.${A.id}&select=kind`);
  if (Array.isArray(bLeA) && bLeA.length === 0) ok("estranho NÃO lê o histórico de aceitações de outro utilizador");
  else ko("estranho leu o histórico de A", bLeA);

  // 4. estranho não consegue inserir uma aceitação em nome de A
  const forja = await post(B, "legal_acceptances", { user_id: A.id, kind: "termos_privacidade", version: "9.9" });
  const forjaBody = await forja.json();
  if (forja.status >= 400 && forjaBody?.code === "42501") {
    ok("estranho NÃO consegue inserir uma aceitação em nome de outro (42501)");
  } else {
    ko("estranho conseguiu inserir uma aceitação em nome de A", forjaBody);
  }

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
