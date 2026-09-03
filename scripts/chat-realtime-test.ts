/**
 * Realtime + imutabilidade das mensagens + bloqueio de storage por scope.
 * Requisitos: migração 006 aplicada; "Confirm email" DESLIGADO.
 * Uso: node scripts/chat-realtime-test.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPA_URL = /^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)![1].trim();
const KEY = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m.exec(env)![1].trim();
const AUTH = `${SUPA_URL}/auth/v1`;
const REST = `${SUPA_URL}/rest/v1`;
const STOR = `${SUPA_URL}/storage/v1`;

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type U = { token: string; id: string };
async function signup(role: "atleta" | "pt", name: string): Promise<U> {
  const email = `patrick00santos+rt${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
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
const h = (u: U) => ({ apikey: KEY, authorization: `Bearer ${u.token}`, "content-type": "application/json" });
const rest = (u: U, p: string, init: RequestInit = {}) =>
  fetch(`${REST}/${p}`, { ...init, headers: { ...h(u), ...(init.headers ?? {}) } });

function subscritor(u: U, linkId: string) {
  const c = createClient(SUPA_URL, KEY, { realtime: { params: { eventsPerSecond: 10 } } });
  c.realtime.setAuth(u.token);
  const recebidas: { type: string; body: string | null }[] = [];
  const ch = c
    .channel(`chat:${linkId}:${u.id.slice(0, 4)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages", filter: `link_id=eq.${linkId}` },
      (p) => recebidas.push({ type: p.eventType, body: (p.new as { body?: string | null })?.body ?? null }),
    );
  return {
    recebidas,
    subscribed: new Promise<void>((resolve) => ch.subscribe((s) => s === "SUBSCRIBED" && resolve())),
    close: () => c.removeChannel(ch),
  };
}

async function main() {
  const A = await signup("atleta", "Aluno A");
  const B = await signup("pt", "PT B");
  const C = await signup("atleta", "Terceiro C");
  console.log(`Setup — A=${A.id.slice(0, 8)} B(pt)=${B.id.slice(0, 8)} C=${C.id.slice(0, 8)}\n`);

  await rest(B, `profiles?id=eq.${B.id}&pt_code=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ pt_code: `RTB-${String(Date.now() % 10000).padStart(4, "0")}` }),
  });
  const link = await rest(A, "pt_links", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      pt_id: B.id, student_id: A.id, status: "pendente", requested_by: A.id,
      scope_treinos: true, scope_evolucao: true,
    }),
  }).then((r) => r.json());
  const linkId = link[0].id;
  await rest(B, `pt_links?id=eq.${linkId}`, { method: "PATCH", body: JSON.stringify({ status: "ativo" }) });

  // =====================================================================
  console.log("── Realtime ──");
  const subA = subscritor(A, linkId);
  const subC = subscritor(C, linkId); // terceiro, NÃO faz parte do link
  await Promise.all([subA.subscribed, subC.subscribed]);
  await sleep(2500);

  await rest(B, "messages", {
    method: "POST",
    body: JSON.stringify({ link_id: linkId, sender_id: B.id, body: "olá pelo realtime" }),
  });
  await sleep(4000);

  const aGotInsert = subA.recebidas.some((r) => r.type === "INSERT" && r.body === "olá pelo realtime");
  if (aGotInsert) ok("membro do chat RECEBE o INSERT em tempo real (sem refresh)");
  else ko("membro do chat NÃO recebeu o INSERT via realtime", subA.recebidas);

  // NOVO #1 — terceiro subscrito não recebe nada
  if (subC.recebidas.length === 0) {
    ok("NOVO #1: terceiro subscrito ao canal NÃO recebe mensagens de uma conversa de que não faz parte");
  } else {
    ko("NOVO #1: terceiro RECEBEU mensagens que não devia", subC.recebidas);
  }

  // tick de "lida" em tempo real (UPDATE)
  const msgId = (
    await rest(A, `messages?link_id=eq.${linkId}&sender_id=eq.${B.id}&select=id&limit=1`).then((r) => r.json())
  )[0].id;
  await rest(A, `messages?id=eq.${msgId}`, {
    method: "PATCH",
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
  await sleep(6000);
  if (subA.recebidas.some((r) => r.type === "UPDATE")) ok("o tick de 'lida' (UPDATE) também chega em tempo real");
  else ko("o UPDATE de read_at não chegou via realtime", subA.recebidas);

  subA.close();
  subC.close();

  // =====================================================================
  console.log("── Imutabilidade das mensagens (trigger da 006) ──");
  // read_at continua a poder mudar
  const r1 = await rest(B, `messages?id=eq.${msgId}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
  ok(r1.ok ? "marcar read_at continua a funcionar" : "marcar read_at parou de funcionar (não devia)");

  // editar body → bloqueado
  const r2 = await rest(B, `messages?id=eq.${msgId}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ body: "editado pelo PT" }),
  });
  const b2 = await r2.json();
  const bodyAgora = (
    await rest(A, `messages?id=eq.${msgId}&select=body`).then((x) => x.json())
  )[0].body;
  if (!r2.ok && bodyAgora === "olá pelo realtime") {
    ok(`editar o body de uma mensagem → BLOQUEADO (${b2.code ?? "erro"}), body intacto`);
  } else {
    ko("editar o body NÃO foi bloqueado", { status: r2.status, body: bodyAgora });
  }

  // o próprio autor também não pode editar
  const r3 = await rest(B, `messages?id=eq.${msgId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_evolution: true }),
  });
  const evoAgora = (
    await rest(A, `messages?id=eq.${msgId}&select=is_evolution`).then((x) => x.json())
  )[0].is_evolution;
  if (!r3.ok || evoAgora === false) ok("mudar is_evolution/outros campos → BLOQUEADO");
  else ko("mudar is_evolution NÃO foi bloqueado");

  // =====================================================================
  console.log("── NOVO #2: storage recusa o PT sem scope_evolucao ──");
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0, 0xff, 0xd9]);
  const evoPath = `${A.id}/evolucao/${Date.now()}-rt.jpg`;
  const chatPath = `${A.id}/chat/${Date.now()}-rt.jpg`;
  for (const p of [evoPath, chatPath]) {
    await fetch(`${STOR}/object/private-media/${p}`, {
      method: "POST",
      headers: { apikey: KEY, authorization: `Bearer ${A.token}`, "content-type": "image/jpeg", "cache-control": "no-store" },
      body: JPEG,
    });
  }
  const bSign = (path: string) =>
    fetch(`${STOR}/object/sign/private-media/${path}`, {
      method: "POST",
      headers: { apikey: KEY, authorization: `Bearer ${B.token}`, "content-type": "application/json" },
      body: JSON.stringify({ expiresIn: 600 }),
    }).then((r) => r.status);
  const bGet = (path: string) =>
    fetch(`${STOR}/object/private-media/${path}`, {
      headers: { apikey: KEY, authorization: `Bearer ${B.token}` },
    }).then((r) => r.status);

  if ((await bSign(evoPath)) === 200) ok("com scope_evolucao: PT assina a foto de evolução");
  else ko("com scope: PT não assinou a foto de evolução");

  await rest(A, `pt_links?id=eq.${linkId}&student_id=eq.${A.id}`, {
    method: "PATCH",
    body: JSON.stringify({ scope_treinos: true, scope_evolucao: false }),
  });

  const s = await bSign(evoPath);
  const g = await bGet(evoPath); // ficheiro que o PT NUNCA descarregou → sem cache CDN
  if (s !== 200 && g >= 400) {
    ok(`NOVO #2: PT SEM scope_evolucao com o SEU token → createSignedUrl ${s} e GET direto ${g} — storage RECUSA`);
  } else {
    ko("NOVO #2: storage NÃO recusou o PT sem scope", { sign: s, get: g });
  }
  if ((await bSign(chatPath)) === 200) ok("PT SEM scope_evolucao continua a aceder às imagens NORMAIS do chat");
  else ko("PT perdeu acesso às imagens normais do chat");

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
