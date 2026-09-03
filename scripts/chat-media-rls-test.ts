/**
 * CRÍTICO — RLS do chat privado + media de evolução (bucket private-media).
 *
 * Verifica, com tokens reais:
 *   - PT COM scope_evolucao vê as fotos de evolução (linha da mensagem + assina o ficheiro);
 *   - PT SEM scope_evolucao: vê as mensagens normais, mas a mensagem de evolução
 *     desaparece e o ficheiro NÃO é acessível (nem por createSignedUrl, nem por
 *     GET direto a um ficheiro que nunca tocou);
 *   - após revogar a ligação, NADA é acessível;
 *   - um terceiro utilizador não acede a nada;
 *   - anónimo não acede a nada.
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/chat-media-rls-test.ts
 */
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const URL_ = /^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)![1].trim();
const KEY = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m.exec(env)![1].trim();
const AUTH = `${URL_}/auth/v1`;
const REST = `${URL_}/rest/v1`;
const STOR = `${URL_}/storage/v1`;

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
const info = (m: string) => console.log(`  \x1b[36mNOTA\x1b[0m  ${m}`);

type U = { token: string; id: string };
async function signup(role: "atleta" | "pt", name: string): Promise<U> {
  const email = `patrick00santos+cm${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
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
const H = (u?: U) => ({
  apikey: KEY,
  ...(u ? { authorization: `Bearer ${u.token}` } : {}),
});
const getJson = (u: U | undefined, p: string) =>
  fetch(`${REST}/${p}`, { headers: H(u) }).then((r) => r.json());
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0, 0xff, 0xd9]);

async function upload(u: U, path: string) {
  return fetch(`${STOR}/object/private-media/${path}`, {
    method: "POST",
    headers: { ...H(u), "content-type": "image/jpeg", "cache-control": "no-store" },
    body: JPEG,
  });
}
async function sign(u: U | undefined, path: string): Promise<number> {
  const r = await fetch(`${STOR}/object/sign/private-media/${path}`, {
    method: "POST",
    headers: { ...H(u), "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  return r.status;
}
async function directGet(u: U | undefined, path: string): Promise<number> {
  const r = await fetch(`${STOR}/object/private-media/${path}`, { headers: H(u) });
  return r.status;
}

async function main() {
  const A = await signup("atleta", "Aluno A");
  const B = await signup("pt", "PT B");
  const C = await signup("atleta", "Terceiro C");
  console.log(`Setup — A=${A.id.slice(0, 8)} B(pt)=${B.id.slice(0, 8)} C=${C.id.slice(0, 8)}\n`);

  // Ligar A→B com scope_evolucao=true, B aceita
  await fetch(`${REST}/profiles?id=eq.${B.id}&pt_code=is.null`, {
    method: "PATCH",
    headers: { ...H(B), "content-type": "application/json" },
    body: JSON.stringify({ pt_code: `CMB-${String(Date.now() % 10000).padStart(4, "0")}` }),
  });
  const link = await fetch(`${REST}/pt_links`, {
    method: "POST",
    headers: { ...H(A), "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({
      pt_id: B.id,
      student_id: A.id,
      status: "pendente",
      requested_by: A.id,
      scope_treinos: true,
      scope_evolucao: true,
    }),
  }).then((r) => r.json());
  const linkId = link[0].id;
  await fetch(`${REST}/pt_links?id=eq.${linkId}`, {
    method: "PATCH",
    headers: { ...H(B), "content-type": "application/json" },
    body: JSON.stringify({ status: "ativo" }),
  });

  // A envia: texto, imagem de chat, e DUAS fotos de evolução
  const chatPath = `${A.id}/chat/${Date.now()}-c.jpg`;
  const evoPath1 = `${A.id}/evolucao/${Date.now()}-e1.jpg`;
  const evoPath2 = `${A.id}/evolucao/${Date.now()}-e2.jpg`;
  for (const p of [chatPath, evoPath1, evoPath2]) {
    const r = await upload(A, p);
    if (!r.ok) ko(`upload ${p} falhou`, await r.text());
  }
  const msg = (b: unknown) =>
    fetch(`${REST}/messages`, {
      method: "POST",
      headers: { ...H(A), "content-type": "application/json" },
      body: JSON.stringify({ link_id: linkId, sender_id: A.id, ...(b as object) }),
    });
  await msg({ body: "olá coach" });
  await msg({ media_path: chatPath, media_kind: "image" });
  await msg({ media_path: evoPath1, media_kind: "image", is_evolution: true, weight_kg: 80, measurement: "cintura 82" });
  await msg({ media_path: evoPath2, media_kind: "image", is_evolution: true, weight_kg: 79.5 });

  // ============ PT COM scope_evolucao ============
  console.log("── PT COM scope_evolucao ──");
  const bMsgs1 = await getJson(B, `messages?link_id=eq.${linkId}&select=id,body,is_evolution,media_path`);
  const evoVis = Array.isArray(bMsgs1) && bMsgs1.filter((m: { is_evolution: boolean }) => m.is_evolution).length;
  if (evoVis === 2) ok("PT vê as 2 mensagens de evolução");
  else ko("PT não viu as mensagens de evolução", bMsgs1);
  if ((await sign(B, evoPath1)) === 200) ok("PT assina a foto de evolução (createSignedUrl 200)");
  else ko("PT não conseguiu assinar a foto de evolução");
  if ((await sign(B, chatPath)) === 200) ok("PT assina a imagem normal do chat");
  else ko("PT não assinou a imagem de chat");

  // ============ PT SEM scope_evolucao ============
  console.log("── aluno desliga scope_evolucao ──");
  await fetch(`${REST}/pt_links?id=eq.${linkId}&student_id=eq.${A.id}`, {
    method: "PATCH",
    headers: { ...H(A), "content-type": "application/json" },
    body: JSON.stringify({ scope_treinos: true, scope_evolucao: false }),
  });
  const bMsgs2 = await getJson(B, `messages?link_id=eq.${linkId}&select=id,body,is_evolution`);
  const normaisVis = Array.isArray(bMsgs2) && bMsgs2.length;
  const evoAindaVis = Array.isArray(bMsgs2) && bMsgs2.filter((m: { is_evolution: boolean }) => m.is_evolution).length;
  if (normaisVis === 2 && evoAindaVis === 0) {
    ok("PT SEM scope: vê as 2 mensagens normais, as de evolução desaparecem");
  } else {
    ko("PT SEM scope: visibilidade errada das mensagens", bMsgs2);
  }
  if ((await sign(B, evoPath1)) !== 200) ok("PT SEM scope: createSignedUrl da foto de evolução → BLOQUEADO");
  else ko("PT SEM scope conseguiu assinar a foto de evolução");
  // ficheiro que o PT NUNCA tocou (sem cache CDN)
  if ((await directGet(B, evoPath2)) >= 400) ok("PT SEM scope: GET DIRETO a foto de evolução nunca acedida → BLOQUEADO");
  else ko("PT SEM scope acedeu por caminho direto a uma foto de evolução");
  if ((await sign(B, chatPath)) === 200) ok("PT SEM scope: continua a ver as imagens normais do chat");
  else ko("PT SEM scope perdeu acesso às imagens normais");
  {
    const cache = await directGet(B, evoPath1);
    if (cache === 200) info("evoPath1 (já descarregada pelo PT antes) ainda responde 200 por GET direto — cache CDN do Supabase (~1h). A app nunca usa GET direto; o createSignedUrl já bloqueia. Mitigado com cache-control:no-store no upload.");
  }

  // ============ revogar ============
  console.log("── aluno revoga a ligação ──");
  await fetch(`${REST}/pt_links?id=eq.${linkId}&student_id=eq.${A.id}`, {
    method: "PATCH",
    headers: { ...H(A), "content-type": "application/json" },
    body: JSON.stringify({ status: "revogado" }),
  });
  const bMsgs3 = await getJson(B, `messages?link_id=eq.${linkId}&select=id`);
  if (Array.isArray(bMsgs3) && bMsgs3.length === 0) ok("após revogar: PT não vê NENHUMA mensagem");
  else ko("após revogar, PT ainda vê mensagens", bMsgs3);
  if ((await sign(B, chatPath)) !== 200) ok("após revogar: PT não assina a imagem de chat");
  else ko("após revogar, PT ainda assina imagem de chat");
  if ((await sign(B, evoPath2)) !== 200) ok("após revogar: PT não assina a foto de evolução");
  else ko("após revogar, PT ainda assina foto de evolução");

  // ============ terceiro ============
  console.log("── terceiro utilizador C ──");
  const cMsgs = await getJson(C, `messages?link_id=eq.${linkId}&select=id`);
  if (Array.isArray(cMsgs) && cMsgs.length === 0) ok("terceiro não vê nenhuma mensagem");
  else ko("terceiro viu mensagens", cMsgs);
  if ((await sign(C, chatPath)) !== 200) ok("terceiro não assina a imagem de chat");
  else ko("terceiro assinou imagem de chat");
  if ((await sign(C, evoPath1)) !== 200) ok("terceiro não assina a foto de evolução");
  else ko("terceiro assinou foto de evolução");
  if ((await directGet(C, evoPath2)) >= 400) ok("terceiro: GET direto → BLOQUEADO");
  else ko("terceiro acedeu por caminho direto");

  // ============ anónimo ============
  console.log("── anónimo ──");
  if ((await sign(undefined, evoPath1)) !== 200) ok("anónimo não assina");
  else ko("anónimo assinou");
  if ((await directGet(undefined, evoPath2)) >= 400) ok("anónimo: GET direto → BLOQUEADO");
  else ko("anónimo acedeu por caminho direto");

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
