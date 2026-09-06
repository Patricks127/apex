/**
 * Verificação da migração 011 (training_plans_rls_hardening) contra a BD
 * real. Cobre as 3 falhas encontradas na sondagem (scripts/training-plans-
 * rls-probe.ts) + o que já funcionava antes.
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/training-plans-rls-test.ts
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

async function ligar(student: U, pt: U): Promise<string> {
  const code = `PTT-${String(Date.now() % 100000).padStart(5, "0")}${Math.floor(Math.random() * 9)}`;
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
  const A = await signup("trA", "atleta", "Aluno A");
  const B = await signup("trB", "pt", "PT B");
  const C = await signup("trC", "atleta", "Estranho/vítima C");
  console.log(`Setup — A(aluno)=${A.id.slice(0, 8)}  B(pt)=${B.id.slice(0, 8)}  C=${C.id.slice(0, 8)}\n`);

  const dias = { version: 1, meta: {}, days: [] };

  // 1. plano próprio — CRUD normal continua a funcionar
  const p1 = await post(A, "training_plans", { owner_id: A.id, student_id: A.id, name: "Plano A", days: dias }).then((r) => r.json());
  const planoA = p1[0]?.id as string;
  if (planoA) ok("atleta cria o próprio plano");
  else ko("atleta não conseguiu criar o próprio plano", p1);

  const selfRead = await get(A, `training_plans?id=eq.${planoA}&select=id`);
  if (Array.isArray(selfRead) && selfRead.length === 1) ok("atleta lê o próprio plano");
  else ko("atleta não leu o próprio plano", selfRead);

  const selfUpdate = await patch(A, `training_plans?id=eq.${planoA}`, { name: "Plano A (editado)" });
  const selfUpdateBody = await selfUpdate.json();
  if (Array.isArray(selfUpdateBody) && selfUpdateBody[0]?.name === "Plano A (editado)") {
    ok("atleta edita o próprio plano (colunas normais)");
  } else {
    ko("atleta não conseguiu editar o próprio plano", selfUpdateBody);
  }

  // 2. PT SEM ligação não insere plano para A
  const r2 = await post(B, "training_plans", { owner_id: B.id, student_id: A.id, name: "Intruso", days: dias });
  const b2 = await r2.json();
  if (r2.status >= 400 && b2?.code === "42501") ok("PT sem ligação NÃO insere plano para o aluno (42501)");
  else ko("PT sem ligação conseguiu inserir plano", b2);

  // 3. PT SEM ligação não edita o plano de A
  const r3 = await patch(B, `training_plans?id=eq.${planoA}`, { is_active: false });
  const b3 = await r3.json();
  if (Array.isArray(b3) && b3.length === 0) ok("PT sem ligação NÃO edita o plano do aluno (0 linhas)");
  else ko("PT sem ligação conseguiu editar o plano do aluno", b3);

  // 4. FALHA 1 (corrigida): student_id é imutável
  const r4 = await patch(A, `training_plans?id=eq.${planoA}`, { student_id: C.id });
  const b4 = await r4.json();
  if (r4.status >= 400) ok("student_id é IMUTÁVEL — atleta não consegue redirecionar o próprio plano (bloqueado)");
  else ko("FALHA 1 continua aberta: student_id foi alterado", b4);

  // 5. owner_id continua imutável
  const r5 = await patch(A, `training_plans?id=eq.${planoA}`, { owner_id: B.id });
  const b5 = await r5.json();
  if (r5.status >= 400) ok("owner_id é IMUTÁVEL — atleta não consegue mudar o dono do plano");
  else ko("atleta conseguiu mudar owner_id", b5);

  // 6. estranho não lê por student_id
  const r6 = await get(C, `training_plans?student_id=eq.${A.id}&select=id`);
  if (Array.isArray(r6) && r6.length === 0) ok("estranho NÃO lê o plano de A por student_id");
  else ko("estranho conseguiu ler o plano de A", r6);

  // 7. liga A<->B (ativo, scope_treinos)
  const linkId = await ligar(A, B);
  console.log("  ligação A<->B ativa:", linkId);

  // 8. PT LIGADO insere plano para A
  const p8 = await post(B, "training_plans", { owner_id: B.id, student_id: A.id, name: "Plano de B para A", days: dias }).then((r) => r.json());
  const planoB = p8[0]?.id as string;
  if (planoB) ok("PT ligado (scope 'treinos') insere plano para o aluno");
  else ko("PT ligado não conseguiu inserir plano", p8);

  // 9. aluno LÊ o plano que o PT criou
  const r9 = await get(A, `training_plans?id=eq.${planoB}&select=id,name`);
  if (Array.isArray(r9) && r9.length === 1) ok("aluno lê o plano que o PT lhe atribuiu");
  else ko("aluno não conseguiu ler o plano do PT", r9);

  // 10. aluno NÃO edita o plano do PT
  const r10 = await patch(A, `training_plans?id=eq.${planoB}`, { name: "Hackeado pelo aluno" });
  const b10 = await r10.json();
  if (Array.isArray(b10) && b10.length === 0) ok("aluno NÃO edita o plano atribuído pelo PT (0 linhas)");
  else ko("aluno conseguiu editar o plano do PT", b10);

  // 11. FALHA 1b (corrigida): PT não redireciona o plano do aluno para uma vítima sem ligação
  const r11 = await patch(B, `training_plans?id=eq.${planoB}`, { student_id: C.id });
  const b11 = await r11.json();
  if (r11.status >= 400) ok("PT não consegue redirecionar o plano de A para C (student_id imutável)");
  else ko("FALHA 1b continua aberta: PT redirecionou o plano para uma vítima sem ligação", b11);

  // 12. PT ligado consegue editar o próprio plano que atribuiu
  const r12 = await patch(B, `training_plans?id=eq.${planoB}`, { name: "Plano de B para A (revisto)" });
  const b12 = await r12.json();
  if (Array.isArray(b12) && b12[0]?.name === "Plano de B para A (revisto)") {
    ok("PT ligado edita o plano que atribuiu");
  } else {
    ko("PT ligado não conseguiu editar o próprio plano atribuído", b12);
  }

  // 13. revoga a ligação
  await patch(A, `pt_links?id=eq.${linkId}`, { status: "revogado" });

  // 14. FALHA 3 (corrigida): PT revogado não edita mais
  const r14 = await patch(B, `training_plans?id=eq.${planoB}`, { is_active: false });
  const b14 = await r14.json();
  if (Array.isArray(b14) && b14.length === 0) ok("PT revogado NÃO edita mais o plano que criou (0 linhas)");
  else ko("FALHA 3 continua aberta: PT revogado ainda editou o plano", b14);

  // 15. FALHA 3 (corrigida): PT revogado não lê mais
  const r15 = await get(B, `training_plans?id=eq.${planoB}&select=id`);
  if (Array.isArray(r15) && r15.length === 0) ok("PT revogado NÃO lê mais o plano que criou");
  else ko("FALHA 3 continua aberta: PT revogado ainda lê o plano", r15);

  // 16. o aluno continua a ver o plano mesmo depois de revogar o PT que o fez
  const r16 = await get(A, `training_plans?id=eq.${planoB}&select=id`);
  if (Array.isArray(r16) && r16.length === 1) ok("aluno continua a ver o plano do (ex-)PT depois de revogar");
  else ko("aluno perdeu a visibilidade do próprio plano depois de revogar o PT", r16);

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
