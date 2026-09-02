/**
 * RLS de workout_checkins / workout_sessions (dados clínicos sensíveis).
 *
 * Confirma que:
 *   - o DONO vê e escreve os seus registos;
 *   - um PT LIGADO (link ativo, scope 'treinos') vê os registos do aluno;
 *   - um PT sem link, ou um utilizador qualquer, NÃO vê nada;
 *   - depois de revogar a ligação, o PT deixa de ver;
 *   - ninguém além do dono consegue ESCREVER um check-in do aluno.
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/checkins-rls-test.ts
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

type U = { token: string; id: string; email: string };

async function signup(tag: string, role: "atleta" | "pt", name: string): Promise<U> {
  const email = `patrick00santos+${tag}${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
  const j = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Testpass123!", data: { name, role } }),
  }).then((r) => r.json());
  if (!j.access_token) {
    console.error("Signup sem sessão — 'Confirm email' ligado?", j);
    process.exit(2);
  }
  return { token: j.access_token, id: j.user.id, email };
}

const H = (u: U) => ({
  apikey: KEY,
  authorization: `Bearer ${u.token}`,
  "content-type": "application/json",
});
const get = (u: U, path: string) => fetch(`${REST}/${path}`, { headers: H(u) }).then((r) => r.json());
const post = (u: U, path: string, body: unknown, repr = false) =>
  fetch(`${REST}/${path}`, {
    method: "POST",
    headers: repr ? { ...H(u), prefer: "return=representation" } : H(u),
    body: JSON.stringify(body),
  });

async function main() {
  const A = await signup("chkA", "atleta", "Aluno A");
  const B = await signup("chkB", "pt", "PT B");
  const C = await signup("chkC", "atleta", "Estranho C");
  console.log(`Setup — A=${A.id.slice(0, 8)}  B(pt)=${B.id.slice(0, 8)}  C=${C.id.slice(0, 8)}\n`);

  // A regista uma sessão + check-in com desconforto
  const sess = await post(
    A,
    "workout_sessions",
    { user_id: A.id, title: "Inferior A", n_sets: 12, volume_kg: 4200, avg_rpe: 7, completion: 1, week_number: 1 },
    true,
  ).then((r) => r.json());
  const sessionId = sess[0]?.id;
  await post(A, "workout_checkins", {
    user_id: A.id,
    session_id: sessionId,
    discomfort_zones: ["ombro"],
    effort: "equilibrado",
    note: "ombro a queixar-se no supino",
  });

  // 1. dono vê o próprio
  const aSelf = await get(A, `workout_checkins?user_id=eq.${A.id}&select=discomfort_zones,note`);
  if (Array.isArray(aSelf) && aSelf.length === 1 && aSelf[0].discomfort_zones[0] === "ombro") {
    ok("dono vê o seu próprio check-in");
  } else {
    ko("dono não viu o próprio check-in", aSelf);
  }

  // 2. PT sem ligação não vê
  const bBefore = await get(B, `workout_checkins?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(bBefore) && bBefore.length === 0) ok("PT sem ligação NÃO vê os check-ins do aluno");
  else ko("PT sem ligação viu check-ins", bBefore);

  const bSessBefore = await get(B, `workout_sessions?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(bSessBefore) && bSessBefore.length === 0) ok("PT sem ligação NÃO vê as sessões do aluno");
  else ko("PT sem ligação viu sessões", bSessBefore);

  // 3. utilizador qualquer não vê
  const cView = await get(C, `workout_checkins?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(cView) && cView.length === 0) ok("utilizador não-relacionado NÃO vê os check-ins");
  else ko("utilizador não-relacionado viu check-ins", cView);

  // 4. ligar A → B com scope 'treinos', B aceita
  const code = `PTB-${String(Date.now() % 10000).padStart(4, "0")}`;
  await fetch(`${REST}/profiles?id=eq.${B.id}&pt_code=is.null`, {
    method: "PATCH",
    headers: H(B),
    body: JSON.stringify({ pt_code: code }),
  });
  const link = await post(
    A,
    "pt_links",
    {
      pt_id: B.id,
      student_id: A.id,
      status: "pendente",
      requested_by: A.id,
      scope_treinos: true,
      scope_evolucao: false,
      scope_videos: false,
      scope_metricas: false,
    },
    true,
  ).then((r) => r.json());
  const linkId = link[0]?.id;
  await fetch(`${REST}/pt_links?id=eq.${linkId}`, {
    method: "PATCH",
    headers: H(B),
    body: JSON.stringify({ status: "ativo" }),
  });

  // 5. PT ligado vê
  const bAfter = await get(B, `workout_checkins?user_id=eq.${A.id}&select=discomfort_zones,note`);
  if (Array.isArray(bAfter) && bAfter.length === 1 && bAfter[0].note?.includes("ombro")) {
    ok("PT ligado (scope 'treinos') VÊ os check-ins do aluno");
  } else {
    ko("PT ligado não viu os check-ins", bAfter);
  }
  const bSessAfter = await get(B, `workout_sessions?user_id=eq.${A.id}&select=title`);
  if (Array.isArray(bSessAfter) && bSessAfter.length === 1) ok("PT ligado VÊ as sessões do aluno");
  else ko("PT ligado não viu as sessões", bSessAfter);

  // 6. C continua sem ver
  const cAfter = await get(C, `workout_checkins?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(cAfter) && cAfter.length === 0) ok("terceiro continua sem ver mesmo com a ligação A↔B ativa");
  else ko("terceiro passou a ver", cAfter);

  // 7. PT não pode ESCREVER um check-in do aluno
  const sess2 = await post(
    A,
    "workout_sessions",
    { user_id: A.id, title: "Superior A", week_number: 1 },
    true,
  ).then((r) => r.json());
  const forge = await post(B, "workout_checkins", {
    user_id: A.id,
    session_id: sess2[0].id,
    discomfort_zones: ["joelho"],
  });
  const forgeBody = await forge.json();
  if (forgeBody?.code === "42501") ok("PT NÃO pode gravar um check-in em nome do aluno (42501)");
  else ko("PT conseguiu gravar check-in do aluno", forgeBody);

  // 8. revogar a ligação → PT deixa de ver
  await fetch(`${REST}/pt_links?id=eq.${linkId}&student_id=eq.${A.id}`, {
    method: "PATCH",
    headers: H(A),
    body: JSON.stringify({ status: "revogado" }),
  });
  const bRevoked = await get(B, `workout_checkins?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(bRevoked) && bRevoked.length === 0) ok("após revogar, o PT deixa de ver os check-ins");
  else ko("PT ainda vê os check-ins depois de revogada a ligação", bRevoked);

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
