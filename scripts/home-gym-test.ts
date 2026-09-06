/**
 * Verificação da migração 010 (profiles.gym_days_per_week / home_equipment)
 * contra a BD real.
 *
 * Confirma que:
 *   - as colunas existem, com omissão NULL / '{}';
 *   - o dono grava as duas juntas, como faz o onboarding;
 *   - o CHECK rejeita mais dias de ginásio do que dias de treino;
 *   - o CHECK rejeita equipamento fora do vocabulário do motor;
 *   - um terceiro NÃO altera estas colunas noutro perfil (RLS por linha).
 *
 * Requisitos: "Confirm email" DESLIGADO. Uso: node scripts/home-gym-test.ts
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

async function signup(tag: string): Promise<U> {
  const email = `patrick00santos+${tag}${Date.now()}${Math.random().toString(36).slice(2, 5)}@gmail.com`;
  const j = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Testpass123!", data: { name: tag, role: "atleta" } }),
  }).then((r) => r.json());
  if (!j.access_token) {
    console.error("Signup sem sessão — 'Confirm email' ligado?", j);
    process.exit(2);
  }
  return { token: j.access_token, id: j.user.id };
}

const H = (u: U) => ({ apikey: KEY, authorization: `Bearer ${u.token}`, "content-type": "application/json" });
const get = (u: U, path: string) => fetch(`${REST}/${path}`, { headers: H(u) }).then((r) => r.json());
const patch = (u: U, path: string, body: unknown) =>
  fetch(`${REST}/${path}`, { method: "PATCH", headers: H(u), body: JSON.stringify(body) });

const COLS = "days_per_week,gym_days_per_week,home_equipment";

async function main() {
  const A = await signup("hgA");
  const B = await signup("hgB");
  console.log(`Setup — A=${A.id.slice(0, 8)}  B=${B.id.slice(0, 8)}\n`);

  // 1. omissão
  const inicial = await get(A, `profiles?id=eq.${A.id}&select=${COLS}`);
  const l0 = Array.isArray(inicial) ? inicial[0] : null;
  if (l0 && l0.gym_days_per_week === null && Array.isArray(l0.home_equipment) && l0.home_equipment.length === 0) {
    ok("omissão: gym_days_per_week NULL, home_equipment '{}'");
  } else {
    ko("omissão errada", inicial);
  }

  // 2. o dono grava o que o onboarding grava (as duas colunas juntas)
  await patch(A, `profiles?id=eq.${A.id}`, {
    location: "hibrido",
    days_per_week: 5,
    gym_days_per_week: 3,
    home_equipment: ["halteres", "banda", "peso_corporal", "barra_fixa"],
  });
  const gravado = await get(A, `profiles?id=eq.${A.id}&select=${COLS}`);
  const l1 = Array.isArray(gravado) ? gravado[0] : null;
  if (l1?.gym_days_per_week === 3 && l1?.home_equipment?.length === 4) {
    ok("dono grava 3 dias de ginásio em 5 + equipamento de casa");
  } else {
    ko("gravação do onboarding não ficou", gravado);
  }

  // 3. CHECK: mais dias de ginásio do que dias de treino
  const demais = await patch(A, `profiles?id=eq.${A.id}`, { gym_days_per_week: 6 });
  const aposDemais = await get(A, `profiles?id=eq.${A.id}&select=${COLS}`);
  if (demais.status >= 400 || aposDemais?.[0]?.gym_days_per_week === 3) {
    ok("CHECK rejeita gym_days_per_week > days_per_week");
  } else {
    ko("aceitou mais dias de ginásio do que dias de treino", aposDemais);
  }

  // 4. CHECK: equipamento fora do vocabulário
  const lixo = await patch(A, `profiles?id=eq.${A.id}`, { home_equipment: ["nave_espacial"] });
  const aposLixo = await get(A, `profiles?id=eq.${A.id}&select=${COLS}`);
  if (lixo.status >= 400 || aposLixo?.[0]?.home_equipment?.length === 4) {
    ok("CHECK rejeita equipamento fora do vocabulário do motor");
  } else {
    ko("aceitou equipamento inventado", aposLixo);
  }

  // 5. NULL/{} continua a ser aceite (quem não treina em híbrido)
  const limpar = await patch(A, `profiles?id=eq.${A.id}`, { gym_days_per_week: null, home_equipment: [] });
  const aposLimpar = await get(A, `profiles?id=eq.${A.id}&select=${COLS}`);
  if (limpar.status < 400 && aposLimpar?.[0]?.gym_days_per_week === null) {
    ok("mudar de local limpa as colunas (NULL / '{}')");
  } else {
    ko("não foi possível limpar as colunas", aposLimpar);
  }

  // 6. terceiro não mexe
  await patch(A, `profiles?id=eq.${A.id}`, { gym_days_per_week: 2 });
  await patch(B, `profiles?id=eq.${A.id}`, { gym_days_per_week: 5, home_equipment: ["barra"] });
  const aposB = await get(A, `profiles?id=eq.${A.id}&select=${COLS}`);
  if (aposB?.[0]?.gym_days_per_week === 2 && aposB?.[0]?.home_equipment?.length === 0) {
    ok("terceiro NÃO altera gym_days_per_week/home_equipment de outro perfil");
  } else {
    ko("um terceiro conseguiu alterar as colunas de A", aposB);
  }

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
