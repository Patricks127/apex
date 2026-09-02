import type { SupabaseClient } from "@supabase/supabase-js";

/** ISO de há N dias — para filtrar registos recentes sem chamar Date no render. */
export function janelaRecente(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}
import {
  maxesFromPRs,
  type FocusMuscle,
  type Goal,
  type Injury,
  type Level,
  type Lift,
  type Location,
  type MotorProfile,
  type Sex,
} from "@/lib/motor";

/**
 * Lê o perfil (colunas de onboarding) + personal_records e monta o
 * `MotorProfile` e as cargas. Devolve null se o onboarding não estiver
 * completo. Recebe o cliente Supabase já autenticado — a RLS trata do resto.
 */
export async function carregarPerfilMotor(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ motorProfile: MotorProfile; maxes: Partial<Record<Lift, number>> } | null> {
  const { data: perfil } = await supabase
    .from("profiles")
    .select(
      "goal, sex, level, days_per_week, location, location_note, injuries, injury_note, focus_muscles",
    )
    .eq("id", userId)
    .single();

  if (
    !perfil ||
    !perfil.goal ||
    !perfil.sex ||
    !perfil.level ||
    !perfil.days_per_week ||
    !perfil.location
  ) {
    return null;
  }

  const { data: prs } = await supabase
    .from("personal_records")
    .select("lift, value_kg")
    .eq("user_id", userId);

  return {
    motorProfile: {
      goal: perfil.goal as Goal,
      sex: perfil.sex as Sex,
      level: perfil.level as Level,
      daysPerWeek: perfil.days_per_week as number,
      location: perfil.location as Location,
      locationNote: perfil.location_note as string | null,
      injuries: (perfil.injuries ?? []) as Injury[],
      injuryNote: perfil.injury_note as string | null,
      focus: (perfil.focus_muscles ?? []) as FocusMuscle[],
    },
    maxes: maxesFromPRs(prs ?? []),
  };
}
