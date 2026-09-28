/**
 * CRÍTICO — trigger da migração 007: colunas de profiles geridas pelo sistema.
 * Requisitos: 007 aplicada; "Confirm email" DESLIGADO.
 * Uso: node scripts/profiles-guard-test.ts
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
async function signup(role: "atleta" | "pt", name: string): Promise<U> {
  const email = `patrick00santos+pg${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
  const j = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Testpass123!", data: { name, role } }),
  }).then((r) => r.json());
  if (!j.access_token) {
    console.error("Signup sem sessão — 'Confirm email' ligado?", j);
    process.exit(2);
  }
  return { token: j.access_token, id: j.user.id };
}
const H = (u: U) => ({ apikey: KEY, authorization: `Bearer ${u.token}`, "content-type": "application/json" });
const patch = (u: U, id: string, body: unknown) =>
  fetch(`${REST}/profiles?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...H(u), prefer: "return=representation" },
    body: JSON.stringify(body),
  });
const read = (u: U, id: string, cols: string) =>
  fetch(`${REST}/profiles?id=eq.${id}&select=${cols}`, { headers: H(u) }).then((r) => r.json());

async function main() {
  const A = await signup("atleta", "Aluno A");
  const B = await signup("pt", "PT B");
  console.log(`Setup — A(atleta)=${A.id.slice(0, 8)}  B(pt)=${B.id.slice(0, 8)}\n`);

  // ================= 1. role imutável (nos dois sentidos) =================
  console.log("── 1. role imutável ──");
  const r1 = await patch(A, A.id, { role: "pt" });
  const roleA = (await read(A, A.id, "role"))[0].role;
  if (!r1.ok && roleA === "atleta") ok(`atleta -> role='pt' BLOQUEADO (${(await r1.json()).code ?? "erro"}), role continua 'atleta'`);
  else ko("atleta conseguiu mudar role para pt", { status: r1.status, role: roleA });

  const r1b = await patch(B, B.id, { role: "atleta" });
  const roleB = (await read(B, B.id, "role"))[0].role;
  if (!r1b.ok && roleB === "pt") ok("pt -> role='atleta' também BLOQUEADO");
  else ko("pt conseguiu mudar role para atleta", { status: r1b.status, role: roleB });

  // ================= 2. is_verified só service_role =================
  console.log("── 2. is_verified ──");
  const r2 = await patch(A, A.id, { is_verified: true });
  const vA = (await read(A, A.id, "is_verified"))[0].is_verified;
  if (!r2.ok && vA === false) ok("atleta -> is_verified=true BLOQUEADO");
  else ko("atleta pôs is_verified=true", vA);

  const r2b = await patch(B, B.id, { is_verified: true });
  const vB = (await read(B, B.id, "is_verified"))[0].is_verified;
  if (!r2b.ok && vB === false) ok("pt -> is_verified=true BLOQUEADO");
  else ko("pt pôs is_verified=true", vB);

  // ================= 3. pt_code =================
  console.log("── 3. pt_code ──");
  const r3 = await patch(A, A.id, { pt_code: "FREE-9999" });
  const pcA = (await read(A, A.id, "pt_code"))[0].pt_code;
  if (!r3.ok && pcA === null) ok("atleta -> pt_code livre BLOQUEADO (só PT pode ter pt_code)");
  else ko("atleta reivindicou um pt_code", pcA);

  // PT B: null -> valor (o que o garantirCodigoPt faz) → permitido
  const code = `PGB-${String(Date.now() % 10000).padStart(4, "0")}`;
  const r3b = await fetch(`${REST}/profiles?id=eq.${B.id}&pt_code=is.null`, {
    method: "PATCH",
    headers: { ...H(B), prefer: "return=representation" },
    body: JSON.stringify({ pt_code: code }),
  });
  const pcB = (await r3b.json())[0]?.pt_code;
  if (r3b.ok && pcB === code) ok("pt -> pt_code (NULL->valor) PERMITIDO — garantirCodigoPt continua a funcionar");
  else ko("pt não conseguiu definir o pt_code inicial", pcB);

  const r3c = await patch(B, B.id, { pt_code: "PGB-0000" });
  const pcB2 = (await read(B, B.id, "pt_code"))[0].pt_code;
  if (!r3c.ok && pcB2 === code) ok("pt -> mudar pt_code para outro valor BLOQUEADO");
  else ko("pt mudou o pt_code depois de definido", pcB2);

  const r3d = await patch(B, B.id, { pt_code: null });
  const pcB3 = (await read(B, B.id, "pt_code"))[0].pt_code;
  if (!r3d.ok && pcB3 === code) ok("pt -> remover pt_code (->NULL) BLOQUEADO");
  else ko("pt removeu o pt_code", pcB3);

  // ================= 4. id e created_at imutáveis =================
  console.log("── 4. id e created_at ──");
  const r4 = await patch(A, A.id, { created_at: "2000-01-01T00:00:00Z" });
  const caA = (await read(A, A.id, "created_at"))[0].created_at;
  if (!r4.ok && !caA.startsWith("2000")) ok("created_at BLOQUEADO");
  else ko("created_at foi alterado", caA);

  // ================= ATAQUE COMPLETO: atleta -> PT falso =================
  console.log("── ATAQUE: atleta tenta tornar-se PT falso (role + pt_code de uma vez) ──");
  const atk = await patch(A, A.id, { role: "pt", pt_code: "SCAM-0001", is_verified: true });
  const depois = (await read(A, A.id, "role,pt_code,is_verified"))[0];
  if (
    !atk.ok &&
    depois.role === "atleta" &&
    depois.pt_code === null &&
    depois.is_verified === false
  ) {
    ok(`PT falso IMPOSSÍVEL: role='atleta', pt_code=null, is_verified=false (resposta ${(await atk.json()).code ?? atk.status})`);
  } else {
    ko("o atleta conseguiu escalar para PT falso", depois);
  }

  // ================= regressão: edições legítimas continuam a funcionar =================
  console.log("── regressão: o currículo continua editável ──");
  const leg = await patch(B, B.id, {
    headline: "Treinador de força",
    bio: "10 anos a preparar atletas.",
    city: "Porto",
    experience: "10",
    specialties: ["forca", "powerlifting"],
    certs: ["NSCA CSCS"],
    services: ["presencial", "online"],
    price: 40,
    show_contacts: "todos", // contactos: tabela contactos_pt (migração 024)
  });
  const legRow = (await read(B, B.id, "headline,city,specialties,price,show_contacts"))[0];
  if (
    leg.ok &&
    legRow.headline === "Treinador de força" &&
    Number(legRow.price) === 40 &&
    legRow.show_contacts === "todos" &&
    Array.isArray(legRow.specialties) &&
    legRow.specialties.length === 2
  ) {
    ok("PT edita headline/bio/city/specialties/price/contactos normalmente (price vem como string do PostgREST)");
  } else {
    ko("edição legítima do currículo foi bloqueada", { status: leg.status, row: legRow });
  }

  // ================= cross-user continua bloqueado =================
  await patch(A, B.id, { headline: "invadido" });
  const hB = (await read(B, B.id, "headline"))[0].headline;
  if (hB === "Treinador de força") ok("cross-user: atleta não edita o perfil do PT (continua seguro)");
  else ko("cross-user update passou", hB);

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
