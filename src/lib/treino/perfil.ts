import type { SupabaseClient } from "@supabase/supabase-js";

/** ISO de há N dias — para filtrar registos recentes sem chamar Date no render. */
export function janelaRecente(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

/**
 * Já foi registada uma sessão de treino hoje com este título? Casa por
 * título (não só "algo recente") para não marcar "feito" se o treino
 * registado foi de um dia diferente do agendado — usado em /plano (estado
 * "a decorrer" só existe para o dia de hoje) e em /painel (bloco principal
 * do atleta).
 */
export async function treinoDeHojeFeito(
  supabase: SupabaseClient,
  userId: string,
  titulo: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("workout_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("title", titulo)
    .gte("created_at", janelaRecente(1));
  return (count ?? 0) > 0;
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
  type PlanoGerado,
  type Progression,
  type Sex,
} from "@/lib/motor";
import { equipamentoPorDiaDe, planoParaExibir } from "@/lib/motor2";
import type { Equipamento } from "@/lib/motor2";

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
      "goal, sex, level, days_per_week, location, location_note, injuries, injury_note, focus_muscles, split_format, gym_days_per_week, home_equipment",
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

  const location = perfil.location as Location;
  const daysPerWeek = perfil.days_per_week as number;
  const gymDaysPerWeek = (perfil.gym_days_per_week ?? null) as number | null;
  const homeEquipment = (perfil.home_equipment ?? []) as Equipamento[];

  return {
    motorProfile: {
      goal: perfil.goal as Goal,
      sex: perfil.sex as Sex,
      level: perfil.level as Level,
      daysPerWeek,
      location,
      locationNote: perfil.location_note as string | null,
      gymDaysPerWeek,
      equipamentoPorDia: equipamentoPorDiaDe({
        location,
        dias: daysPerWeek,
        diasGinasio: gymDaysPerWeek,
        equipamentoCasa: homeEquipment,
      }),
      injuries: (perfil.injuries ?? []) as Injury[],
      injuryNote: perfil.injury_note as string | null,
      focus: (perfil.focus_muscles ?? []) as FocusMuscle[],
      splitFormat: (perfil.split_format ?? "auto") as "frequencia" | "muscular" | "auto",
    },
    maxes: maxesFromPRs(prs ?? []),
  };
}

// ---------------------------------------------------------------------------
// Plano ativo — porta única para "qual é o plano deste aluno agora"
// ---------------------------------------------------------------------------

export type PlanoAtivo = {
  id: string;
  name: string;
  days: PlanoGerado;
  progression: Progression | null;
  /** true = o próprio utilizador é o dono (plano gerado pelo motor);
   *  false = o dono é um PT (plano atribuído). */
  souDono: boolean;
};

/**
 * O plano que este utilizador está a seguir agora, seja ele próprio (gerado
 * pelo motor) ou atribuído por um PT. Lê primeiro `active_plans` (o
 * ponteiro que o aluno controla, migração 012); se não houver linha aí,
 * cai para a query antiga (`training_plans` por `owner_id` + `is_active`)
 * — compatibilidade com quem já tinha plano antes desta tabela existir.
 */
type LinhaPlano = {
  id: string;
  name: string;
  days: PlanoGerado;
  progression: Progression | null;
  owner_id: string;
  student_id: string;
};

function paraPlanoAtivo(plano: LinhaPlano): PlanoAtivo {
  const souDono = plano.owner_id === plano.student_id;
  return {
    id: plano.id,
    name: plano.name,
    // planos do motor já vêm com a progressão aplicada na própria geração —
    // `planoParaExibir` só transforma planos de PT (meta.origem === "pt").
    days: planoParaExibir(plano.days, plano.progression),
    progression: plano.progression,
    souDono,
  };
}

export async function carregarPlanoAtivo(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanoAtivo | null> {
  const { data: ponteiro } = await supabase
    .from("active_plans")
    .select("plan_id")
    .eq("student_id", userId)
    .maybeSingle();

  if (ponteiro?.plan_id) {
    const { data: plano } = await supabase
      .from("training_plans")
      .select("id, name, days, progression, owner_id, student_id")
      .eq("id", ponteiro.plan_id)
      .maybeSingle();
    if (plano) return paraPlanoAtivo(plano as LinhaPlano);
    // ponteiro órfão (não devia acontecer — active_plans tem FK a
    // training_plans com on delete cascade) — cai para o fallback abaixo.
  }

  const { data: plano } = await supabase
    .from("training_plans")
    .select("id, name, days, progression, owner_id, student_id")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plano) return null;
  return paraPlanoAtivo(plano as LinhaPlano);
}
