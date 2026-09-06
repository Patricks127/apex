/**
 * SONDAGEM (não é ainda o teste final) da RLS atual de `training_plans`,
 * antes de construir "PT atribui plano". Não assume nada da memória — testa
 * contra a BD real.
 *
 * Perguntas:
 *   1. Um PT SEM ligação consegue inserir um plano para um aluno qualquer
 *      (owner_id=PT, student_id=aluno)?
 *   2. Um PT SEM ligação consegue UPDATE num plano existente do aluno?
 *   3. O dono de um plano consegue mudar o `student_id` para outra pessoa?
 *   4. O dono de um plano consegue mudar o `owner_id` para outra pessoa?
 *   5. Um estranho consegue SELECT um plano pelo `student_id` de outro user?
 *   6. Com uma ligação ATIVA + scope_treinos, o PT consegue inserir/UPDATE?
 *   7. Depois de revogada a ligação, o PT ligado anteriormente ainda
 *      consegue UPDATE o plano que tinha criado?
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/training-plans-rls-probe.ts
 */
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const URL_ = /^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)![1].trim();
const KEY = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m.exec(env)![1].trim();
const AUTH = `${URL_}/auth/v1`;
const REST = `${URL_}/rest/v1`;

const log = (label: string, body: unknown, status?: number) =>
  console.log(`  [${status ?? "?"}] ${label}:`, JSON.stringify(body));

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

async function main() {
  const A = await signup("tpA", "atleta", "Aluno A");
  const B = await signup("tpB", "pt", "PT B");
  const C = await signup("tpC", "atleta", "Estranho C");
  console.log(`Setup — A(aluno)=${A.id.slice(0, 8)}  B(pt)=${B.id.slice(0, 8)}  C(estranho)=${C.id.slice(0, 8)}\n`);

  const plano = { version: 1, meta: { goal: "hipertrofia" }, days: [] };

  console.log("--- 1. A cria o próprio plano (comportamento atual da app) ---");
  const r1 = await post(A, "training_plans", { owner_id: A.id, student_id: A.id, name: "Plano A", days: plano });
  const b1 = await r1.json();
  log("A insere owner=A student=A", b1, r1.status);
  const planoAId = Array.isArray(b1) ? b1[0]?.id : undefined;

  console.log("\n--- 2. B (PT) SEM ligação tenta inserir um plano PARA A ---");
  const r2 = await post(B, "training_plans", { owner_id: B.id, student_id: A.id, name: "Plano de B para A", days: plano });
  const b2 = await r2.json();
  log("B insere owner=B student=A (sem ligação)", b2, r2.status);

  console.log("\n--- 3. B (PT) SEM ligação tenta fazer UPDATE ao plano de A ---");
  const r3 = await patch(B, `training_plans?id=eq.${planoAId}`, { is_active: false });
  const b3 = await r3.json();
  log("B faz PATCH no plano de A (sem ligação)", b3, r3.status);

  console.log("\n--- 4. A tenta mudar o student_id do PRÓPRIO plano para C ---");
  const r4 = await patch(A, `training_plans?id=eq.${planoAId}`, { student_id: C.id });
  const b4 = await r4.json();
  log("A muda student_id do seu plano para C", b4, r4.status);

  console.log("\n--- 5. A tenta mudar o owner_id do PRÓPRIO plano para B ---");
  const r5 = await patch(A, `training_plans?id=eq.${planoAId}`, { owner_id: B.id });
  const b5 = await r5.json();
  log("A muda owner_id do seu plano para B", b5, r5.status);

  console.log("\n--- 6. C (estranho) tenta SELECT o plano de A por student_id ---");
  const r6 = await get(C, `training_plans?student_id=eq.${A.id}&select=id,owner_id,student_id`);
  log("C lê training_plans?student_id=eq.A", r6);

  console.log("\n--- 7. Liga A<->B (ativo, scope_treinos) ---");
  const code = `PTX-${String(Date.now() % 10000).padStart(4, "0")}`;
  await fetch(`${REST}/profiles?id=eq.${B.id}&pt_code=is.null`, {
    method: "PATCH",
    headers: H(B),
    body: JSON.stringify({ pt_code: code }),
  });
  const linkRes = await post(A, "pt_links", {
    pt_id: B.id,
    student_id: A.id,
    status: "pendente",
    requested_by: A.id,
    scope_treinos: true,
    scope_evolucao: false,
    scope_videos: false,
    scope_metricas: false,
  });
  const linkBody = await linkRes.json();
  const linkId = linkBody[0]?.id;
  await patch(B, `pt_links?id=eq.${linkId}`, { status: "ativo" });
  console.log("  ligação criada e ativa:", linkId);

  console.log("\n--- 8. B (PT AGORA ligado, scope_treinos) insere um plano PARA A ---");
  const r8 = await post(B, "training_plans", { owner_id: B.id, student_id: A.id, name: "Plano de B para A (ligado)", days: plano });
  const b8 = await r8.json();
  log("B insere owner=B student=A (ligado)", b8, r8.status);
  const planoBId = Array.isArray(b8) ? b8[0]?.id : undefined;

  console.log("\n--- 9. A (aluno) consegue LER o plano que B criou para ele? ---");
  const r9 = await get(A, `training_plans?owner_id=eq.${B.id}&select=id,name,student_id`);
  log("A lê training_plans?owner_id=eq.B", r9);

  console.log("\n--- 10. A (aluno) tenta editar o plano que B criou para ele ---");
  const r10 = await patch(A, `training_plans?id=eq.${planoBId}`, { name: "Editado pelo aluno" });
  const b10 = await r10.json();
  log("A faz PATCH no plano criado por B", b10, r10.status);

  console.log("\n--- 11. Revoga a ligação A<->B ---");
  await patch(A, `pt_links?id=eq.${linkId}`, { status: "revogado" });

  console.log("\n--- 12. B (PT revogado) tenta UPDATE no plano que ele próprio criou para A ---");
  const r12 = await patch(B, `training_plans?id=eq.${planoBId}`, { is_active: true });
  const b12 = await r12.json();
  log("B (revogado) faz PATCH no plano que criou para A", b12, r12.status);

  console.log("\n--- 13. B (PT revogado) ainda consegue LER o plano que criou para A? ---");
  const r13 = await get(B, `training_plans?id=eq.${planoBId}&select=id`);
  log("B (revogado) lê o plano que criou", r13);

  console.log("\nFIM DA SONDAGEM — ver acima quais pedidos deviam ter sido bloqueados (403/42501/vazio) e não foram.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
