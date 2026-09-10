/**
 * E2E do motor de treino ↔ base de dados (parte 1).
 *
 * Cria uma conta nova, gera um plano com o motor PURO, grava-o em
 * training_plans.days (jsonb), lê de volta e confirma que:
 *   - o JSON sobrevive à ida/volta ao jsonb;
 *   - a regra crítica (hipertrofia ≥2×/semana) continua verdadeira na cópia
 *     lida da BD;
 *   - as políticas RLS deixam o utilizador gravar/ler o SEU plano e barram
 *     gravar em nome de outro.
 *
 * Requisitos: "Confirm email" DESLIGADO no Supabase Auth.
 * Uso: node scripts/plano-e2e.ts
 */
import { readFileSync } from "node:fs";
import {
  buildWeek,
  checkHypertrophyFrequency,
  maxesFromPRs,
  type MetaMotor,
  type MotorProfile,
} from "../src/lib/motor/index.ts";

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

async function main() {
  const ts = Date.now();
  const email = `patrick00santos+e2e${ts}@gmail.com`;
  const signup = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "Testpass123!",
      data: { name: "Motor E2E", role: "atleta" },
    }),
  }).then((r) => r.json());

  const token: string | undefined = signup.access_token;
  const uid: string | undefined = signup.user?.id;
  if (!token || !uid) {
    console.error("Signup não devolveu sessão — 'Confirm email' está ligado?");
    console.error(signup);
    process.exit(2);
  }
  console.log(`Setup — conta ${email}\n`);

  const h = {
    apikey: KEY,
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  // --- ler personal_records (vazio) e montar cargas ---
  const prs = await fetch(
    `${REST}/personal_records?user_id=eq.${uid}&select=lift,value_kg`,
    { headers: h },
  ).then((r) => r.json());
  ok(`personal_records lidos (${Array.isArray(prs) ? prs.length : "?"} registos)`);
  const maxes = maxesFromPRs(Array.isArray(prs) ? prs : []);

  // --- gerar plano com o motor ---
  const profile: MotorProfile = {
    goal: "hipertrofia",
    sex: "homem",
    level: "intermedio",
    daysPerWeek: 4,
    location: "ginasio",
    injuries: ["ombro"],
    focus: ["gluteo"],
    splitStyle: "freq",
  };
  const plano = buildWeek(profile, maxes);
  const freqLocal = checkHypertrophyFrequency(plano, 2);
  if (freqLocal.ok) ok("motor: hipertrofia 4d ≥2×/semana antes de gravar");
  else ko("motor: frequência falhou antes de gravar", freqLocal.failing);

  // --- gravar em training_plans ---
  const ins = await fetch(`${REST}/training_plans`, {
    method: "POST",
    headers: { ...h, prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: uid,
      student_id: uid,
      name: `Hipertrofia · 4 dias/semana`,
      split_style: (plano.meta as MetaMotor).splitStyle,
      days: plano,
      is_active: true,
    }),
  });
  const insBody = await ins.json();
  const planId = Array.isArray(insBody) ? insBody[0]?.id : undefined;
  if (ins.ok && planId) ok("RLS: utilizador grava o SEU plano em training_plans");
  else ko("gravar plano falhou", insBody);

  // --- ler de volta ---
  const back = await fetch(
    `${REST}/training_plans?id=eq.${planId}&select=name,split_style,days`,
    { headers: h },
  ).then((r) => r.json());
  const stored = back?.[0]?.days;
  if (stored && stored.version === 1 && Array.isArray(stored.days) && stored.days.length === 7) {
    ok("jsonb: plano lido de volta com 7 dias e meta intactos");
  } else {
    ko("jsonb: estrutura não sobreviveu", stored);
  }

  const freqStored = checkHypertrophyFrequency(stored, 2);
  if (freqStored.ok) ok("regra crítica confirmada NA CÓPIA lida da BD (≥2×/semana)");
  else ko("regra crítica falhou na cópia da BD", { failing: freqStored.failing, freq: freqStored.freq });

  const treino = stored.days.filter((d: { rest: boolean }) => !d.rest);
  if (treino.length === 4) ok("plano gravado tem 4 dias de treino");
  else ko(`plano gravado tem ${treino.length} dias de treino (esperado 4)`);

  const temSubstituicao = stored.days
    .filter((d: { rest: boolean }) => !d.rest)
    .flatMap((d: { exercises?: { substituted?: boolean }[] }) => d.exercises ?? [])
    .some((e: { substituted?: boolean }) => e.substituted);
  if (temSubstituicao) ok("lesão de ombro: pelo menos um exercício substituído no plano gravado");
  else ko("lesão de ombro não gerou substituição no plano gravado");

  // --- segurança: gravar em nome de outro ---
  const forge = await fetch(`${REST}/training_plans`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      owner_id: "00000000-0000-0000-0000-000000000000",
      name: "forjado",
      days: {},
    }),
  });
  const forgeBody = await forge.json();
  if (forgeBody?.code === "42501") ok("RLS: gravar plano em nome de outro → bloqueado (42501)");
  else ko("RLS: gravar em nome de outro NÃO foi bloqueado", forgeBody);

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
