/**
 * Verificação da migração 019 (training_plans_pt_ve_todos) contra a BD
 * real, usando LOGIN com contas já existentes e confirmadas — nunca signup
 * (Confirm email fica sempre ligado, não se desliga para testes).
 *
 * Contas usadas:
 *   PT     = patrick00santos@gmail.com (patrick santos)
 *   Aluno  = patrick00santos+alunoteste2@gmail.com (Aluno Teste Dois) —
 *            conta dedicada a testes, é aceitável mexer na sua ligação
 *            (revogar/recriar) desde que se restaure no fim.
 *
 * Nunca toca na ligação real PT<->edu graça nem em qualquer dado da
 * Daniela Paulino (não temos as credenciais dela, e não é preciso).
 *
 * Cria um plano de teste com is_active=false (para não interferir com o
 * plano "ativo" real do Aluno Teste Dois no /plano dele), identificado
 * pelo nome, nunca apagado (não há policy de DELETE em training_plans) mas
 * inofensivo por ficar inativo e só alcançável por id direto.
 *
 * Uso: node scripts/training-plans-rls-019-login-test.ts
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
  if (extra !== undefined) console.log("        ", JSON.stringify(extra));
};

type U = { token: string; id: string };

async function login(email: string, password: string): Promise<U> {
  const j = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
  if (!j.access_token) {
    console.error(`Login falhou para ${email}:`, j);
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
  const PT = await login("patrick00santos@gmail.com", "P155866k@");
  const ALUNO = await login("patrick00santos+alunoteste2@gmail.com", "Testpass123!");
  console.log(`PT=${PT.id.slice(0, 8)}  Aluno Teste Dois=${ALUNO.id.slice(0, 8)}\n`);

  // liga(gem) atual PT<->Aluno — confirma o estado antes de mexer em nada
  const linkAntes = await get(PT, `pt_links?student_id=eq.${ALUNO.id}&pt_id=eq.${PT.id}&select=id,status,scope_treinos`);
  const link0 = Array.isArray(linkAntes) ? linkAntes[0] : null;
  console.log("  ligação PT<->Aluno Teste Dois antes do teste:", link0);
  if (!link0 || link0.status !== "ativo" || !link0.scope_treinos) {
    console.error("Pré-condição falhou: esperava ligação ativa com scope_treinos entre PT e Aluno Teste Dois.");
    process.exit(2);
  }
  const linkId = link0.id as string;

  const dias = { version: 1, meta: {}, days: [] };

  // 1. Aluno cria um plano PRÓPRIO de teste (self-made), is_active=false
  //    de propósito — não deve tornar-se "o plano ativo" do Aluno Teste
  //    Dois no /plano dele; a RLS de SELECT não olha para is_active, por
  //    isso isto não invalida o teste.
  const criado = await post(ALUNO, "training_plans", {
    owner_id: ALUNO.id,
    student_id: ALUNO.id,
    name: "[teste RLS 019] self-made",
    days: dias,
    is_active: false,
  }).then((r) => r.json());
  const planoSelfMade = criado[0]?.id as string;
  if (planoSelfMade) ok("Aluno Teste Dois cria o seu próprio plano de teste (self-made)");
  else ko("Aluno Teste Dois não conseguiu criar o plano de teste", criado);

  // 2. CASO: PT vê o plano self-made do aluno (objetivo da 019)
  const r2 = await get(PT, `training_plans?id=eq.${planoSelfMade}&select=id,name,owner_id,student_id`);
  if (Array.isArray(r2) && r2.length === 1) ok("PT vê o plano self-made do Aluno Teste Dois (objetivo da 019)");
  else ko("PT não viu o plano self-made do aluno", r2);

  // 3. CASO: PT NÃO edita esse plano — só vê (UPDATE inalterado, exige owner_id = auth.uid())
  const r3 = await patch(PT, `training_plans?id=eq.${planoSelfMade}`, { name: "Hackeado pelo PT" });
  const b3 = await r3.json();
  if (r3.status >= 400 || (Array.isArray(b3) && b3.length === 0)) {
    ok("PT NÃO edita o plano self-made do aluno (vê, não edita)");
  } else {
    ko("PT conseguiu editar o plano self-made do aluno — REGRESSÃO GRAVE", b3);
  }

  // 4. Revoga a ligação (o próprio aluno revoga — fluxo real)
  const revogar = await patch(ALUNO, `pt_links?id=eq.${linkId}`, { status: "revogado" });
  if (revogar.status >= 200 && revogar.status < 300) ok("Aluno Teste Dois revoga a ligação com o PT (fluxo normal)");
  else ko("Falha ao revogar a ligação de teste", await revogar.json());

  // 5. CASO: depois de revogar, PT deixa de ver TUDO do aluno, incluindo o self-made
  //    (isto também cobre, pela mesma lógica de pt_has_scope(), o caso "PT sem
  //    ligação nenhuma" — para a RLS não há diferença entre "nunca ligado" e
  //    "ligação revogada": pt_has_scope() só olha ao estado ATUAL.)
  const r5 = await get(PT, `training_plans?student_id=eq.${ALUNO.id}&select=id`);
  if (Array.isArray(r5) && r5.length === 0) {
    ok("PT revogado deixa de ver TODOS os planos do aluno, incluindo o self-made (cobre também 'sem ligação')");
  } else {
    ko("PT revogado ainda vê planos do aluno — REGRESSÃO GRAVE", r5);
  }

  // 6. Restaura a ligação pelo fluxo normal (pedido -> aceitar). pt_links
  //    tem unique(pt_id, student_id) — não dá para inserir uma linha nova
  //    enquanto a antiga (agora "revogado") existe; reativa-se a MESMA
  //    linha: aluno reabre para "pendente", PT aceita para "ativo".
  const reabrir = await patch(ALUNO, `pt_links?id=eq.${linkId}`, {
    status: "pendente",
    requested_by: ALUNO.id,
  });
  const reabrirBody = await reabrir.json();
  if (Array.isArray(reabrirBody) && reabrirBody[0]?.status === "pendente") {
    ok("Aluno Teste Dois reabre o pedido de ligação (fluxo normal, mesma linha)");
    const aceite = await patch(PT, `pt_links?id=eq.${linkId}`, { status: "ativo" });
    const aceiteBody = await aceite.json();
    if (Array.isArray(aceiteBody) && aceiteBody[0]?.status === "ativo") {
      ok("PT aceita — ligação PT<->Aluno Teste Dois restaurada ao estado anterior");
    } else {
      ko("Não consegui aceitar o pedido de restauro — restaurar manualmente!", aceiteBody);
    }
  } else {
    ko("Não consegui reabrir o pedido de ligação — restaurar manualmente!", reabrirBody);
  }

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  console.log("\nNÃO testado nesta corrida (falta de conta): ver relatório em separado — precisa de uma 2ª conta de PT confirmada.");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
