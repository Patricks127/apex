/**
 * Verificação da migração 020 (plan_documents + storage) contra a BD e o
 * storage reais, com LOGIN em contas confirmadas — nunca signup (Confirm
 * email fica sempre ligado). Mesmo padrão de
 * training-plans-rls-019-login-test.ts.
 *
 * Parte A — demonstração REAL: o PT anexa o PDF de referência à conta
 * real da Daniela Paulino e o link assinado devolve o PDF verdadeiro
 * (bytes verificados). Fica anexado no fim — não é lixo de teste, é o uso
 * real da funcionalidade pedido explicitamente.
 *
 * Parte B — RLS com o Aluno Teste Dois (conta dedicada a testes, é
 * aceitável mexer na sua ligação/anexos desde que se restaure no fim):
 * upload+leitura normais; só o PT que anexou apaga (não o aluno); revogar
 * corta leitura E escrita no storage (cobre também "PT sem ligação" —
 * pt_has_scope só olha ao estado atual, não à história).
 *
 * Uso: node scripts/plan-documents-test.ts
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const URL_ = /^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)![1].trim();
const KEY = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m.exec(env)![1].trim();
const AUTH = `${URL_}/auth/v1`;
const REST = `${URL_}/rest/v1`;
const STORAGE = `${URL_}/storage/v1`;
const BUCKET = "plan-documents";

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

const H = (u: U) => ({ apikey: KEY, authorization: `Bearer ${u.token}` });
const HJ = (u: U) => ({ ...H(u), "content-type": "application/json" });

async function subirPdf(u: U, path: string, bytes: Uint8Array): Promise<Response> {
  return fetch(`${STORAGE}/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...H(u), "content-type": "application/pdf", "x-upsert": "false" },
    body: Buffer.from(bytes),
  });
}

async function assinar(u: U, path: string): Promise<{ status: number; signedURL?: string }> {
  const r = await fetch(`${STORAGE}/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: HJ(u),
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, signedURL: body.signedURL };
}

async function inserirLinha(u: U, row: Record<string, unknown>): Promise<Response> {
  return fetch(`${REST}/plan_documents`, {
    method: "POST",
    headers: { ...HJ(u), prefer: "return=representation" },
    body: JSON.stringify(row),
  });
}

async function main() {
  const PT = await login("patrick00santos@gmail.com", "P155866k@");
  const ALUNO = await login("patrick00santos+alunoteste2@gmail.com", "Testpass123!");
  console.log(`PT=${PT.id.slice(0, 8)}  Aluno Teste Dois=${ALUNO.id.slice(0, 8)}\n`);

  // --- Parte A: demonstração real com a Daniela ---
  const DANIELA_ID = "84ff7854-6a3a-4adf-9061-024b17c7c1cd";
  const pdfReal = readFileSync(new URL("../referencia/plano-daniela-referencia.pdf", import.meta.url));

  const docDaniela = randomUUID();
  const pathDaniela = `${DANIELA_ID}/${docDaniela}.pdf`;
  const upDaniela = await subirPdf(PT, pathDaniela, pdfReal);
  if (upDaniela.status >= 200 && upDaniela.status < 300) {
    ok("PT sobe o PDF real da Daniela para o storage");
  } else {
    ko("PT não conseguiu subir o PDF da Daniela", await upDaniela.json().catch(() => upDaniela.status));
  }

  const insDaniela = await inserirLinha(PT, {
    id: docDaniela,
    pt_id: PT.id,
    student_id: DANIELA_ID,
    storage_path: pathDaniela,
    file_name: "plano-daniela-referencia.pdf",
    size_bytes: pdfReal.byteLength,
  });
  if (insDaniela.status >= 200 && insDaniela.status < 300) {
    ok("PT grava a linha de metadados do plano da Daniela");
  } else {
    ko("Falha ao gravar a linha de metadados", await insDaniela.json().catch(() => insDaniela.status));
  }

  const assinadoDaniela = await assinar(PT, pathDaniela);
  if (assinadoDaniela.status === 200 && assinadoDaniela.signedURL) {
    ok("Link assinado gerado para o plano da Daniela");
    // A API do storage devolve um caminho relativo a /storage/v1 (ex.:
    // "/object/sign/plan-documents/...?token=..."), não uma URL absoluta
    // nem relativa à raiz do projeto — por isso é STORAGE, não URL_, que
    // entra aqui. (O SDK usado no código real, createSignedUrl, já
    // devolve a URL completa pronta a usar — este ajuste é só deste
    // script, que fala com a API crua.)
    const urlCompleta = assinadoDaniela.signedURL.startsWith("http") ? assinadoDaniela.signedURL : `${STORAGE}${assinadoDaniela.signedURL}`;
    const conteudo = await fetch(urlCompleta);
    const buf = new Uint8Array(await conteudo.arrayBuffer());
    const magic = Buffer.from(buf.slice(0, 5)).toString("ascii");
    if (conteudo.status === 200 && magic === "%PDF-" && buf.byteLength === pdfReal.byteLength) {
      ok(`O aluno (via link assinado, sem sessão) abre o PDF real — ${buf.byteLength} bytes, cabeçalho %PDF- confirmado`);
    } else {
      ko("O link assinado não devolveu o PDF esperado", { status: conteudo.status, magic, bytes: buf.byteLength });
    }
  } else {
    ko("Não foi possível assinar o link do plano da Daniela", assinadoDaniela);
  }
  console.log("  (fica anexado à conta real da Daniela — não é lixo de teste, é o uso pedido)\n");

  // --- Parte B: RLS com o Aluno Teste Dois ---
  const linkAntes = await fetch(`${REST}/pt_links?student_id=eq.${ALUNO.id}&pt_id=eq.${PT.id}&select=id,status,scope_treinos`, {
    headers: H(PT),
  }).then((r) => r.json());
  const link0 = linkAntes[0];
  console.log("  ligação PT<->Aluno Teste Dois antes do teste:", link0);
  if (!link0 || link0.status !== "ativo" || !link0.scope_treinos) {
    console.error("Pré-condição falhou: esperava ligação ativa com scope_treinos.");
    process.exit(2);
  }
  const linkId = link0.id as string;

  const docTeste = randomUUID();
  const pathTeste = `${ALUNO.id}/${docTeste}.pdf`;
  const pdfTeste = new TextEncoder().encode("%PDF-1.4\n%%teste plan-documents%%\n%%EOF");

  const upTeste = await subirPdf(PT, pathTeste, pdfTeste);
  if (upTeste.status >= 200 && upTeste.status < 300) ok("PT (com scope) sobe um PDF de teste para o Aluno Teste Dois");
  else ko("PT com scope não conseguiu subir o PDF de teste", await upTeste.json().catch(() => upTeste.status));

  const insTeste = await inserirLinha(PT, {
    id: docTeste,
    pt_id: PT.id,
    student_id: ALUNO.id,
    storage_path: pathTeste,
    file_name: "teste.pdf",
    size_bytes: pdfTeste.byteLength,
  });
  if (insTeste.status >= 200 && insTeste.status < 300) ok("PT grava a linha de metadados do PDF de teste");
  else ko("Falha ao gravar a linha de metadados de teste", await insTeste.json().catch(() => insTeste.status));

  // aluno lê a própria linha e o próprio ficheiro
  const leituraAluno = await fetch(`${REST}/plan_documents?id=eq.${docTeste}&select=id`, { headers: H(ALUNO) }).then((r) => r.json());
  if (Array.isArray(leituraAluno) && leituraAluno.length === 1) ok("Aluno Teste Dois lê a linha do seu próprio anexo");
  else ko("Aluno Teste Dois não conseguiu ler a linha do seu anexo", leituraAluno);

  const assinadoAluno = await assinar(ALUNO, pathTeste);
  if (assinadoAluno.status === 200 && assinadoAluno.signedURL) ok("Aluno Teste Dois consegue assinar/abrir o seu próprio PDF");
  else ko("Aluno Teste Dois não conseguiu assinar o seu próprio PDF", assinadoAluno);

  // aluno NÃO apaga (não é quem anexou)
  const delPorAluno = await fetch(`${REST}/plan_documents?id=eq.${docTeste}`, {
    method: "DELETE",
    headers: { ...HJ(ALUNO), prefer: "return=representation" },
  });
  const delPorAlunoBody = await delPorAluno.json().catch(() => []);
  if (Array.isArray(delPorAlunoBody) && delPorAlunoBody.length === 0) {
    ok("Aluno Teste Dois NÃO consegue apagar o anexo (só quem anexou pode)");
  } else {
    ko("Aluno Teste Dois conseguiu apagar o anexo do PT — REGRESSÃO GRAVE", delPorAlunoBody);
  }

  // revoga a ligação (o próprio aluno revoga — fluxo real)
  const revogar = await fetch(`${REST}/pt_links?id=eq.${linkId}`, {
    method: "PATCH",
    headers: HJ(ALUNO),
    body: JSON.stringify({ status: "revogado" }),
  });
  if (revogar.status >= 200 && revogar.status < 300) ok("Aluno Teste Dois revoga a ligação (fluxo normal)");
  else ko("Falha ao revogar a ligação de teste", await revogar.json());

  // PT revogado: não lê mais a linha
  const leituraPosRevoke = await fetch(`${REST}/plan_documents?student_id=eq.${ALUNO.id}&select=id`, { headers: H(PT) }).then((r) => r.json());
  if (Array.isArray(leituraPosRevoke) && leituraPosRevoke.length === 0) {
    ok("PT revogado deixa de LER os anexos do aluno (cobre também 'PT sem ligação')");
  } else {
    ko("PT revogado ainda lê os anexos — REGRESSÃO GRAVE", leituraPosRevoke);
  }

  // PT revogado: não escreve mais (novo upload bloqueado)
  const upPosRevoke = await subirPdf(PT, `${ALUNO.id}/${randomUUID()}.pdf`, pdfTeste);
  if (upPosRevoke.status >= 400) ok("PT revogado NÃO consegue subir mais ficheiros para o storage do aluno");
  else ko("PT revogado ainda conseguiu subir um ficheiro — REGRESSÃO GRAVE", upPosRevoke.status);

  // PT revogado: não consegue assinar/ler o ficheiro já existente
  const assinarPosRevoke = await assinar(PT, pathTeste);
  if (assinarPosRevoke.status >= 400) ok("PT revogado NÃO consegue assinar/abrir o ficheiro já existente");
  else ko("PT revogado ainda conseguiu assinar o ficheiro — REGRESSÃO GRAVE", assinarPosRevoke);

  // PT revogado: não apaga a linha (pt_id bate, mas scope já não)
  const delPosRevoke = await fetch(`${REST}/plan_documents?id=eq.${docTeste}`, {
    method: "DELETE",
    headers: { ...HJ(PT), prefer: "return=representation" },
  });
  const delPosRevokeBody = await delPosRevoke.json().catch(() => []);
  if (Array.isArray(delPosRevokeBody) && delPosRevokeBody.length === 0) {
    ok("PT revogado NÃO consegue apagar a linha (scope também corta o DELETE, não só SELECT/INSERT)");
  } else {
    ko("PT revogado conseguiu apagar a linha — REGRESSÃO GRAVE", delPosRevokeBody);
  }

  // aluno continua a ler/abrir o seu próprio ficheiro mesmo com o PT revogado
  const leituraAlunoPosRevoke = await fetch(`${REST}/plan_documents?id=eq.${docTeste}&select=id`, { headers: H(ALUNO) }).then((r) => r.json());
  if (Array.isArray(leituraAlunoPosRevoke) && leituraAlunoPosRevoke.length === 1) {
    ok("Aluno Teste Dois continua a ver o seu anexo depois de revogar o PT");
  } else {
    ko("Aluno Teste Dois perdeu o seu próprio anexo depois de revogar o PT", leituraAlunoPosRevoke);
  }

  // restaura a ligação (pedido -> aceite, mesma linha — unique(pt_id,student_id))
  const reabrir = await fetch(`${REST}/pt_links?id=eq.${linkId}`, {
    method: "PATCH",
    headers: { ...HJ(ALUNO), prefer: "return=representation" },
    body: JSON.stringify({ status: "pendente", requested_by: ALUNO.id }),
  }).then((r) => r.json());
  if (Array.isArray(reabrir) && reabrir[0]?.status === "pendente") {
    ok("Aluno Teste Dois reabre o pedido de ligação (fluxo normal)");
    const aceite = await fetch(`${REST}/pt_links?id=eq.${linkId}`, {
      method: "PATCH",
      headers: { ...HJ(PT), prefer: "return=representation" },
      body: JSON.stringify({ status: "ativo" }),
    }).then((r) => r.json());
    if (Array.isArray(aceite) && aceite[0]?.status === "ativo") {
      ok("PT aceita — ligação restaurada ao estado anterior");
    } else {
      ko("Não consegui aceitar o pedido de restauro — restaurar manualmente!", aceite);
    }
  } else {
    ko("Não consegui reabrir o pedido de ligação — restaurar manualmente!", reabrir);
  }

  // limpeza: agora com scope restaurado, o PT apaga o ficheiro de TESTE
  // (o da Daniela fica, é real). A linha pode já ter sido apagada acima
  // se alguma asserção se comportou de forma inesperada — tudo bem, o
  // objetivo aqui é só não deixar lixo, não é uma asserção.
  await fetch(`${REST}/plan_documents?id=eq.${docTeste}`, { method: "DELETE", headers: HJ(PT) });
  // Remoção em massa é o formato certo da API do storage — um DELETE ao
  // caminho do objeto diretamente devolve 404 (path não é uma rota, é um
  // parâmetro do corpo).
  await fetch(`${STORAGE}/object/${BUCKET}`, {
    method: "DELETE",
    headers: HJ(PT),
    body: JSON.stringify({ prefixes: [pathTeste] }),
  });
  console.log("  (PDF de teste do Aluno Teste Dois removido — o da Daniela fica, é real)");

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  console.log(
    "\nNão testado ao vivo (falta 2ª conta de PT confirmada): 'outro PT não apaga'. Fechado por construção — a" +
      " policy de DELETE exige literalmente pt_id = auth.uid(); o pt_id gravado é o do PT que anexou, nunca o de" +
      " outro, portanto nenhum outro auth.uid() pode alguma vez igualar essa coluna. Mesmo raciocínio aceite para" +
      " o caso equivalente da migração 019.",
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
