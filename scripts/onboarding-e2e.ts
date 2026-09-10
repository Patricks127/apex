/**
 * Teste final do /onboarding (parte 1) — precisa da migração 004 aplicada
 * e de "Confirm email" DESLIGADO no Supabase Auth.
 *
 * Reproduz, com um token real, exatamente o que a Server Action faz:
 *   1. grava os campos do onboarding em profiles (sob RLS);
 *   2. os CHECK da migração 004 rejeitam valores inválidos;
 *   3. lê o perfil, corre o motor e grava o plano em training_plans;
 *   4. a regra crítica (hipertrofia ≥2×/semana) mantém-se na cópia da BD.
 *
 * Uso: node scripts/onboarding-e2e.ts
 */
import { readFileSync } from "node:fs";
import {
  buildWeek,
  checkHypertrophyFrequency,
  maxesFromPRs,
  GOALS,
  type FocusMuscle,
  type Goal,
  type Injury,
  type Level,
  type Location,
  type MetaMotor,
  type MotorProfile,
  type Sex,
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
  const email = `patrick00santos+onb${ts}@gmail.com`;
  const signup = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "Testpass123!",
      data: { name: "Onboarding E2E", role: "atleta" },
    }),
  }).then((r) => r.json());
  const token: string | undefined = signup.access_token;
  const uid: string | undefined = signup.user?.id;
  if (!token || !uid) {
    console.error("Signup sem sessão — 'Confirm email' está ligado?", signup);
    process.exit(2);
  }
  console.log(`Setup — conta ${email}\n`);
  const h = {
    apikey: KEY,
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  const patchProfile = (body: unknown) =>
    fetch(`${REST}/profiles?id=eq.${uid}`, {
      method: "PATCH",
      headers: { ...h, prefer: "return=representation" },
      body: JSON.stringify(body),
    });

  // --- 1. CHECK da migração 004 rejeita lixo ---
  const bad = await patchProfile({ goal: "musculacao" });
  const badBody = await bad.json();
  if (badBody?.code === "23514") ok("CHECK 004: goal inválido → rejeitado (23514)");
  else ko("CHECK de goal não rejeitou valor inválido", badBody);

  const badDays = await patchProfile({ days_per_week: 8 });
  if ((await badDays.json())?.code === "23514") ok("CHECK 004: days_per_week=8 → rejeitado");
  else ko("CHECK de days_per_week não rejeitou 8");

  const badSex = await patchProfile({ sex: "outro" });
  if ((await badSex.json())?.code === "23514") ok("CHECK 004: sex inválido → rejeitado");
  else ko("CHECK de sex não rejeitou valor inválido");

  // --- 2. gravar onboarding válido (RLS: o próprio) ---
  const onboarding = {
    goal: "hipertrofia" as Goal,
    sex: "homem" as Sex,
    level: "intermedio" as Level,
    days_per_week: 5,
    location: "ginasio" as Location,
    location_note: null,
    injuries: ["ombro", "joelho"] as Injury[],
    injury_note: "dor no ombro direito a puxar",
    focus_muscles: ["gluteo", "core"] as FocusMuscle[],
  };
  const save = await patchProfile(onboarding);
  const saveBody = await save.json();
  if (save.ok && Array.isArray(saveBody) && saveBody[0]?.goal === "hipertrofia") {
    ok("RLS: utilizador grava o SEU onboarding em profiles");
  } else {
    ko("gravar onboarding falhou", saveBody);
  }
  const row = saveBody[0] ?? {};
  if (JSON.stringify(row.injuries) === JSON.stringify(["ombro", "joelho"])) {
    ok("array injuries gravado tal e qual");
  } else {
    ko("injuries não persistiu como esperado", row.injuries);
  }
  if (JSON.stringify(row.focus_muscles) === JSON.stringify(["gluteo", "core"])) {
    ok("array focus_muscles gravado tal e qual");
  } else {
    ko("focus_muscles não persistiu", row.focus_muscles);
  }

  // --- 3. reproduzir criarPlano: ler perfil → motor → gravar plano ---
  const perfil = (
    await fetch(
      `${REST}/profiles?id=eq.${uid}&select=goal,sex,level,days_per_week,location,location_note,injuries,injury_note,focus_muscles`,
      { headers: h },
    ).then((r) => r.json())
  )[0];

  const prs = await fetch(
    `${REST}/personal_records?user_id=eq.${uid}&select=lift,value_kg`,
    { headers: h },
  ).then((r) => r.json());

  const motorProfile: MotorProfile = {
    goal: perfil.goal,
    sex: perfil.sex,
    level: perfil.level,
    daysPerWeek: perfil.days_per_week,
    location: perfil.location,
    locationNote: perfil.location_note,
    injuries: perfil.injuries ?? [],
    injuryNote: perfil.injury_note,
    focus: perfil.focus_muscles ?? [],
  };
  const plano = buildWeek(motorProfile, maxesFromPRs(prs ?? []));
  const nome = `${GOALS.find((g) => g.id === motorProfile.goal)?.short} · ${motorProfile.daysPerWeek} dias/semana`;

  const ins = await fetch(`${REST}/training_plans`, {
    method: "POST",
    headers: { ...h, prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: uid,
      student_id: uid,
      name: nome,
      split_style: (plano.meta as MetaMotor).splitStyle,
      days: plano,
      is_active: true,
    }),
  });
  const insBody = await ins.json();
  const planId = Array.isArray(insBody) ? insBody[0]?.id : undefined;
  if (ins.ok && planId) ok(`plano gerado e gravado ("${nome}")`);
  else ko("gravar plano falhou", insBody);

  // --- 4. ler de volta e re-verificar a regra crítica ---
  const back = (
    await fetch(`${REST}/training_plans?id=eq.${planId}&select=days,split_style`, {
      headers: h,
    }).then((r) => r.json())
  )[0];
  const stored = back?.days;
  const treino = stored?.days?.filter((d: { rest: boolean }) => !d.rest) ?? [];
  if (treino.length === 5) ok("plano gravado tem 5 dias de treino (= days_per_week)");
  else ko(`plano gravado tem ${treino.length} dias de treino (esperado 5)`);

  const freq = checkHypertrophyFrequency(stored, 2);
  if (freq.ok) {
    ok(`regra crítica na cópia da BD: cada grupo grande ≥2×/semana  ${JSON.stringify(freq.freq)}`);
  } else {
    ko("regra crítica falhou na cópia da BD", { failing: freq.failing, freq: freq.freq });
  }

  const subs = stored.days
    .filter((d: { rest: boolean }) => !d.rest)
    .flatMap((d: { exercises?: { substituted?: boolean; name: string }[] }) => d.exercises ?? [])
    .filter((e: { substituted?: boolean }) => e.substituted);
  if (subs.length >= 1) ok(`lesões (ombro, joelho): ${subs.length} exercício(s) substituído(s)`);
  else ko("lesões declaradas não geraram substituição");

  const focoGluteo = stored.days
    .filter((d: { rest: boolean }) => !d.rest)
    .flatMap((d: { exercises?: { focusTag?: string }[] }) => d.exercises ?? [])
    .some((e: { focusTag?: string }) => e.focusTag === "Glúteo");
  if (focoGluteo) ok("foco de glúteo aplicado no plano gravado");
  else ko("foco de glúteo não apareceu no plano");

  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
