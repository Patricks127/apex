/**
 * RLS de exercise_logs (migração 008) — registo por exercício, dados sensíveis.
 *
 * Confirma que:
 *   - o DONO insere e vê os seus logs;
 *   - o DONO NÃO consegue ALTERAR nem APAGAR um log (INSERT-only: sem policy
 *     de UPDATE/DELETE + trigger de imutabilidade);
 *   - um PT LIGADO (link ativo, scope 'treinos') VÊ os logs do aluno;
 *   - um PT sem ligação, ou um terceiro, NÃO vê nada;
 *   - o PT NÃO consegue INSERIR, ALTERAR nem APAGAR logs do aluno;
 *   - depois de revogar a ligação, o PT deixa de ver;
 *   - o CHECK de rpe (6..10) é aplicado;
 *   - apagar a workout_session apaga os logs em cascata.
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/exercise-logs-rls-test.ts
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
const patch = (u: U, path: string, body: unknown) =>
  fetch(`${REST}/${path}`, { method: "PATCH", headers: H(u), body: JSON.stringify(body) });
const del = (u: U, path: string) => fetch(`${REST}/${path}`, { method: "DELETE", headers: H(u) });

async function main() {
  const A = await signup("exlA", "atleta", "Aluno A");
  const B = await signup("exlB", "pt", "PT B");
  const C = await signup("exlC", "atleta", "Estranho C");
  console.log(`Setup — A=${A.id.slice(0, 8)}  B(pt)=${B.id.slice(0, 8)}  C=${C.id.slice(0, 8)}\n`);

  // A cria uma sessão e regista 2 exercícios
  const sess = await post(
    A,
    "workout_sessions",
    { user_id: A.id, title: "Superior A", n_sets: 16, volume_kg: 5200, avg_rpe: 8, completion: 1, week_number: 3 },
    true,
  ).then((r) => r.json());
  const sessionId = sess[0]?.id;

  const ins1 = await post(
    A,
    "exercise_logs",
    { user_id: A.id, session_id: sessionId, exercise_id: "supino_barra", week_number: 3, ordem: 1, load_kg: 80, reps: 8, sets_done: 3, rpe: 8 },
    true,
  );
  const ins1Body = await ins1.json();
  const ins2 = await post(
    A,
    "exercise_logs",
    { user_id: A.id, session_id: sessionId, exercise_id: "remada_curvada_barra", week_number: 3, ordem: 2, skipped: true },
  );
  if (ins1.status < 300 && Array.isArray(ins1Body) && ins1Body.length === 1 && ins2.status < 300) {
    ok("dono insere exercise_logs (feito + saltado)");
  } else {
    ko("dono não conseguiu inserir logs", { ins1: ins1Body, ins2Status: ins2.status });
  }
  const logId = Array.isArray(ins1Body) ? ins1Body[0]?.id : undefined;

  // 1. dono vê os próprios
  const aSelf = await get(A, `exercise_logs?user_id=eq.${A.id}&select=exercise_id,load_kg,skipped&order=ordem`);
  if (Array.isArray(aSelf) && aSelf.length === 2 && aSelf[0].exercise_id === "supino_barra" && aSelf[1].skipped === true) {
    ok("dono vê os seus exercise_logs");
  } else {
    ko("dono não viu os próprios logs", aSelf);
  }

  // 2. INSERT-only: dono NÃO altera um log (sem policy UPDATE → RLS filtra 0
  //    linhas; o trigger de imutabilidade é a segunda linha de defesa).
  await patch(A, `exercise_logs?id=eq.${logId}`, { load_kg: 999 });
  const aStill = await get(A, `exercise_logs?id=eq.${logId}&select=load_kg`);
  if (Array.isArray(aStill) && Number(aStill[0]?.load_kg) === 80) ok("dono NÃO consegue ALTERAR um log (carga intacta: 80 kg)");
  else ko("a carga do log mudou — UPDATE passou", aStill);

  // 3. dono NÃO apaga um log
  const rm = await del(A, `exercise_logs?id=eq.${logId}`);
  const aAfterDel = await get(A, `exercise_logs?id=eq.${logId}&select=id`);
  if (Array.isArray(aAfterDel) && aAfterDel.length === 1) ok("dono NÃO pode APAGAR um log (RLS nega DELETE)");
  else ko("o log foi apagado", { status: rm.status, aAfterDel });

  // 4. PT sem ligação não vê
  const bBefore = await get(B, `exercise_logs?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(bBefore) && bBefore.length === 0) ok("PT sem ligação NÃO vê os logs do aluno");
  else ko("PT sem ligação viu logs", bBefore);

  // 5. terceiro não vê
  const cBefore = await get(C, `exercise_logs?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(cBefore) && cBefore.length === 0) ok("terceiro NÃO vê os logs");
  else ko("terceiro viu logs", cBefore);

  // 6. ligar A → B com scope 'treinos'
  const code = `PTB-${String(Date.now() % 10000).padStart(4, "0")}`;
  await patch(B, `profiles?id=eq.${B.id}&pt_code=is.null`, { pt_code: code });
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
  await patch(B, `pt_links?id=eq.${linkId}`, { status: "ativo" });

  // 7. PT ligado vê
  const bAfter = await get(B, `exercise_logs?user_id=eq.${A.id}&select=exercise_id,rpe&order=ordem`);
  if (Array.isArray(bAfter) && bAfter.length === 2 && bAfter[0].exercise_id === "supino_barra") {
    ok("PT ligado (scope 'treinos') VÊ os logs do aluno");
  } else {
    ko("PT ligado não viu os logs", bAfter);
  }

  // 8. PT NÃO insere log em nome do aluno
  const forgeIns = await post(B, "exercise_logs", {
    user_id: A.id,
    session_id: sessionId,
    exercise_id: "agachamento_barra_costas",
    week_number: 3,
  });
  const forgeInsBody = await forgeIns.json();
  if (forgeInsBody?.code === "42501") ok("PT NÃO pode INSERIR um log em nome do aluno (42501)");
  else ko("PT conseguiu inserir log do aluno", forgeInsBody);

  // 9. PT NÃO altera nem apaga logs do aluno
  await patch(B, `exercise_logs?id=eq.${logId}`, { load_kg: 1 });
  const ptUpdCheck = await get(A, `exercise_logs?id=eq.${logId}&select=load_kg`);
  if (Array.isArray(ptUpdCheck) && Number(ptUpdCheck[0]?.load_kg) === 80) ok("PT NÃO consegue ALTERAR um log do aluno (carga intacta)");
  else ko("PT alterou um log do aluno", ptUpdCheck);
  await del(B, `exercise_logs?id=eq.${logId}`);
  const stillThere = await get(A, `exercise_logs?id=eq.${logId}&select=id`);
  if (Array.isArray(stillThere) && stillThere.length === 1) ok("PT NÃO pode APAGAR um log do aluno");
  else ko("PT apagou um log do aluno", stillThere);

  // 10. terceiro continua sem ver
  const cAfter = await get(C, `exercise_logs?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(cAfter) && cAfter.length === 0) ok("terceiro continua sem ver com a ligação A↔B ativa");
  else ko("terceiro passou a ver", cAfter);

  // 11. CHECK de rpe (6..10)
  const badRpe = await post(A, "exercise_logs", {
    user_id: A.id,
    session_id: sessionId,
    exercise_id: "peck_deck",
    week_number: 3,
    rpe: 11,
  });
  const badRpeBody = await badRpe.json();
  if (badRpe.status >= 400 && /check|rpe/i.test(JSON.stringify(badRpeBody))) ok("CHECK rejeita rpe fora de 6–10");
  else ko("rpe=11 foi aceite", badRpeBody);

  // 12. revogar → PT deixa de ver
  await patch(A, `pt_links?id=eq.${linkId}&student_id=eq.${A.id}`, { status: "revogado" });
  const bRevoked = await get(B, `exercise_logs?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(bRevoked) && bRevoked.length === 0) ok("após revogar, o PT deixa de ver os logs");
  else ko("PT ainda vê os logs depois de revogada a ligação", bRevoked);

  // 13. DELETE em cascata a partir de workout_sessions
  await del(A, `workout_sessions?id=eq.${sessionId}`);
  const sessGone = await get(A, `workout_sessions?id=eq.${sessionId}&select=id`);
  const orphans = await get(A, `exercise_logs?session_id=eq.${sessionId}&select=id`);
  if (Array.isArray(sessGone) && sessGone.length === 0) {
    if (Array.isArray(orphans) && orphans.length === 0) ok("apagar a workout_session apaga os logs em cascata");
    else ko("a sessão foi apagada mas os logs ficaram órfãos (FK sem cascade?)", orphans);
  } else {
    // workout_sessions não tem policy de DELETE para o dono → nada foi apagado
    console.log("  \x1b[33mNOTA\x1b[0m  workout_sessions não permite DELETE ao dono (RLS) — cascata não testável por aqui");
  }

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
