"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPerfilMotor } from "@/lib/treino/perfil";
import {
  advanceWeek,
  initProgression,
  referenceLoads,
  LIFT_LABEL,
  GOALS,
  type FocusMuscle,
  type Goal,
  type Injury,
  type Level,
  type Lift,
  type Location,
  type Progression,
  type Sex,
} from "@/lib/motor";
import { gerarPlanoV2 } from "@/lib/motor2";

const GOAL_IDS = GOALS.map((g) => g.id) as Goal[];
const SEXES: Sex[] = ["homem", "mulher"];
const LEVELS: Level[] = ["iniciante", "intermedio", "avancado"];
const LOCATIONS: Location[] = ["ginasio", "casa", "hibrido", "parque", "outro"];
const INJURY_IDS: Injury[] = [
  "ombro",
  "cotovelo",
  "pulso",
  "joelho",
  "lombar",
  "anca",
  "tornozelo",
  "pescoco",
];
const FOCUS_IDS: FocusMuscle[] = ["gluteo", "peito", "costas", "ombros", "bracos", "core"];
const EFFORTS = ["abaixo", "equilibrado", "limite", "passei"] as const;

const BLOQUEIO_RLS =
  "Não foi possível guardar. As políticas de segurança da base de dados podem estar a bloquear esta operação.";

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export type EstadoOnboarding = {
  erros?: Record<string, string>;
  mensagem?: string;
};

export async function guardarOnboarding(
  _anterior: EstadoOnboarding,
  formData: FormData,
): Promise<EstadoOnboarding> {
  const goal = String(formData.get("goal") ?? "");
  const sex = String(formData.get("sex") ?? "");
  const level = String(formData.get("level") ?? "");
  const daysRaw = String(formData.get("days_per_week") ?? "");
  const location = String(formData.get("location") ?? "");
  const locationNote = String(formData.get("location_note") ?? "").trim();
  const injuryNote = String(formData.get("injury_note") ?? "").trim();
  const injuries = formData.getAll("injuries").map(String).filter((v) => INJURY_IDS.includes(v as Injury));
  const focus = formData.getAll("focus_muscles").map(String).filter((v) => FOCUS_IDS.includes(v as FocusMuscle));
  const splitFormatRaw = String(formData.get("split_format") ?? "auto");
  const splitFormat = (["frequencia", "muscular", "auto"] as const).includes(splitFormatRaw as never)
    ? splitFormatRaw
    : "auto";

  const erros: Record<string, string> = {};
  if (!GOAL_IDS.includes(goal as Goal)) erros.goal = "Escolhe um objetivo.";
  if (!SEXES.includes(sex as Sex)) erros.sex = "Escolhe uma opção.";
  if (!LEVELS.includes(level as Level)) erros.level = "Escolhe o teu nível.";
  const daysPerWeek = Number.parseInt(daysRaw, 10);
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 3 || daysPerWeek > 6) {
    erros.days_per_week = "Escolhe entre 3 e 6 dias.";
  }
  if (!LOCATIONS.includes(location as Location)) erros.location = "Escolhe onde treinas.";
  if (location === "outro" && locationNote.length < 2) {
    erros.location_note = "Descreve o local de treino.";
  }
  if (locationNote.length > 120) erros.location_note = "Máximo 120 caracteres.";
  if (injuryNote.length > 200) erros.injury_note = "Máximo 200 caracteres.";

  if (Object.keys(erros).length > 0) return { erros };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { mensagem: "Sessão inválida. Inicia sessão outra vez." };

  const { error: erroPerfil } = await supabase
    .from("profiles")
    .update({
      goal,
      sex,
      level,
      days_per_week: daysPerWeek,
      location,
      location_note: location === "outro" ? locationNote : null,
      injuries,
      injury_note: injuries.length ? injuryNote || null : null,
      focus_muscles: goal === "hipertrofia" ? focus : [],
      split_format: goal === "hipertrofia" ? splitFormat : "auto",
    })
    .eq("id", user.id);

  if (erroPerfil) return { mensagem: BLOQUEIO_RLS };

  const resultado = await criarPlano(user.id);
  if (resultado.erro) return { mensagem: resultado.erro };

  redirect("/plano");
}

// ---------------------------------------------------------------------------
// (Re)gerar o plano — reinicia a progressão (é relativa a este plano)
// ---------------------------------------------------------------------------

export async function regenerarPlano(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  await criarPlano(user.id);
  revalidatePath("/plano");
}

async function criarPlano(userId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const ctx = await carregarPerfilMotor(supabase, userId);
  if (!ctx) return { erro: "Completa o onboarding primeiro." };

  const progression = initProgression();
  const plano = gerarPlanoV2(ctx.motorProfile, ctx.maxes, { progression });
  const nomeObjetivo = GOALS.find((g) => g.id === ctx.motorProfile.goal)?.short ?? "Plano";

  await supabase
    .from("training_plans")
    .update({ is_active: false })
    .eq("owner_id", userId)
    .eq("is_active", true);

  const { error } = await supabase.from("training_plans").insert({
    owner_id: userId,
    student_id: userId,
    name: `${nomeObjetivo} · ${ctx.motorProfile.daysPerWeek} dias/semana`,
    split_style: plano.meta.splitStyle,
    days: plano,
    progression,
    is_active: true,
  });

  if (error) return { erro: BLOQUEIO_RLS };
  return {};
}

// ---------------------------------------------------------------------------
// Registar um treino (workout_sessions + workout_checkins)
// ---------------------------------------------------------------------------

export type EstadoRegisto = { erro?: string };

export async function gravarTreino(
  _anterior: EstadoRegisto,
  formData: FormData,
): Promise<EstadoRegisto> {
  const title = String(formData.get("title") ?? "").trim();
  const setsDone = Number.parseInt(String(formData.get("sets_done") ?? "0"), 10);
  const setsTotal = Number.parseInt(String(formData.get("sets_total") ?? "0"), 10);
  const volumeKg = Number.parseFloat(String(formData.get("volume_kg") ?? "0"));
  const avgRpeRaw = String(formData.get("avg_rpe") ?? "").trim();
  const weekNumber = Number.parseInt(String(formData.get("week_number") ?? "1"), 10);
  const effort = String(formData.get("effort") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const zones = formData
    .getAll("discomfort_zones")
    .map(String)
    .filter((z) => INJURY_IDS.includes(z as Injury));

  if (!title) return { erro: "Falta o nome da sessão." };
  if (!Number.isInteger(setsDone) || setsDone < 0) return { erro: "Séries inválidas." };
  if (effort && !EFFORTS.includes(effort as (typeof EFFORTS)[number])) {
    return { erro: "Valor de esforço inválido." };
  }
  if (note.length > 500) return { erro: "Nota demasiado longa (máx. 500)." };

  const avgRpe = avgRpeRaw ? Number.parseFloat(avgRpeRaw) : null;
  if (avgRpe != null && (!isFinite(avgRpe) || avgRpe < 6 || avgRpe > 10)) {
    return { erro: "RPE médio fora do intervalo 6–10." };
  }
  const completion =
    Number.isInteger(setsTotal) && setsTotal > 0
      ? Math.min(1, Math.max(0, setsDone / setsTotal))
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { data: sessao, error: erroSessao } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      title,
      n_sets: setsDone,
      volume_kg: Number.isFinite(volumeKg) ? Math.round(volumeKg) : 0,
      avg_rpe: avgRpe,
      completion,
      week_number: Number.isInteger(weekNumber) ? weekNumber : 1,
    })
    .select("id")
    .single();

  if (erroSessao || !sessao) return { erro: BLOQUEIO_RLS };

  const { error: erroCheckin } = await supabase.from("workout_checkins").insert({
    user_id: user.id,
    session_id: sessao.id,
    discomfort_zones: zones,
    effort: effort || null,
    note: note || null,
  });

  if (erroCheckin) return { erro: BLOQUEIO_RLS };

  revalidatePath("/plano");
  redirect("/plano?treino=gravado");
}

// ---------------------------------------------------------------------------
// Avançar a semana (progressão)
// ---------------------------------------------------------------------------

export type EstadoAvanco = {
  erro?: string;
  ok?: boolean;
  semana?: number;
  deload?: boolean;
  reason?: string;
  cargas?: { lift: string; antes: number; depois: number }[];
};

export async function avancarSemana(
  _anterior: EstadoAvanco,
  _formData: FormData,
): Promise<EstadoAvanco> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const ctx = await carregarPerfilMotor(supabase, user.id);
  if (!ctx) return { erro: "Completa o onboarding primeiro." };

  const { data: plano } = await supabase
    .from("training_plans")
    .select("id, progression")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plano) return { erro: "Não há plano ativo." };
  const prog = (plano.progression ?? initProgression()) as Progression;

  const { data: sessoes } = await supabase
    .from("workout_sessions")
    .select("avg_rpe, completion")
    .eq("user_id", user.id)
    .eq("week_number", prog.week);

  if (!sessoes || sessoes.length === 0) {
    return { erro: "Regista pelo menos um treino desta semana antes de avançar." };
  }

  const rpes = sessoes.map((s) => s.avg_rpe).filter((v): v is number => v != null);
  const comps = sessoes.map((s) => s.completion).filter((v): v is number => v != null);
  const meanRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 8;
  const meanComp = comps.length ? comps.reduce((a, b) => a + b, 0) / comps.length : 1;

  const antesLoads = referenceLoads(ctx.motorProfile, ctx.maxes, prog);
  const novoProg = advanceWeek(prog, ctx.motorProfile, meanRpe, meanComp);
  const depoisLoads = referenceLoads(ctx.motorProfile, ctx.maxes, novoProg);
  const novoPlano = gerarPlanoV2(ctx.motorProfile, ctx.maxes, { progression: novoProg });

  const { error } = await supabase
    .from("training_plans")
    .update({ progression: novoProg, days: novoPlano })
    .eq("id", plano.id)
    .eq("owner_id", user.id);

  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/plano");
  return {
    ok: true,
    semana: novoProg.week,
    deload: novoProg.deloadWeek,
    reason: novoProg.reason,
    cargas: (["agachamento", "terra", "supino", "press"] as Lift[]).map((k) => ({
      lift: LIFT_LABEL[k],
      antes: antesLoads[k],
      depois: depoisLoads[k],
    })),
  };
}
