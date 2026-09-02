/**
 * E2E da parte 2 — registo, progressão e check-in — contra a BD real.
 * Requisitos: migração 004 + 005 aplicadas; "Confirm email" DESLIGADO.
 *
 * 1. cria conta, faz onboarding e gera plano (com progressão inicial);
 * 2. regista uma SEMANA COMPLETA de treinos com RPE baixo (7) e volume 100%;
 * 3. avança a semana (reproduz avancarSemana): agrega, decide, re-materializa;
 * 4. confirma que as CARGAS SUBIRAM no plano gravado — mostra antes/depois;
 * 5. grava um check-in com desconforto no ombro e confirma o efeito (−8% +
 *    "carga cautelar") na sessão seguinte, ao vivo.
 */
import { readFileSync } from "node:fs";
import {
  buildWeek,
  buildDay,
  advanceWeek,
  initProgression,
  referenceLoads,
  type Injury,
  type MotorProfile,
  type Progression,
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
  const email = `patrick00santos+prog${Date.now()}@gmail.com`;
  const s = await fetch(`${AUTH}/signup`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Testpass123!", data: { name: "Progressão E2E", role: "atleta" } }),
  }).then((r) => r.json());
  if (!s.access_token) {
    console.error("Signup sem sessão — 'Confirm email' ligado?", s);
    process.exit(2);
  }
  const uid: string = s.user.id;
  const h = { apikey: KEY, authorization: `Bearer ${s.access_token}`, "content-type": "application/json" };
  const get = (p: string) => fetch(`${REST}/${p}`, { headers: h }).then((r) => r.json());
  const patch = (p: string, b: unknown) =>
    fetch(`${REST}/${p}`, { method: "PATCH", headers: { ...h, prefer: "return=representation" }, body: JSON.stringify(b) });
  const post = (p: string, b: unknown, repr = true) =>
    fetch(`${REST}/${p}`, { method: "POST", headers: repr ? { ...h, prefer: "return=representation" } : h, body: JSON.stringify(b) });

  console.log(`Setup — ${email}\n`);

  // --- onboarding (colunas da 004) ---
  await patch(`profiles?id=eq.${uid}`, {
    goal: "hipertrofia",
    sex: "homem",
    level: "intermedio",
    days_per_week: 4,
    location: "ginasio",
    injuries: [],
    focus_muscles: [],
  });

  // recorde real para as cargas serem determinísticas
  await post("personal_records", { user_id: uid, lift: "agachamento", value_kg: 140 }, false);
  await post("personal_records", { user_id: uid, lift: "supino", value_kg: 100 }, false);
  const prs = await get(`personal_records?user_id=eq.${uid}&select=lift,value_kg`);
  const maxes = { agachamento: 140, supino: 100 };

  const profile: MotorProfile = {
    goal: "hipertrofia",
    sex: "homem",
    level: "intermedio",
    daysPerWeek: 4,
    location: "ginasio",
    injuries: [],
    focus: [],
  };

  // --- gerar plano com progressão inicial (reproduz criarPlano) ---
  const prog0 = initProgression();
  const plano0 = buildWeek(profile, maxes, { progression: prog0 });
  const ins = await post("training_plans", {
    owner_id: uid,
    student_id: uid,
    name: "Hipertrofia · 4 dias/semana",
    split_style: plano0.meta.splitStyle,
    days: plano0,
    progression: prog0,
    is_active: true,
  });
  const insBody = await ins.json();
  const planId = insBody[0]?.id;
  if (ins.ok && planId && insBody[0].progression?.week === 1) {
    ok("plano criado com progressão inicial (semana 1) na coluna training_plans.progression");
  } else {
    ko("criar plano com progressão falhou", insBody);
  }

  const antes = referenceLoads(profile, maxes, prog0);

  // --- registar a SEMANA 1 completa: RPE 7, volume 100% ---
  const treino = plano0.days.filter((d) => !d.rest);
  for (const d of treino) {
    const nSets = (d.exercises ?? []).reduce((a, e) => a + e.sets.length, 0);
    const vol = (d.exercises ?? []).reduce(
      (a, e) => a + e.sets.reduce((x, st) => x + (st.w ?? 0) * st.reps, 0),
      0,
    );
    const sess = await post("workout_sessions", {
      user_id: uid,
      title: d.title,
      n_sets: nSets,
      volume_kg: Math.round(vol),
      avg_rpe: 7,
      completion: 1,
      week_number: 1,
    });
    const sid = (await sess.json())[0].id;
    await post("workout_checkins", { user_id: uid, session_id: sid, discomfort_zones: [], effort: "equilibrado" }, false);
  }
  const semana1 = await get(`workout_sessions?user_id=eq.${uid}&week_number=eq.1&select=avg_rpe,completion`);
  if (Array.isArray(semana1) && semana1.length === treino.length) {
    ok(`semana 1 registada: ${semana1.length} sessões, RPE 7, volume 100%`);
  } else {
    ko("registo da semana 1 incompleto", semana1);
  }

  // --- avançar semana (reproduz avancarSemana) ---
  const rpes = semana1.map((x: { avg_rpe: number }) => x.avg_rpe);
  const comps = semana1.map((x: { completion: number }) => x.completion);
  const meanRpe = rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length;
  const meanComp = comps.reduce((a: number, b: number) => a + b, 0) / comps.length;
  const prog1 = advanceWeek(prog0, profile, meanRpe, meanComp);
  const depois = referenceLoads(profile, maxes, prog1);
  const plano1 = buildWeek(profile, maxes, { progression: prog1 });
  const upd = await patch(`training_plans?id=eq.${planId}`, { progression: prog1, days: plano1 });
  if (!upd.ok) ko("update do plano após avançar semana falhou", await upd.json());

  // --- ler de volta e comparar ---
  const back = (await get(`training_plans?id=eq.${planId}&select=progression,days`))[0];
  const progBack = back.progression as Progression;
  const daysBack = back.days as ReturnType<typeof buildWeek>;

  if (progBack.week === 2 && (progBack.repBonus === 1 || progBack.loadBonus > 0)) {
    ok(`progressão avançou para a semana ${progBack.week} (repBonus ${progBack.repBonus}, loadBonus ${progBack.loadBonus} kg) — motivo: ${progBack.reason}`);
  } else {
    ko("progressão não avançou como esperado", progBack);
  }

  // reps sobem primeiro (progressão dupla) — semana fácil → +1 rep
  const supAntes = plano0.days.find((d) => !d.rest)!.exercises!.find((e) => e.name === "Supino com barra")!;
  const supDepois = daysBack.days.find((d) => !d.rest)!.exercises!.find((e) => e.name === "Supino com barra")!;
  console.log(
    `\n  Supino com barra — semana 1: ${supAntes.sets[0].w} kg × ${supAntes.sets[0].reps}` +
      `  →  semana 2: ${supDepois.sets[0].w} kg × ${supDepois.sets[0].reps}`,
  );
  console.log("  Cargas de referência (kg), semana 1 → semana 2:");
  for (const k of ["agachamento", "terra", "supino", "press"] as const) {
    const seta = depois[k] > antes[k] ? "↑" : depois[k] < antes[k] ? "↓" : "=";
    console.log(`    ${k.padEnd(12)} ${String(antes[k]).padStart(5)}  →  ${String(depois[k]).padStart(5)}  ${seta}`);
  }
  if (supDepois.sets[0].reps > supAntes.sets[0].reps) {
    ok("semana fácil → progressão dupla: as REPS subiram na cópia lida da BD");
  } else {
    ko("as reps não subiram", { antes: supAntes.sets[0].reps, depois: supDepois.sets[0].reps });
  }

  // Duas semanas fáceis extra para forçar a subida de CARGA e ver na BD.
  let p = prog1;
  for (let i = 0; i < 2; i++) p = advanceWeek(p, profile, 7, 1);
  const planoN = buildWeek(profile, maxes, { progression: p });
  await patch(`training_plans?id=eq.${planId}`, { progression: p, days: planoN });
  const backN = (await get(`training_plans?id=eq.${planId}&select=days,progression`))[0] as {
    days: ReturnType<typeof buildWeek>;
    progression: Progression;
  };
  const findAgach = (plano: ReturnType<typeof buildWeek>) =>
    plano.days
      .filter((d) => !d.rest)
      .flatMap((d) => d.exercises ?? [])
      .find((e) => e.name === "Agachamento com barra");
  const agN = findAgach(backN.days);
  const agBase = findAgach(plano0)!;
  console.log(
    `\n  Agachamento com barra — semana 1: ${agBase.sets[0].w} kg  →  semana ${backN.progression.week}: ${agN?.sets[0].w} kg  (loadBonus ${backN.progression.loadBonus} kg)`,
  );
  if (agN && agN.sets[0].w! > agBase.sets[0].w!) {
    ok("após mais semanas fáceis: a CARGA do agachamento subiu no plano gravado");
  } else {
    ko("a carga do agachamento não subiu na BD", { base: agBase.sets[0].w, agora: agN?.sets[0].w });
  }

  // --- efeito do check-in: desconforto no ombro → sessão seguinte com −8% ---
  const sessX = await post("workout_sessions", { user_id: uid, title: "Superior B", week_number: backN.progression.week });
  await post(
    "workout_checkins",
    { user_id: uid, session_id: (await sessX.json())[0].id, discomfort_zones: ["ombro"], effort: "limite" },
    false,
  );
  const recentes = await get(
    `workout_checkins?user_id=eq.${uid}&order=created_at.desc&limit=1&select=discomfort_zones`,
  );
  const zonas = (recentes[0]?.discomfort_zones ?? []) as Injury[];
  const diaNormal = buildDay(profile, 0, maxes, { progression: p })!;
  const diaCauteloso = buildDay(profile, 0, maxes, { progression: p, checkinZones: zonas })!;
  const sN = diaNormal.exercises!.find((e) => e.name === "Supino com barra")!;
  const sC = diaCauteloso.exercises!.find((e) => e.name === "Supino com barra")!;
  console.log(
    `\n  Check-in com desconforto no ombro → Supino com barra: ${sN.sets[0].w} kg  →  ${sC.sets[0].w} kg (cautelar)`,
  );
  if (sC.sets[0].w! < sN.sets[0].w! && sC.caution && /cautelar/i.test(sC.swap ?? "")) {
    ok("check-in com desconforto → sessão seguinte com −8% e aviso 'carga cautelar'");
  } else {
    ko("o check-in não reduziu a carga da sessão seguinte", { normal: sN.sets[0].w, cauteloso: sC.sets[0].w });
  }

  void prs;
  console.log(`\n\x1b[1mResultado: ${pass} PASS / ${fail} FAIL\x1b[0m`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
