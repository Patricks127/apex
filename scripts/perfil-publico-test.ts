/**
 * Perfil público do PT — camada de dados + pesquisa + interação com o 007.
 * Requisitos: 007 aplicada; "Confirm email" DESLIGADO.
 * Uso: node scripts/perfil-publico-test.ts
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
const nota = (m: string) => console.log(`  \x1b[36mNOTA\x1b[0m  ${m}`);

type U = { token: string; id: string };
async function signup(role: "atleta" | "pt", name: string): Promise<U> {
  const email = `patrick00santos+pf${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
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
const rest = (u: U, p: string, init: RequestInit = {}) =>
  fetch(`${REST}/${p}`, { ...init, headers: { ...H(u), ...(init.headers ?? {}) } });

// O que a Server Action guardarPerfil escreve (sem role/is_verified/pt_code).
const CURRICULO = {
  headline: "Treinador de força e powerlifting",
  bio: "Preparo atletas de força há 12 anos. Trabalho melhor com quem quer competir.",
  city: "Coimbra",
  experience: "12",
  specialties: ["forca", "powerlifting"],
  certs: ["NSCA CSCS", "Precision Nutrition L1"],
  services: ["presencial", "online"],
  price: 45,
  instagram: "coach.forca",
  gym: "Barbell Club Coimbra",
  show_contacts: "alunos",
};

async function main() {
  const B = await signup("pt", "Bruno Coach");
  const A = await signup("atleta", "Ana Atleta");
  const C = await signup("atleta", "Carlos Atleta");
  console.log(`Setup — B(pt)=${B.id.slice(0, 8)} A(atleta)=${A.id.slice(0, 8)} C(atleta)=${C.id.slice(0, 8)}\n`);

  // B gera o pt_code (como o garantirCodigoPt) e guarda o currículo
  const code = `BRC-${String(Date.now() % 10000).padStart(4, "0")}`;
  await rest(B, `profiles?id=eq.${B.id}&pt_code=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ pt_code: code }),
  });

  console.log("── guardar currículo (forma da Server Action) ──");
  const g = await rest(B, `profiles?id=eq.${B.id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(CURRICULO),
  });
  // contactos numa tabela à parte (migração 024)
  await rest(B, `contactos_pt`, {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: B.id, contact_phone: "912345678", contact_email: "coach@exemplo.pt" }),
  });
  const row = (await g.json())[0];
  if (
    g.ok &&
    row.headline === CURRICULO.headline &&
    Array.isArray(row.specialties) &&
    row.specialties.length === 2 &&
    Number(row.price) === 45 &&
    row.show_contacts === "alunos"
  ) {
    ok("PT guarda headline/bio/city/specialties/certs/services/price/contactos/show_contacts");
  } else {
    ko("gravação do currículo falhou", { status: g.status, row });
  }

  console.log("── 007 continua a proteger role/is_verified/pt_code ──");
  const atk = await rest(B, `profiles?id=eq.${B.id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...CURRICULO, role: "atleta", is_verified: true, pt_code: "OUTRO-1" }),
  });
  const after = (await rest(B, `profiles?id=eq.${B.id}&select=role,is_verified,pt_code`).then((r) => r.json()))[0];
  if (!atk.ok && after.role === "pt" && after.is_verified === false && after.pt_code === code) {
    ok("PATCH com currículo + role/is_verified/pt_code → rejeitado inteiro (P0001), tudo intacto");
  } else {
    ko("um PATCH misto passou campos protegidos", after);
  }

  console.log("── /descobrir: só PTs, pesquisa por nome/cidade/especialidade ──");
  const buscaCidade = await rest(A, `profiles?role=eq.pt&pt_code=not.is.null&or=(name.ilike.*coimbra*,city.ilike.*coimbra*,headline.ilike.*coimbra*)&select=id,name,role`).then((r) => r.json());
  if (Array.isArray(buscaCidade) && buscaCidade.some((p: { id: string }) => p.id === B.id)) {
    ok("pesquisa por cidade ('coimbra') encontra o PT");
  } else {
    ko("pesquisa por cidade não encontrou o PT", buscaCidade);
  }
  const buscaEsp = await rest(A, `profiles?role=eq.pt&pt_code=not.is.null&or=(name.ilike.*powerlifting*,city.ilike.*powerlifting*,headline.ilike.*powerlifting*,specialties.ov.%7Bpowerlifting%7D)&select=id,name`).then((r) => r.json());
  if (Array.isArray(buscaEsp) && buscaEsp.some((p: { id: string }) => p.id === B.id)) {
    ok("pesquisa por especialidade ('powerlifting') encontra o PT");
  } else {
    ko("pesquisa por especialidade não encontrou o PT", buscaEsp);
  }
  const soPts = await rest(A, `profiles?role=eq.pt&pt_code=not.is.null&select=role&limit=50`).then((r) => r.json());
  if (Array.isArray(soPts) && soPts.every((p: { role: string }) => p.role === "pt")) {
    ok("/descobrir só devolve role='pt' (nunca atletas)");
  } else {
    ko("apareceu um não-PT na pesquisa", soPts);
  }

  console.log("── visibilidade de contactos (RLS de contactos_pt, migração 024) ──");
  // Antes da 024 isto era uma limitação aceite (os contactos viviam em
  // profiles, legível por todos). Agora a RLS aplica a escolha do PT: A não
  // está ligada a B e B escolheu "só alunos" → A não lê nada, nem pela API.
  const aVeDireto = await rest(A, `contactos_pt?id=eq.${B.id}&select=contact_phone,contact_email`).then((r) => r.json());
  if (Array.isArray(aVeDireto) && aVeDireto.length === 0) {
    ok("atleta não-ligado + show_contacts='alunos' → contactos_pt devolve 0 linhas pela API");
  } else {
    ko("FUGA: atleta não-ligado lê os contactos de um PT em 'só alunos'", aVeDireto);
  }

  // O atleta envia o pedido (é o que o botão do /pt/[codigo] despoleta via /ligar)
  await rest(A, `pt_links`, {
    method: "POST",
    body: JSON.stringify({ pt_id: B.id, student_id: A.id, status: "pendente", requested_by: A.id, scope_treinos: true }),
  });
  const linkA = (await rest(A, `pt_links?pt_id=eq.${B.id}&student_id=eq.${A.id}&select=status`).then((r) => r.json()))[0];
  if (linkA?.status === "pendente") ok("pedido de ligação criado a partir do perfil (status pendente)");
  else ko("pedido de ligação não ficou pendente", linkA);

  const showTodos = await rest(B, `profiles?id=eq.${B.id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ show_contacts: "todos" }),
  });
  if (showTodos.ok && (await showTodos.json())[0].show_contacts === "todos") {
    ok("PT muda show_contacts para 'todos' (então o /pt/[codigo] mostra a toda a gente)");
  } else {
    ko("não conseguiu mudar show_contacts");
  }

  // C (atleta) NÃO edita o perfil de B
  await rest(C, `profiles?id=eq.${B.id}`, { method: "PATCH", body: JSON.stringify({ headline: "invadido" }) });
  const hB = (await rest(B, `profiles?id=eq.${B.id}&select=headline`).then((r) => r.json()))[0].headline;
  if (hB === CURRICULO.headline) ok("cross-user: outro atleta não edita o currículo do PT");
  else ko("cross-user update passou", hB);

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
