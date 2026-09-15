/**
 * RLS da rede social — posts, post_likes, post_comments, follows — já
 * existentes na BD desde a migração 001 (antes do controlo de migrações
 * no repo, mesma categoria de workout_sessions/personal_records). A 017
 * NÃO cria tabelas: confirma que a RLS já existente cobre a regra da casa.
 *
 * Corrido contra as contas de teste REAIS (não signup novo: "Confirm
 * email" fica LIGADO de propósito, ver apex-supabase-schema).
 *
 * Esquema real (confirmado por sondagem, não documentação):
 *   posts: id, author_id, type (check: treino|recorde|conquista|video|
 *     texto), body (nullable), media_path, media_kind (check: image|
 *     video), workout_title, workout_sets, workout_volume, workout_rpe,
 *     record_lift, record_value, tags (text[]), created_at.
 *   post_likes: post_id, user_id, created_at — PK composta (post_id,user_id).
 *   post_comments: id, post_id, user_id, body, created_at.
 *   follows: follower_id, following_id, created_at — PK composta.
 *
 * Verifica (regra da casa, pedida explicitamente antes de construir a UI):
 *   - ninguém insere posts/gostos/comentários/follows em nome de outro
 *     (author_id/user_id/follower_id forjado);
 *   - ninguém edita (UPDATE) uma linha, nem a própria nem a de outro;
 *   - ninguém apaga a linha de OUTRO; cada um apaga só a própria;
 *   - sem sessão (só apikey, sem JWT de utilizador) não lê nada;
 *   - um PT LIGADO consegue LER a sessão de treino do aluno (via
 *     scope_treinos) — confirma que a superfície que o guarda-costas
 *     aplicacional (prepararPost) precisa de proteger é real.
 *
 * Uso: node scripts/social-rls-test.ts
 * Limpa os dados de teste que cria (DELETE próprio permitido nas 4 tabelas).
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
const H = (u?: U) => ({ apikey: KEY, ...(u ? { authorization: `Bearer ${u.token}` } : {}) });
const rest = (u: U | undefined, p: string, init: RequestInit = {}) =>
  fetch(`${REST}/${p}`, { ...init, headers: { ...H(u), "content-type": "application/json", ...(init.headers ?? {}) } });
const getJson = (u: U | undefined, p: string) => rest(u, p).then((r) => r.json());

async function main() {
  const PT = await login("patrick00santos@gmail.com", "P155866k@");
  const A = await login("gsousaesantos@gmail.com", "P155866k@"); // edu graça
  const B = await login("patrick00santos+alunoteste2@gmail.com", "Testpass123!"); // Aluno Teste Dois
  console.log(`Setup — PT=${PT.id.slice(0, 8)} A(edu)=${A.id.slice(0, 8)} B(aluno2)=${B.id.slice(0, 8)}\n`);

  const limpezas: (() => Promise<void>)[] = [];

  // ================= publicar (posts) =================
  console.log("── posts: forjar author_id ──");
  const forjaPost = await rest(A, "posts", {
    method: "POST",
    body: JSON.stringify({ author_id: B.id, type: "texto", body: "publicado em nome do Aluno Teste Dois" }),
  });
  const forjaPostJson = await forjaPost.json();
  if (forjaPost.status === 403 || forjaPostJson?.code === "42501") ok("A NÃO consegue publicar com author_id de B (42501)");
  else ko("A conseguiu forjar author_id num post", forjaPostJson);

  const meuPost = (
    await rest(A, "posts", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ author_id: A.id, type: "texto", body: "post de teste (social-rls-test.ts)" }),
    }).then((r) => r.json())
  )[0];
  if (meuPost?.id) {
    ok("A publica um post seu normalmente");
    limpezas.push(async () => {
      await rest(A, `posts?id=eq.${meuPost.id}`, { method: "DELETE" });
    });
  } else {
    ko("A não conseguiu publicar um post seu", meuPost);
  }

  console.log("── posts: UPDATE (ninguém edita, nem o próprio — publicações são imutáveis) ──");
  if (meuPost?.id) {
    // Cada tentativa compara sempre contra o estado IMEDIATAMENTE ANTERIOR
    // a ela própria (nunca uma baseline reaproveitada de um passo anterior)
    // — um PATCH bloqueado pela RLS devolve 200 com corpo [] (0 linhas
    // afetadas), o que `.ok` sozinho não distingue de sucesso.
    const estadoAntes1 = (await getJson(A, `posts?id=eq.${meuPost.id}&select=body`))[0]?.body;
    const editaProprio = await rest(A, `posts?id=eq.${meuPost.id}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ body: "editado pelo próprio autor" }),
    });
    const editaProprioJson = await editaProprio.json();
    const estadoDepois1 = (await getJson(A, `posts?id=eq.${meuPost.id}&select=body`))[0]?.body;
    if (Array.isArray(editaProprioJson) && editaProprioJson.length === 0 && estadoDepois1 === estadoAntes1) {
      ok("o PRÓPRIO autor não edita o post depois de publicado");
    } else {
      ko("o autor conseguiu editar o próprio post", { antes: estadoAntes1, depois: estadoDepois1 });
    }

    const estadoAntes2 = (await getJson(A, `posts?id=eq.${meuPost.id}&select=body`))[0]?.body;
    const editaOutro = await rest(B, `posts?id=eq.${meuPost.id}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ body: "hackeado pelo B" }),
    });
    const editaOutroJson = await editaOutro.json();
    const estadoDepois2 = (await getJson(A, `posts?id=eq.${meuPost.id}&select=body`))[0]?.body;
    if (Array.isArray(editaOutroJson) && editaOutroJson.length === 0 && estadoDepois2 === estadoAntes2) {
      ok("OUTRO utilizador não edita o post de A");
    } else {
      ko("B conseguiu editar o post de A", { antes: estadoAntes2, depois: estadoDepois2 });
    }

    // tenta injetar campos privados via UPDATE (mesmo o próprio autor, que
    // é precisamente o caso que a policy antiga deixava passar).
    const rpeAntes = (await getJson(A, `posts?id=eq.${meuPost.id}&select=workout_rpe`))[0]?.workout_rpe;
    const tentaInjetarRpe = await rest(A, `posts?id=eq.${meuPost.id}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ workout_rpe: 9.5 }),
    });
    const tentaInjetarRpeJson = await tentaInjetarRpe.json();
    const rpeDepois = (await getJson(A, `posts?id=eq.${meuPost.id}&select=workout_rpe`))[0]?.workout_rpe;
    if (Array.isArray(tentaInjetarRpeJson) && tentaInjetarRpeJson.length === 0 && rpeDepois === rpeAntes) {
      ok("não é possível injetar workout_rpe via UPDATE, nem o próprio autor (sem policy)");
    } else {
      ko("foi possível gravar workout_rpe via UPDATE", { antes: rpeAntes, depois: rpeDepois });
    }

    console.log("── posts: DELETE de outro é bloqueado ──");
    await rest(B, `posts?id=eq.${meuPost.id}`, { method: "DELETE" });
    const aindaExiste = await getJson(A, `posts?id=eq.${meuPost.id}&select=id`);
    if (Array.isArray(aindaExiste) && aindaExiste.length === 1) ok("B NÃO apaga o post de A");
    else ko("B apagou o post de A", aindaExiste);
  }

  // ================= gostos (post_likes: PK composta post_id+user_id) =================
  console.log("\n── gostos: forjar user_id, editar (não há UPDATE), apagar o de outro ──");
  if (meuPost?.id) {
    const forjaGosto = await rest(B, "post_likes", {
      method: "POST",
      body: JSON.stringify({ post_id: meuPost.id, user_id: A.id }),
    });
    const forjaGostoJson = await forjaGosto.json();
    if (forjaGosto.status === 403 || forjaGostoJson?.code === "42501") ok("B NÃO consegue gostar em nome de A (42501)");
    else ko("B conseguiu forjar um gosto em nome de A", forjaGostoJson);

    const gostoB = await rest(B, "post_likes", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ post_id: meuPost.id, user_id: B.id }),
    });
    if (gostoB.ok) {
      ok("B gosta do post de A normalmente");
      limpezas.push(async () => {
        await rest(B, `post_likes?post_id=eq.${meuPost.id}&user_id=eq.${B.id}`, { method: "DELETE" });
      });
    } else ko("B não conseguiu gostar do post", await gostoB.text());

    const apagaGostoDeOutro = await rest(A, `post_likes?post_id=eq.${meuPost.id}&user_id=eq.${B.id}`, {
      method: "DELETE",
    });
    const gostoAindaExiste = await getJson(B, `post_likes?post_id=eq.${meuPost.id}&user_id=eq.${B.id}&select=post_id`);
    if (Array.isArray(gostoAindaExiste) && gostoAindaExiste.length === 1) ok("A NÃO apaga o gosto de B");
    else ko("A apagou o gosto de B", { apagaGostoDeOutro: apagaGostoDeOutro.status, gostoAindaExiste });
  }

  // ================= comentários (post_comments: id normal) =================
  console.log("\n── comentários: forjar user_id, editar/apagar o de outro ──");
  if (meuPost?.id) {
    const forjaComentario = await rest(B, "post_comments", {
      method: "POST",
      body: JSON.stringify({ post_id: meuPost.id, user_id: A.id, body: "forjado em nome de A" }),
    });
    const forjaComentarioJson = await forjaComentario.json();
    if (forjaComentario.status === 403 || forjaComentarioJson?.code === "42501")
      ok("B NÃO consegue comentar em nome de A (42501)");
    else ko("B conseguiu forjar um comentário em nome de A", forjaComentarioJson);

    const comentarioB = (
      await rest(B, "post_comments", {
        method: "POST",
        headers: { prefer: "return=representation" },
        body: JSON.stringify({ post_id: meuPost.id, user_id: B.id, body: "boa sessão!" }),
      }).then((r) => r.json())
    )[0];
    if (comentarioB?.id) {
      ok("B comenta o post de A normalmente");
      limpezas.push(async () => {
        await rest(B, `post_comments?id=eq.${comentarioB.id}`, { method: "DELETE" });
      });
    } else ko("B não conseguiu comentar", comentarioB);

    if (comentarioB?.id) {
      const editaComentarioDeOutro = await rest(A, `post_comments?id=eq.${comentarioB.id}`, {
        method: "PATCH",
        headers: { prefer: "return=representation" },
        body: JSON.stringify({ body: "editado pelo autor do post" }),
      });
      const comentarioAgora = (await getJson(B, `post_comments?id=eq.${comentarioB.id}&select=body`))[0]?.body;
      if (!editaComentarioDeOutro.ok || comentarioAgora === "boa sessão!") ok("A NÃO edita o comentário de B");
      else ko("A editou o comentário de B", comentarioAgora);

      const apagaComentarioDeOutro = await rest(A, `post_comments?id=eq.${comentarioB.id}`, { method: "DELETE" });
      const comentarioAindaExiste = await getJson(B, `post_comments?id=eq.${comentarioB.id}&select=id`);
      if (Array.isArray(comentarioAindaExiste) && comentarioAindaExiste.length === 1) ok("A NÃO apaga o comentário de B");
      else ko("A apagou o comentário de B", { apagaComentarioDeOutro: apagaComentarioDeOutro.status, comentarioAindaExiste });
    }
  }

  // ================= seguir (follows: PK composta follower_id+following_id) =================
  console.log("\n── seguir: forjar follower_id, deixar de seguir por outro, não seguir a si próprio ──");
  const forjaFollow = await rest(B, "follows", {
    method: "POST",
    body: JSON.stringify({ follower_id: A.id, following_id: B.id }),
  });
  const forjaFollowJson = await forjaFollow.json();
  if (forjaFollow.status === 403 || forjaFollowJson?.code === "42501")
    ok("B NÃO consegue forjar um 'seguir' em nome de A (42501)");
  else ko("B conseguiu forjar um follow em nome de A", forjaFollowJson);

  const seguirASimMesma = await rest(A, "follows", {
    method: "POST",
    body: JSON.stringify({ follower_id: A.id, following_id: A.id }),
  });
  if (!seguirASimMesma.ok) ok("A NÃO consegue seguir-se a si própria");
  else ko("A conseguiu seguir-se a si própria", await seguirASimMesma.text());

  const followAB = await rest(A, "follows", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ follower_id: A.id, following_id: B.id }),
  });
  if (followAB.ok) {
    ok("A segue B normalmente");
    limpezas.push(async () => {
      await rest(A, `follows?follower_id=eq.${A.id}&following_id=eq.${B.id}`, { method: "DELETE" });
    });
  } else ko("A não conseguiu seguir B", await followAB.text());

  const bDeixaDeSeguirPorA = await rest(B, `follows?follower_id=eq.${A.id}&following_id=eq.${B.id}`, {
    method: "DELETE",
  });
  const followAindaExiste = await getJson(A, `follows?follower_id=eq.${A.id}&following_id=eq.${B.id}&select=follower_id`);
  if (Array.isArray(followAindaExiste) && followAindaExiste.length === 1) ok("B NÃO consegue apagar o follow de A (não é dele)");
  else ko("B conseguiu apagar o follow de A", { bDeixaDeSeguirPorA: bDeixaDeSeguirPorA.status, followAindaExiste });

  // ================= sem sessão =================
  console.log("\n── sem sessão (só apikey, sem JWT) ──");
  const semSessao = await getJson(undefined, "posts?select=id&limit=5");
  if (Array.isArray(semSessao) && semSessao.length === 0) ok("sem sessão: SELECT em posts devolve vazio");
  else ko("sem sessão viu posts", semSessao);

  // ================= superfície real que o guarda aplicacional protege =================
  console.log("\n── contexto: o PT LIGADO consegue LER a sessão de treino de A (RLS de workout_sessions, já existente) ──");
  const sessaoDeA = await getJson(A, "workout_sessions?select=id&user_id=eq." + A.id + "&limit=1");
  if (Array.isArray(sessaoDeA) && sessaoDeA[0]?.id) {
    const ptLeSessao = await getJson(PT, `workout_sessions?select=id,user_id&id=eq.${sessaoDeA[0].id}`);
    if (Array.isArray(ptLeSessao) && ptLeSessao.length === 1) {
      ok("PT LIGADO consegue ler a sessão de A (scope_treinos) — é a superfície que prepararPost bloqueia ao publicar; ver sanitizar-post.test.ts");
    } else {
      ko("PT não conseguiu ler a sessão de A (inesperado)", ptLeSessao);
    }
  } else {
    console.log("   (sem sessões de A para testar este contexto — não é falha, só não há dado)");
  }

  // ================= limpeza =================
  console.log("\n── limpeza dos dados de teste ──");
  for (const limpar of limpezas.reverse()) await limpar();
  console.log("   limpo.");

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
