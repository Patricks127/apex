/**
 * Testa o GATING DE CONTACTOS no HTML renderizado de /pt/[codigo].
 * Precisa do dev server a correr (BASE por env, ex.: BASE=http://localhost:3025).
 * "Confirm email" DESLIGADO.
 */
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const URL_ = /^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)![1].trim();
const KEY = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m.exec(env)![1].trim();
const REF = new URL(URL_).host.split(".")[0];
const AUTH = `${URL_}/auth/v1`;
const REST = `${URL_}/rest/v1`;
const BASE = process.env.BASE || "http://localhost:3025";
const COOKIE = `sb-${REF}-auth-token`;

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

async function signup(role: "atleta" | "pt", name: string) {
  const email = `patrick00santos+rr${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
  const j = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Testpass123!", data: { name, role } }),
  }).then((r) => r.json());
  if (!j.access_token) {
    console.error("Signup sem sessão — 'Confirm email' ligado?", j);
    process.exit(2);
  }
  return { session: j, id: j.user.id, token: j.access_token as string };
}

// cookie do @supabase/ssr: "base64-" + base64(JSON da sessão), possivelmente
// dividido em .0/.1 (>3600 chars). Aqui as sessões cabem num só cookie.
function cookieFor(session: unknown): string {
  const payload = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
  return `${COOKIE}=${payload}`;
}

const H = (t: string) => ({ apikey: KEY, authorization: `Bearer ${t}`, "content-type": "application/json" });
const rest = (t: string, p: string, init: RequestInit = {}) =>
  fetch(`${REST}/${p}`, { ...init, headers: { ...H(t), ...(init.headers ?? {}) } });

async function getHtml(cookie: string, path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  return { status: r.status, html: await r.text() };
}

const PHONE = "919" + String(Date.now()).slice(-6);

async function main() {
  const B = await signup("pt", "Coach Render");
  const A = await signup("atleta", "Atleta NaoLigado");
  const L = await signup("atleta", "Atleta Ligado");
  console.log(`Setup — B(pt)=${B.id.slice(0, 8)} A=${A.id.slice(0, 8)} L=${L.id.slice(0, 8)}  phone=${PHONE}\n`);

  const code = `RRB-${String(Date.now() % 10000).padStart(4, "0")}`;
  await rest(B.token, `profiles?id=eq.${B.id}&pt_code=is.null`, { method: "PATCH", body: JSON.stringify({ pt_code: code }) });
  await rest(B.token, `profiles?id=eq.${B.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      headline: "Só alunos veem o contacto",
      show_contacts: "alunos",
    }),
  });
  // contactos numa tabela à parte (migração 024)
  await rest(B.token, `contactos_pt`, {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: B.id, contact_phone: PHONE, contact_email: "render@exemplo.pt" }),
  });

  const cookieA = cookieFor(A.session);
  const cookieL = cookieFor(L.session);

  // sanity: o cookie autentica?
  const painel = await getHtml(cookieA, "/painel");
  if (painel.status === 200) ok("cookie de sessão reconstruído autentica (/painel = 200)");
  else {
    ko("o cookie não autenticou — não dá para testar o render", painel.status);
    console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
    process.exit(1);
  }

  // 1. atleta NÃO ligado, show_contacts='alunos' → telefone NÃO aparece
  const r1 = await getHtml(cookieA, `/pt/${code}`);
  if (r1.status === 200 && !r1.html.includes(PHONE) && /só mostra os contactos aos seus alunos/i.test(r1.html)) {
    ok("atleta não-ligado + show_contacts='alunos' → HTML NÃO contém o telefone (mostra o cadeado)");
  } else {
    ko("o telefone apareceu a um atleta não-ligado", { status: r1.status, temPhone: r1.html.includes(PHONE) });
  }

  // 2. ligar L↔B e aceitar → L vê o telefone
  const link = await rest(L.token, "pt_links", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ pt_id: B.id, student_id: L.id, status: "pendente", requested_by: L.id, scope_treinos: true }),
  }).then((r) => r.json());
  await rest(B.token, `pt_links?id=eq.${link[0].id}`, { method: "PATCH", body: JSON.stringify({ status: "ativo" }) });

  const r2 = await getHtml(cookieL, `/pt/${code}`);
  if (r2.status === 200 && r2.html.includes(PHONE)) {
    ok("aluno LIGADO → HTML contém o telefone");
  } else {
    ko("o aluno ligado NÃO viu o telefone", { status: r2.status });
  }

  // 3. show_contacts='todos' → o atleta não-ligado passa a ver
  await rest(B.token, `profiles?id=eq.${B.id}`, { method: "PATCH", body: JSON.stringify({ show_contacts: "todos" }) });
  const r3 = await getHtml(cookieA, `/pt/${code}`);
  if (r3.status === 200 && r3.html.includes(PHONE)) {
    ok("show_contacts='todos' → qualquer atleta autenticado vê o telefone");
  } else {
    ko("com 'todos' o telefone continuou escondido", { status: r3.status });
  }

  // 4. /descobrir não lista atletas
  const desc = await getHtml(cookieA, "/descobrir?q=atleta");
  if (desc.status === 200 && !desc.html.includes("Atleta NaoLigado")) {
    ok("/descobrir?q=atleta → não lista atletas (só PTs)");
  } else {
    ko("/descobrir mostrou um atleta");
  }

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
