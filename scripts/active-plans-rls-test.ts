/**
 * Verificação das migrações 012 (active_plans) e 013 (training_plans:
 * aluno avança a progressão de um plano do PT, sem tocar no resto).
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/active-plans-rls-test.ts
 */
import { readFileSync } from "node:fs";

/** JSON.stringify determinístico (chaves ordenadas) — o Postgres não
 *  preserva a ordem de inserção das chaves de um jsonb, por isso uma
 *  comparação por string ingénua dá falso negativo em valores iguais. */
function jsonCanonico(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
}

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
  return { token: j.access_token, id: j.user.id };
}

const H = (u: U) => ({ apikey: KEY, authorization: `Bearer ${u.token}`, "content-type": "application/json" });
const get = (u: U, path: string) => fetch(`${REST}/${path}`, { headers: H(u) }).then((r) => r.json());
const post = (u: U, path: string, body: unknown) =>
  fetch(`${REST}/${path}`, { method: "POST", headers: { ...H(u), prefer: "return=representation" }, body: JSON.stringify(body) });
const patch = (u: U, path: string, body: unknown) =>
  fetch(`${REST}/${path}`, { method: "PATCH", headers: { ...H(u), prefer: "return=representation" }, body: JSON.stringify(body) });
const upsert = (u: U, path: string, body: unknown) =>
  fetch(`${REST}/${path}`, {
    method: "POST",
    headers: { ...H(u), prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(body),
  });

async function ligar(student: U, pt: U): Promise<string> {
  const code = `PTZ-${String(Date.now() % 100000).padStart(5, "0")}${Math.floor(Math.random() * 9)}`;
  await fetch(`${REST}/profiles?id=eq.${pt.id}&pt_code=is.null`, {
    method: "PATCH",
    headers: H(pt),
    body: JSON.stringify({ pt_code: code }),
  });
  const link = await post(student, "pt_links", {
    pt_id: pt.id,
    student_id: student.id,
    status: "pendente",
    requested_by: student.id,
    scope_treinos: true,
    scope_evolucao: false,
    scope_videos: false,
    scope_metricas: false,
  }).then((r) => r.json());
  const linkId = link[0]?.id as string;
  await patch(pt, `pt_links?id=eq.${linkId}`, { status: "ativo" });
  return linkId;
}

async function main() {
  const A = await signup("apA", "atleta", "Aluno A");
  const B = await signup("apB", "pt", "PT B");
  const C = await signup("apC", "atleta", "Estranho C");
  console.log(`Setup — A(aluno)=${A.id.slice(0, 8)}  B(pt)=${B.id.slice(0, 8)}  C=${C.id.slice(0, 8)}\n`);

  const dias = { version: 1, meta: {}, days: [] };

  // plano próprio de A
  const pA = await post(A, "training_plans", { owner_id: A.id, student_id: A.id, name: "Plano A", days: dias }).then((r) => r.json());
  const planoA = pA[0]?.id as string;

  // 1. active_plans: A escolhe o próprio plano
  const r1 = await upsert(A, "active_plans", { student_id: A.id, plan_id: planoA });
  const b1 = await r1.json();
  if (r1.status < 300 && Array.isArray(b1) && b1[0]?.plan_id === planoA) ok("aluno escolhe o próprio plano em active_plans");
  else ko("aluno não conseguiu escolher o próprio plano", b1);

  const r1b = await get(A, `active_plans?student_id=eq.${A.id}&select=plan_id`);
  if (Array.isArray(r1b) && r1b[0]?.plan_id === planoA) ok("aluno lê o próprio ponteiro active_plans");
  else ko("aluno não leu o próprio ponteiro", r1b);

  // 2. A não consegue apontar active_plans para um plano de um estranho
  const pC = await post(C, "training_plans", { owner_id: C.id, student_id: C.id, name: "Plano C", days: dias }).then((r) => r.json());
  const planoC = pC[0]?.id as string;
  const r2 = await upsert(A, "active_plans", { student_id: A.id, plan_id: planoC });
  if (r2.status >= 400) ok("aluno NÃO consegue apontar active_plans para o plano de um estranho");
  else ko("aluno conseguiu apontar o próprio active_plans para o plano de outra pessoa", await r2.json());

  // 3. estranho não lê nem escreve o active_plans de A
  const r3 = await get(C, `active_plans?student_id=eq.${A.id}&select=plan_id`);
  if (Array.isArray(r3) && r3.length === 0) ok("estranho NÃO lê o active_plans de A");
  else ko("estranho leu o active_plans de A", r3);
  const r3b = await upsert(C, "active_plans", { student_id: A.id, plan_id: planoC });
  const cRow = await get(A, `active_plans?student_id=eq.${A.id}&select=plan_id`);
  if (Array.isArray(cRow) && cRow[0]?.plan_id === planoA) ok("estranho NÃO consegue mudar o active_plans de A");
  else ko("estranho conseguiu mudar o active_plans de A", { tentativa: r3b.status, estadoFinal: cRow });

  // 4. liga A<->B, B cria plano para A
  const linkId = await ligar(A, B);
  const pB = await post(B, "training_plans", { owner_id: B.id, student_id: A.id, name: "Plano de B para A", days: dias }).then((r) => r.json());
  const planoB = pB[0]?.id as string;

  // 5. A escolhe o plano do PT (troca o active_plans para uma linha que não é sua)
  const r5 = await upsert(A, "active_plans", { student_id: A.id, plan_id: planoB });
  const b5 = await r5.json();
  if (r5.status < 300 && Array.isArray(b5) && b5[0]?.plan_id === planoB) ok("aluno escolhe o plano do PT (linha alheia) como ativo");
  else ko("aluno não conseguiu escolher o plano do PT", b5);

  // 6. B (PT) não mexe no active_plans de A
  const r6 = await upsert(B, "active_plans", { student_id: A.id, plan_id: planoA });
  const stillB = await get(A, `active_plans?student_id=eq.${A.id}&select=plan_id`);
  if (Array.isArray(stillB) && stillB[0]?.plan_id === planoB) ok("PT NÃO consegue mudar o active_plans do aluno");
  else ko("PT conseguiu mudar o active_plans do aluno", { tentativa: r6.status, estadoFinal: stillB });

  // 7. A avança a progressão do plano de B (não é o dono) — só `progression`.
  //    A progressão de um plano de PT NUNCA escreve `days` (calcula-se em
  //    leitura a partir do days base + progression) — por isso este pedido
  //    só manda `progression`, de propósito.
  const novaProgressao = { week: 2, loadBonus: 2.5, repBonus: 0, streak: 1, lastRpe: 8, deloadWeek: false, history: [] };
  const r7 = await patch(A, `training_plans?id=eq.${planoB}`, { progression: novaProgressao });
  const b7 = await r7.json();
  if (Array.isArray(b7) && b7[0]?.progression?.week === 2) {
    ok("aluno avança a progressão (só progression) do plano do PT");
  } else {
    ko("aluno NÃO conseguiu avançar a progressão do plano do PT (013/014 não aplicada ou incorreta)", b7);
  }

  // 7b. FALHA POTENCIAL (013 sem a 014): A tenta mudar os EXERCÍCIOS (days)
  //     do plano do PT — tem de FALHAR. Só o PT (dono) pode mudar days.
  const diasForjados = { version: 1, meta: {}, days: [{ dayIndex: 0, exercises: [{ name: "Exercício inventado pelo aluno" }] }] };
  const r7b = await patch(A, `training_plans?id=eq.${planoB}`, { days: diasForjados });
  const b7b = await r7b.json();
  if (r7b.status >= 400) {
    ok("aluno NÃO consegue mudar os exercícios (days) do plano do PT (bloqueado)");
  } else {
    ko("FALHA: aluno conseguiu reescrever os exercícios (days) do plano do PT", b7b);
  }

  // 7c. confirma que o days do plano do PT continua exatamente o que B escreveu
  const r7c = await get(B, `training_plans?id=eq.${planoB}&select=days`);
  const diasAtuais = Array.isArray(r7c) ? r7c[0]?.days : null;
  if (diasAtuais && jsonCanonico(diasAtuais) === jsonCanonico(dias)) {
    ok("days do plano do PT continua intacto depois das tentativas do aluno");
  } else {
    ko("days do plano do PT foi alterado", diasAtuais);
  }

  // 8. A NÃO consegue mudar name/split_style/is_active do plano do PT por essa via
  const r8 = await patch(A, `training_plans?id=eq.${planoB}`, { name: "Renomeado pelo aluno" });
  if (r8.status >= 400) ok("aluno NÃO consegue renomear o plano do PT (trigger bloqueia)");
  else ko("aluno conseguiu renomear o plano do PT", await r8.json());

  const r8b = await patch(A, `training_plans?id=eq.${planoB}`, { is_active: false });
  if (r8b.status >= 400) ok("aluno NÃO consegue mudar is_active do plano do PT por essa via");
  else ko("aluno conseguiu mudar is_active do plano do PT", await r8b.json());

  // 9. estranho C continua sem conseguir tocar no plano de B para A
  const r9 = await patch(C, `training_plans?id=eq.${planoB}`, { progression: novaProgressao });
  const b9 = await r9.json();
  if (Array.isArray(b9) && b9.length === 0) ok("estranho continua sem conseguir tocar no plano do PT para A");
  else ko("estranho conseguiu tocar no plano do PT para A", b9);

  // 10. revoga a ligação
  await patch(A, `pt_links?id=eq.${linkId}`, { status: "revogado" });

  // 10a. o aluno CONTINUA a conseguir avançar a própria progressão no plano
  //      do (ex-)PT — revogar é sobre o PT perder acesso, não sobre o aluno
  //      perder o plano que já estava a seguir.
  const progAposRevogar = { week: 3, loadBonus: 5, repBonus: 0, streak: 2, lastRpe: 8, deloadWeek: false, history: [] };
  const r10a = await patch(A, `training_plans?id=eq.${planoB}`, { progression: progAposRevogar });
  const b10a = await r10a.json();
  if (Array.isArray(b10a) && b10a[0]?.progression?.week === 3) {
    ok("depois de revogar, aluno CONTINUA a avançar a progressão do plano do (ex-)PT");
  } else {
    ko("aluno deixou de conseguir avançar a progressão depois de revogar o PT", b10a);
  }

  // 10b. o (ex-)PT deixa de VER o plano que criou
  const r10b = await get(B, `training_plans?id=eq.${planoB}&select=id`);
  if (Array.isArray(r10b) && r10b.length === 0) {
    ok("PT revogado deixa de VER o plano que criou (mesmo com o aluno a usá-lo)");
  } else {
    ko("PT revogado ainda vê o plano", r10b);
  }

  // 10c. aluno continua a poder escolher o próprio plano de motor de volta
  const r10c = await upsert(A, "active_plans", { student_id: A.id, plan_id: planoA });
  const b10c = await r10c.json();
  if (r10c.status < 300 && Array.isArray(b10c) && b10c[0]?.plan_id === planoA) {
    ok("depois de revogar o PT, aluno continua a poder reescolher o próprio plano");
  } else {
    ko("aluno ficou impedido de reescolher o próprio plano depois de revogar o PT", b10c);
  }

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
