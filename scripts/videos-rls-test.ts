/**
 * CRÍTICO — RLS de training_videos + video_feedback + storage {uid}/videos/.
 *
 * Verifica:
 *   - PT COM scope_videos vê os vídeos e escreve feedback;
 *   - PT SEM scope_videos: bloqueado no STORAGE (não só na UI) e nas linhas;
 *   - revogar a ligação corta tudo;
 *   - terceiro não acede a nada;
 *   - SEM buracos de UPDATE/DELETE: ninguém edita/apaga o vídeo do aluno nem o
 *     feedback de outro PT; o aluno não escreve/edita/apaga feedback.
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/videos-rls-test.ts
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

type U = { token: string; id: string };
async function signup(role: "atleta" | "pt", name: string): Promise<U> {
  const email = `patrick00santos+vr${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
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
const H = (u?: U) => ({ apikey: KEY, ...(u ? { authorization: `Bearer ${u.token}` } : {}) });
const rest = (u: U | undefined, p: string, init: RequestInit = {}) =>
  fetch(`${REST}/${p}`, { ...init, headers: { ...H(u), "content-type": "application/json", ...(init.headers ?? {}) } });
const getJson = (u: U | undefined, p: string) => rest(u, p).then((r) => r.json());

const MP4 = new TextEncoder().encode("FAKE-MP4-BYTES");
const uploadVideo = (u: U, path: string) =>
  fetch(`${STOR}/object/private-media/${path}`, {
    method: "POST",
    headers: { ...H(u), "content-type": "video/mp4", "cache-control": "no-store" },
    body: MP4,
  });
const sign = (u: U | undefined, path: string) =>
  fetch(`${STOR}/object/sign/private-media/${path}`, {
    method: "POST",
    headers: { ...H(u), "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 600 }),
  }).then((r) => r.status);
const directGet = (u: U | undefined, path: string) =>
  fetch(`${STOR}/object/private-media/${path}`, { headers: H(u) }).then((r) => r.status);

async function main() {
  const A = await signup("atleta", "Aluno A");
  const B = await signup("pt", "PT B");
  const D = await signup("pt", "PT D");
  const C = await signup("atleta", "Terceiro C");
  console.log(`Setup — A=${A.id.slice(0, 8)} B(pt)=${B.id.slice(0, 8)} D(pt)=${D.id.slice(0, 8)} C=${C.id.slice(0, 8)}\n`);

  // A envia 2 vídeos
  const v1p = `${A.id}/videos/${Date.now()}-1.mp4`;
  const v2p = `${A.id}/videos/${Date.now()}-2.mp4`;
  for (const p of [v1p, v2p]) {
    const r = await uploadVideo(A, p);
    if (!r.ok) ko(`upload ${p}`, await r.text());
  }
  const v1 = (
    await rest(A, "training_videos", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ user_id: A.id, storage_path: v1p, exercise: "Agachamento" }),
    }).then((r) => r.json())
  )[0];
  await rest(A, "training_videos", {
    method: "POST",
    body: JSON.stringify({ user_id: A.id, storage_path: v2p, exercise: "Supino" }),
  });

  // Ligar A→B com scope_videos, B aceita
  await rest(B, `profiles?id=eq.${B.id}&pt_code=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ pt_code: `VRB-${String(Date.now() % 10000).padStart(4, "0")}` }),
  });
  const link = await rest(A, "pt_links", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      pt_id: B.id, student_id: A.id, status: "pendente", requested_by: A.id,
      scope_treinos: true, scope_videos: true,
    }),
  }).then((r) => r.json());
  const linkId = link[0].id;
  await rest(B, `pt_links?id=eq.${linkId}`, { method: "PATCH", body: JSON.stringify({ status: "ativo" }) });

  // ================= PT COM scope_videos =================
  console.log("── PT COM scope_videos ──");
  const bVids = await getJson(B, `training_videos?user_id=eq.${A.id}&select=id,exercise`);
  if (Array.isArray(bVids) && bVids.length === 2) ok("PT vê os 2 vídeos do aluno");
  else ko("PT não viu os vídeos", bVids);

  if ((await sign(B, v1p)) === 200) ok("PT assina o vídeo (createSignedUrl 200)");
  else ko("PT não assinou o vídeo");

  const fbIns = await rest(B, "video_feedback", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ video_id: v1.id, pt_id: B.id, body: "joelho a colapsar na subida" }),
  });
  const fb = (await fbIns.json())[0];
  if (fbIns.ok && fb?.id) ok("PT escreve feedback no vídeo");
  else ko("PT não conseguiu escrever feedback", fb);

  const aFb = await getJson(A, `video_feedback?video_id=eq.${v1.id}&select=body`);
  if (Array.isArray(aFb) && aFb[0]?.body?.includes("joelho")) ok("o aluno vê o feedback do PT no seu vídeo");
  else ko("aluno não viu o feedback", aFb);

  // contador de "sem feedback"
  const todos = await getJson(B, `training_videos?user_id=eq.${A.id}&select=id`);
  const comFb = new Set(
    (await getJson(B, `video_feedback?video_id=in.(${todos.map((x: { id: string }) => x.id).join(",")})&select=video_id`)).map(
      (x: { video_id: string }) => x.video_id,
    ),
  );
  const semFb = todos.filter((x: { id: string }) => !comFb.has(x.id)).length;
  if (semFb === 1) ok(`contador: 1 vídeo sem feedback (${semFb})`);
  else ko(`contador de vídeos sem feedback errado (${semFb}, esperado 1)`);

  // ================= sem buracos de UPDATE/DELETE =================
  console.log("── sem buracos de UPDATE / DELETE ──");
  const aTentaFb = await rest(A, "video_feedback", {
    method: "POST",
    body: JSON.stringify({ video_id: v1.id, pt_id: A.id, body: "auto-feedback" }),
  });
  if ((await aTentaFb.json())?.code === "42501") ok("aluno NÃO pode inserir feedback (42501)");
  else ko("aluno conseguiu inserir feedback");

  const dTentaFb = await rest(D, "video_feedback", {
    method: "POST",
    body: JSON.stringify({ video_id: v1.id, pt_id: D.id, body: "PT sem link" }),
  });
  if ((await dTentaFb.json())?.code === "42501") ok("PT sem ligação NÃO pode inserir feedback (42501)");
  else ko("PT sem ligação inseriu feedback");

  const bEditaFb = await rest(B, `video_feedback?id=eq.${fb.id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ body: "editado pelo proprio" }),
  });
  const fbAgora = (await getJson(A, `video_feedback?id=eq.${fb.id}&select=body`))[0]?.body;
  if (!bEditaFb.ok || fbAgora === "joelho a colapsar na subida") ok("o próprio PT NÃO edita o feedback depois de enviado");
  else ko("PT editou o próprio feedback", fbAgora);

  const dEditaFb = await rest(D, `video_feedback?id=eq.${fb.id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ body: "outro PT mexeu" }),
  });
  const fb2 = (await getJson(A, `video_feedback?id=eq.${fb.id}&select=body`))[0]?.body;
  if (!dEditaFb.ok || fb2 === "joelho a colapsar na subida") ok("outro PT NÃO edita o feedback deste PT");
  else ko("outro PT editou o feedback", fb2);

  const aEditaFb = await rest(A, `video_feedback?id=eq.${fb.id}`, {
    method: "PATCH",
    body: JSON.stringify({ body: "aluno mexeu" }),
  });
  const fb3 = (await getJson(A, `video_feedback?id=eq.${fb.id}&select=body`))[0]?.body;
  if (!aEditaFb.ok || fb3 === "joelho a colapsar na subida") ok("o ALUNO NÃO edita o feedback");
  else ko("aluno editou o feedback", fb3);

  await rest(A, `video_feedback?id=eq.${fb.id}`, { method: "DELETE" });
  const fbDepoisDel = await getJson(A, `video_feedback?id=eq.${fb.id}&select=id`);
  if (Array.isArray(fbDepoisDel) && fbDepoisDel.length === 1) ok("o ALUNO NÃO apaga o feedback");
  else ko("aluno apagou o feedback", fbDepoisDel);

  const bEditaVid = await rest(B, `training_videos?id=eq.${v1.id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ exercise: "editado pelo PT" }),
  });
  const exAgora = (await getJson(A, `training_videos?id=eq.${v1.id}&select=exercise`))[0]?.exercise;
  if (!bEditaVid.ok || exAgora === "Agachamento") ok("o PT NÃO edita o vídeo do aluno");
  else ko("PT editou o vídeo do aluno", exAgora);

  await rest(B, `training_videos?id=eq.${v1.id}`, { method: "DELETE" });
  const vidDepoisDel = await getJson(A, `training_videos?id=eq.${v1.id}&select=id`);
  if (Array.isArray(vidDepoisDel) && vidDepoisDel.length === 1) ok("o PT NÃO apaga o vídeo do aluno");
  else ko("PT apagou o vídeo do aluno", vidDepoisDel);

  // ================= PT SEM scope_videos =================
  console.log("── PT SEM scope_videos (bloqueio no STORAGE, não só na UI) ──");
  await rest(A, `pt_links?id=eq.${linkId}&student_id=eq.${A.id}`, {
    method: "PATCH",
    body: JSON.stringify({ scope_treinos: true, scope_videos: false }),
  });
  const bVids2 = await getJson(B, `training_videos?user_id=eq.${A.id}&select=id`);
  if (Array.isArray(bVids2) && bVids2.length === 0) ok("PT SEM scope: não vê as linhas de training_videos");
  else ko("PT SEM scope viu vídeos", bVids2);
  const bFb2 = await getJson(B, `video_feedback?video_id=eq.${v1.id}&select=id`);
  if (Array.isArray(bFb2) && bFb2.length === 0) ok("PT SEM scope: não vê o video_feedback");
  else ko("PT SEM scope viu feedback", bFb2);
  if ((await sign(B, v1p)) !== 200) ok("PT SEM scope: createSignedUrl → BLOQUEADO");
  else ko("PT SEM scope assinou o vídeo");
  if ((await directGet(B, v2p)) >= 400) ok("PT SEM scope: GET DIRETO a vídeo nunca acedido → BLOQUEADO");
  else ko("PT SEM scope acedeu por caminho direto");
  const bFbIns2 = await rest(B, "video_feedback", {
    method: "POST",
    body: JSON.stringify({ video_id: v1.id, pt_id: B.id, body: "sem scope" }),
  });
  if ((await bFbIns2.json())?.code === "42501") ok("PT SEM scope: não pode escrever feedback (42501)");
  else ko("PT SEM scope escreveu feedback");
  const aAindaVe = await getJson(A, `training_videos?user_id=eq.${A.id}&select=id`);
  const aAindaFb = await getJson(A, `video_feedback?video_id=eq.${v1.id}&select=id`);
  if (aAindaVe.length === 2 && aAindaFb.length === 1) ok("o aluno continua a ver os seus vídeos e o feedback antigo");
  else ko("o aluno perdeu acesso aos próprios dados", { videos: aAindaVe.length, feedback: aAindaFb.length });

  // ================= revogar =================
  console.log("── revogar a ligação ──");
  await rest(A, `pt_links?id=eq.${linkId}&student_id=eq.${A.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "revogado" }),
  });
  if ((await getJson(B, `training_videos?user_id=eq.${A.id}&select=id`)).length === 0) ok("após revogar: PT não vê vídeos");
  else ko("após revogar PT ainda vê vídeos");
  if ((await sign(B, v2p)) !== 200) ok("após revogar: PT não assina o vídeo");
  else ko("após revogar PT ainda assina");

  // ================= terceiro =================
  console.log("── terceiro utilizador ──");
  if ((await getJson(C, `training_videos?user_id=eq.${A.id}&select=id`)).length === 0) ok("terceiro não vê vídeos");
  else ko("terceiro viu vídeos");
  if ((await getJson(C, `video_feedback?video_id=eq.${v1.id}&select=id`)).length === 0) ok("terceiro não vê feedback");
  else ko("terceiro viu feedback");
  if ((await sign(C, v1p)) !== 200) ok("terceiro não assina o vídeo");
  else ko("terceiro assinou");
  if ((await directGet(C, v2p)) >= 400) ok("terceiro: GET direto → BLOQUEADO");
  else ko("terceiro acedeu por caminho direto");

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
