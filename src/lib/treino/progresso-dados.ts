import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lift } from "../motor/index.ts";
import { LIFT_LABEL } from "../motor/index.ts";
import { METRICAS, type MetricaId } from "./metricas.ts";

const LIFTS = Object.keys(LIFT_LABEL) as Lift[];
const METRICA_IDS = Object.keys(METRICAS) as MetricaId[];

export type RecordePessoal = {
  id: string;
  lift: Lift;
  valueKg: number;
  source: "manual" | "auto";
  recordedAt: string;
};

export type { MetricaId };

export type MetricaCorporal = {
  id: string;
  metric: MetricaId;
  value: number;
  recordedAt: string;
};

export type SessaoHistorico = {
  id: string;
  title: string;
  performedAt: string;
  nSets: number;
  volumeKg: number;
  avgRpe: number | null;
  completion: number | null;
  weekNumber: number | null;
  isDeload: boolean;
  checkin: { discomfortZones: string[]; effort: string | null; note: string | null } | null;
};

/**
 * Lê tudo o que /progresso precisa: recordes pessoais, peso/medidas e
 * histórico de sessões (com check-in). Uma só porta — evita três ecrãs a
 * decidir de formas diferentes o que é "um levantamento válido" ou "uma
 * métrica conhecida" (linhas com `lift`/`metric` fora do vocabulário
 * conhecido são descartadas aqui, não propagadas para o gráfico).
 */
export async function carregarProgresso(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  recordes: RecordePessoal[];
  metricas: MetricaCorporal[];
  sessoes: SessaoHistorico[];
}> {
  const [{ data: prs }, { data: metricas }, { data: sessoes }, { data: checkins }] = await Promise.all([
    supabase
      .from("personal_records")
      .select("id, lift, value_kg, source, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: true }),
    supabase
      .from("body_metrics")
      .select("id, metric, value, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: true }),
    supabase
      .from("workout_sessions")
      .select("id, title, performed_at, n_sets, volume_kg, avg_rpe, completion, week_number, is_deload")
      .eq("user_id", userId)
      .order("performed_at", { ascending: false })
      .limit(200),
    supabase
      .from("workout_checkins")
      .select("session_id, discomfort_zones, effort, note")
      .eq("user_id", userId),
  ]);

  const checkinPorSessao = new Map(
    (checkins ?? []).map((c) => [
      c.session_id as string,
      {
        discomfortZones: (c.discomfort_zones ?? []) as string[],
        effort: c.effort as string | null,
        note: c.note as string | null,
      },
    ]),
  );

  return {
    recordes: (prs ?? [])
      .filter((p) => LIFTS.includes(p.lift as Lift))
      .map((p) => ({
        id: p.id as string,
        lift: p.lift as Lift,
        valueKg: Number(p.value_kg),
        source: p.source === "auto" ? "auto" : "manual",
        recordedAt: p.recorded_at as string,
      })),
    metricas: (metricas ?? [])
      .filter((m) => METRICA_IDS.includes(m.metric as MetricaId))
      .map((m) => ({
        id: m.id as string,
        metric: m.metric as MetricaId,
        value: Number(m.value),
        recordedAt: m.recorded_at as string,
      })),
    sessoes: (sessoes ?? []).map((s) => ({
      id: s.id as string,
      title: s.title as string,
      performedAt: s.performed_at as string,
      nSets: s.n_sets as number,
      volumeKg: s.volume_kg as number,
      avgRpe: s.avg_rpe as number | null,
      completion: s.completion as number | null,
      weekNumber: s.week_number as number | null,
      isDeload: Boolean(s.is_deload),
      checkin: checkinPorSessao.get(s.id as string) ?? null,
    })),
  };
}
