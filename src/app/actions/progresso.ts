"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LIFT_LABEL, type Lift } from "@/lib/motor";
import { METRICAS, type MetricaId } from "@/lib/treino/metricas";
import { notificar } from "@/lib/social/notificar";

const BLOQUEIO_RLS =
  "Não foi possível guardar. As políticas de segurança da base de dados podem estar a bloquear esta operação.";

export type EstadoProgresso = { erro?: string; ok?: boolean };

const LIFTS = Object.keys(LIFT_LABEL) as Lift[];

// ---------------------------------------------------------------------------
// Registo manual de um recorde pessoal (1RM testado a sério no ginásio) —
// insert-only, mesmo padrão de exercise_logs. Só os 4 levantamentos que o
// motor entende (LIFT_LABEL) — texto livre criaria dados que o resto da
// app não sabe ler.
// ---------------------------------------------------------------------------

export async function registarRecorde(
  _anterior: EstadoProgresso,
  formData: FormData,
): Promise<EstadoProgresso> {
  const lift = String(formData.get("lift") ?? "");
  const valueRaw = String(formData.get("value_kg") ?? "").trim().replace(",", ".");
  const value = Number.parseFloat(valueRaw);

  if (!LIFTS.includes(lift as Lift)) return { erro: "Levantamento inválido." };
  if (!Number.isFinite(value) || value <= 0 || value > 500) {
    return { erro: "Carga inválida (0–500 kg)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const valorFinal = Math.round(value * 10) / 10;
  const { error } = await supabase.from("personal_records").insert({
    user_id: user.id,
    lift,
    value_kg: valorFinal,
    source: "manual",
  });
  if (error) return { erro: BLOQUEIO_RLS };

  // Só recordes MANUAIS notificam — uma estimativa automática do treino
  // ao vivo não é um teste real, não merece o mesmo peso de notícia (e
  // esta ação só grava 'manual', nunca 'auto' — essa distinção fica em
  // gravarTreino/estimarRecordesDaSessao).
  await notificar(supabase, {
    userId: user.id,
    tipo: "recorde",
    titulo: "Novo recorde",
    corpo: `Novo recorde em ${LIFT_LABEL[lift as Lift]}: ${valorFinal} kg`,
  });

  revalidatePath("/progresso");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Registo manual de peso/medida corporal — insert-only. body_metrics é
// chave-valor livre na BD; o vocabulário fixo (METRICAS) é definido aqui,
// não na base de dados.
// ---------------------------------------------------------------------------

export async function registarMetrica(
  _anterior: EstadoProgresso,
  formData: FormData,
): Promise<EstadoProgresso> {
  const metric = String(formData.get("metric") ?? "");
  const valueRaw = String(formData.get("value") ?? "").trim().replace(",", ".");
  const value = Number.parseFloat(valueRaw);

  const def = METRICAS[metric as MetricaId];
  if (!def) return { erro: "Métrica inválida." };
  if (!Number.isFinite(value) || value < def.min || value > def.max) {
    return { erro: `Valor inválido (${def.min}–${def.max} ${def.unidade}).` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { error } = await supabase.from("body_metrics").insert({
    user_id: user.id,
    metric,
    value: Math.round(value * 10) / 10,
  });
  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/progresso");
  return { ok: true };
}
