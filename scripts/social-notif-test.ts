/**
 * RLS de `notifications` (migração 018) — corrido contra as contas de
 * teste REAIS (edu graça, Aluno Teste Dois; sem signup novo, "Confirm
 * email" fica ligado).
 *
 * NOTA DE ARQUITETURA (apanhada ao escrever este teste, aplica-se ao
 * código real também): um INSERT com `Prefer: return=representation`
 * pede ao Postgres para devolver a linha inserida — o que exige poder
 * fazer SELECT dela. Como a policy de SELECT em notifications é só
 * `user_id = auth.uid()`, um insert LEGÍTIMO feito por B para A (ex.:
 * "B gostou do post de A") falha com "new row violates row-level
 * security policy" SE se pedir a linha de volta — não porque o INSERT em
 * si seja inválido, mas porque B nunca pode SELECT uma notificação cujo
 * dono é A. Por isso: nunca pedir `return=representation` num insert de
 * notificação para outra pessoa (nem aqui, nem em notificar.ts) — insere-
 * se "cego", e confirma-se o resultado, quando preciso, com o TOKEN DO
 * DESTINATÁRIO.
 *
 * O "anti-vazio" aqui é um PAR de tentativas com a MESMA forma de
 * pedido, uma sem a condição de confiança satisfeita (bloqueada) e outra
 * com ela satisfeita (permitida, confirmada por leitura como o
 * destinatário). Se ambas passassem, ou ambas falhassem, a policy não
 * estaria a discriminar pelo que interessa.
 *
 * Uso: node scripts/social-notif-test.ts
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
async function safeJson(r: Response): Promise<unknown> {
  const texto = await r.text();
  if (!texto) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}
function comoLinha(j: unknown): { id?: string; titulo?: string; lida?: boolean } | undefined {
  return Array.isArray(j) ? j[0] : undefined;
}

async function criarPost(u: U, body: string): Promise<{ id: string }> {
  const resp = await rest(u, "posts", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ author_id: u.id, type: "texto", body }),
  });
  return comoLinha(await safeJson(resp)) as { id: string };
}

/** Insere uma notificação "cega" (sem Prefer) — como o código real deve
 *  fazer sempre que o destinatário não é quem insere. Devolve só o status. */
async function inserirNotifCega(ator: U, notif: Record<string, unknown>): Promise<{ status: number; corpo: unknown }> {
  const resp = await rest(ator, "notifications", { method: "POST", body: JSON.stringify(notif) });
  return { status: resp.status, corpo: await safeJson(resp) };
}

/** Confirma que existe (ou não) uma notificação com esta forma, lida
 *  pelo PRÓPRIO destinatário (só ele tem SELECT). */
async function existeNotif(destinatario: U, tipo: string, refId: string): Promise<{ id: string; titulo: string } | undefined> {
  const resp = await rest(
    destinatario,
    `notifications?user_id=eq.${destinatario.id}&tipo=eq.${tipo}&ref_id=eq.${refId}&order=created_at.desc&limit=1`,
  );
  return comoLinha(await safeJson(resp)) as { id: string; titulo: string } | undefined;
}

async function main() {
  const A = await login("gsousaesantos@gmail.com", "P155866k@"); // edu graça
  const B = await login("patrick00santos+alunoteste2@gmail.com", "Testpass123!"); // Aluno Teste Dois
  console.log(`Setup — A(edu)=${A.id.slice(0, 8)} B(aluno2)=${B.id.slice(0, 8)}\n`);
  console.log("Nota: notifications não tem policy de DELETE (não pedido nesta fase) — as linhas");
  console.log("criadas por este teste ficam na BD, mesmo padrão de exercise_logs/messages.\n");

  const limpezasPosts: (() => Promise<void>)[] = [];

  const postDeA = await criarPost(A, "post de teste (social-notif-test.ts)");
  limpezasPosts.push(async () => { await rest(A, `posts?id=eq.${postDeA.id}`, { method: "DELETE" }); });
  const postDeB = await criarPost(B, "outro post de teste, autor B (social-notif-test.ts)");
  limpezasPosts.push(async () => { await rest(B, `posts?id=eq.${postDeB.id}`, { method: "DELETE" }); });

  const notifGosto = (refId: string, userId: string) => ({
    user_id: userId,
    tipo: "gosto",
    titulo: "Novo gosto",
    corpo: "Aluno Teste Dois gostou da tua publicação",
    ref_id: refId,
  });
  const notifComentario = (refId: string, userId: string) => ({
    user_id: userId,
    tipo: "comentario",
    titulo: "Novo comentário",
    corpo: "Aluno Teste Dois comentou a tua publicação",
    ref_id: refId,
  });

  // ================= gosto: sem interação real → bloqueado =================
  console.log("── gosto: B tenta notificar A SEM ter gostado do post de A ──");
  const semGosto = await inserirNotifCega(B, notifGosto(postDeA.id, A.id));
  if (semGosto.status >= 400) ok(`SEM gosto real → bloqueado (${semGosto.status})`);
  else ko("conseguiu notificar 'gosto' SEM ter gostado — buraco real", semGosto);
  const confirmaSemGosto = await existeNotif(A, "gosto", postDeA.id);
  if (semGosto.status < 400 && confirmaSemGosto) {
    ko("... e a notificação forjada REALMENTE existe na BD de A", confirmaSemGosto);
  }

  // B gosta mesmo do post de A
  const gostoReal = await rest(B, "post_likes", { method: "POST", body: JSON.stringify({ post_id: postDeA.id, user_id: B.id }) });
  if (!gostoReal.ok) ko("setup: B não conseguiu gostar do post de A", await safeJson(gostoReal));

  console.log("── gosto: B notifica A DEPOIS de ter gostado mesmo (mesmo pedido, único delta = o gosto existir) ──");
  const comGosto = await inserirNotifCega(B, notifGosto(postDeA.id, A.id));
  const notifGostoRow = comGosto.status < 400 ? await existeNotif(A, "gosto", postDeA.id) : undefined;
  if (comGosto.status < 400 && notifGostoRow?.id) {
    ok("COM gosto real → permitido (confirmado por leitura como A, o par prova que a policy discrimina pela interação)");
  } else {
    ko("gosto real não gerou a notificação (ou não ficou visível para A)", comGosto);
  }

  // ================= comentário: sem interação real → bloqueado =================
  console.log("\n── comentário: B tenta notificar A SEM ter comentado o post de A ──");
  const semComentario = await inserirNotifCega(B, notifComentario(postDeA.id, A.id));
  if (semComentario.status >= 400) ok(`SEM comentário real → bloqueado (${semComentario.status})`);
  else ko("conseguiu notificar 'comentario' SEM ter comentado — buraco real", semComentario);

  const comentarioReal = await rest(B, "post_comments", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ post_id: postDeA.id, user_id: B.id, body: "comentário real de teste" }),
  });
  if (!comentarioReal.ok) ko("setup: B não conseguiu comentar o post de A", await safeJson(comentarioReal));

  console.log("── comentário: B notifica A DEPOIS de ter comentado mesmo ──");
  const comComentario = await inserirNotifCega(B, notifComentario(postDeA.id, A.id));
  const notifComentRow = comComentario.status < 400 ? await existeNotif(A, "comentario", postDeA.id) : undefined;
  if (comComentario.status < 400 && notifComentRow?.id) {
    ok("COM comentário real → permitido (confirmado por leitura como A)");
  } else {
    ko("comentário real não gerou a notificação (ou não ficou visível para A)", comComentario);
  }

  // ================= forjar para si próprio =================
  console.log("\n── A tenta notificar-SE a si própria de um 'gosto' no seu próprio post ──");
  // Aqui ator = destinatário (A), por isso pedir a linha de volta não tem
  // o problema do RETURNING — se passasse, veria o corpo diretamente.
  const forjaParaSiMesma = await rest(A, "notifications", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(notifGosto(postDeA.id, A.id)),
  });
  if (!forjaParaSiMesma.ok) ok(`auth.uid() = user_id → bloqueado (${forjaParaSiMesma.status}) — não posso notificar-me de uma interação minha`);
  else ko("A conseguiu criar uma notificação para si própria", await safeJson(forjaParaSiMesma));

  // ================= post errado: aponta para um post meu, a fingir que é do destinatário =================
  console.log("\n── B tem um gosto real num post SEU (não de A) — tenta reclamar que é notificação para A ──");
  const gostoDeBNoProprioPost = await rest(B, "post_likes", { method: "POST", body: JSON.stringify({ post_id: postDeB.id, user_id: B.id }) });
  if (!gostoDeBNoProprioPost.ok) ko("setup: B não conseguiu gostar do próprio post", await safeJson(gostoDeBNoProprioPost));

  // Este insert é rejeitado logo no WITH CHECK (autor do post ≠ destinatário
  // reclamado) — falha antes de chegar à fase de RETURNING, por isso é
  // seguro pedir a linha de volta aqui: se "passasse" indevidamente,
  // veríamos o corpo diretamente sem precisar de uma leitura à parte.
  const apontaPostErrado = await rest(B, "notifications", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(notifGosto(postDeB.id, A.id)),
  });
  if (!apontaPostErrado.ok) {
    ok(`ref_id aponta para post cujo autor NÃO é o destinatário reclamado → bloqueado (${apontaPostErrado.status}), mesmo com um gosto real lá`);
  } else {
    ko("conseguiu notificar A sobre um gosto num post que não é dela — buraco real", await safeJson(apontaPostErrado));
  }

  // ================= UPDATE: título bloqueado, lida permitido =================
  console.log("\n── UPDATE: mudar 'titulo' bloqueado; marcar 'lida' permitido (mesma linha) ──");
  if (notifGostoRow?.id) {
    const tituloAntes = notifGostoRow.titulo;
    const tentaTitulo = await rest(A, `notifications?id=eq.${notifGostoRow.id}`, {
      method: "PATCH",
      body: JSON.stringify({ titulo: "TÍTULO FORJADO" }),
    });
    const tituloDepois = comoLinha(await safeJson(await rest(A, `notifications?id=eq.${notifGostoRow.id}&select=titulo`)))?.titulo;
    if (!tentaTitulo.ok && tituloDepois === tituloAntes) {
      ok(`mudar 'titulo' via UPDATE → bloqueado pelo trigger (${tentaTitulo.status}), título continua "${tituloDepois}"`);
    } else {
      ko("conseguiu mudar 'titulo' via UPDATE", { status: tentaTitulo.status, tituloDepois });
    }

    const marcaLida = await rest(A, `notifications?id=eq.${notifGostoRow.id}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ lida: true }),
    });
    const marcaLidaRow = comoLinha(await safeJson(marcaLida));
    if (marcaLida.ok && marcaLidaRow?.lida === true) {
      ok("marcar 'lida' → permitido — mesma linha, prova que o trigger discrimina o campo, não bloqueia tudo");
    } else {
      ko("não conseguiu marcar 'lida'", { status: marcaLida.status, corpo: marcaLidaRow });
    }

    console.log("── B (não é o dono) tenta marcar a notificação de A como lida ──");
    const bTentaMarcar = await rest(B, `notifications?id=eq.${notifGostoRow.id}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ lida: false }),
    });
    const bTentaMarcarJson = await safeJson(bTentaMarcar);
    if (Array.isArray(bTentaMarcarJson) && bTentaMarcarJson.length === 0) {
      ok("B NÃO consegue marcar a notificação de A (0 linhas — RLS por user_id)");
    } else {
      ko("B conseguiu mexer na notificação de A", { status: bTentaMarcar.status, corpo: bTentaMarcarJson });
    }
  } else {
    console.log("   (sem notificação de gosto confirmada para testar UPDATE — passo anterior falhou)");
  }

  // ================= sem sessão =================
  console.log("\n── sem sessão (só apikey, sem JWT) ──");
  const semSessaoResp = await rest(undefined, "notifications?select=id&limit=5");
  const semSessao = await safeJson(semSessaoResp);
  if (Array.isArray(semSessao) && semSessao.length === 0) ok("sem sessão: SELECT em notifications devolve vazio");
  else ko("sem sessão viu notificações", semSessao);

  // ================= limpeza (só os posts/likes/comments; notifications não tem DELETE) =================
  console.log("\n── limpeza dos posts/gostos/comentários de teste ──");
  await rest(B, `post_likes?post_id=eq.${postDeA.id}&user_id=eq.${B.id}`, { method: "DELETE" });
  await rest(B, `post_likes?post_id=eq.${postDeB.id}&user_id=eq.${B.id}`, { method: "DELETE" });
  const comentsDeB = await safeJson(await rest(B, `post_comments?post_id=eq.${postDeA.id}&user_id=eq.${B.id}&select=id`));
  for (const c of Array.isArray(comentsDeB) ? comentsDeB : []) {
    await rest(B, `post_comments?id=eq.${(c as { id: string }).id}`, { method: "DELETE" });
  }
  for (const limpar of limpezasPosts.reverse()) await limpar();
  console.log("   limpo (posts/gostos/comentários). Notificações de teste ficam na BD — sem DELETE nesta fase.");

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
