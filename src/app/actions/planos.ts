"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoPlano = { erro?: string; ok?: boolean };

/** Arquiva um plano (define archived_at). Só o dono pode arquivar. */
export async function arquivarPlano(planId: string): Promise<EstadoPlano> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { error } = await supabase
    .from("training_plans")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("owner_id", user.id);

  if (error) return { erro: error.message };
  revalidatePath("/pt/alunos");
  return { ok: true };
}

/** Desarquiva um plano. */
export async function desarquivarPlano(planId: string): Promise<EstadoPlano> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { error } = await supabase
    .from("training_plans")
    .update({ archived_at: null })
    .eq("id", planId)
    .eq("owner_id", user.id);

  if (error) return { erro: error.message };
  revalidatePath("/pt/alunos");
  return { ok: true };
}

/** Marca/desmarca um plano como rascunho. */
export async function toggleRascunho(planId: string, valor: boolean): Promise<EstadoPlano> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { error } = await supabase
    .from("training_plans")
    .update({ is_draft: valor })
    .eq("id", planId)
    .eq("owner_id", user.id);

  if (error) return { erro: error.message };
  revalidatePath("/pt/alunos");
  return { ok: true };
}

/** Marca/desmarca um plano como modelo. */
export async function toggleModelo(planId: string, valor: boolean): Promise<EstadoPlano> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { error } = await supabase
    .from("training_plans")
    .update({ is_template: valor })
    .eq("id", planId)
    .eq("owner_id", user.id);

  if (error) return { erro: error.message };
  revalidatePath("/pt/alunos");
  return { ok: true };
}

/** Duplica um modelo como novo plano para um aluno. */
export async function duplicarModelo(
  templateId: string,
  studentId: string,
  novoNome: string,
): Promise<EstadoPlano & { planId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { data: tmpl, error: fetchErr } = await supabase
    .from("training_plans")
    .select("days, split_style")
    .eq("id", templateId)
    .eq("owner_id", user.id)
    .eq("is_template", true)
    .single();

  if (fetchErr || !tmpl) return { erro: "Modelo não encontrado." };

  const { data: novo, error: insertErr } = await supabase
    .from("training_plans")
    .insert({
      owner_id: user.id,
      student_id: studentId,
      name: novoNome,
      days: tmpl.days,
      split_style: tmpl.split_style,
      is_draft: false,
      is_template: false,
    })
    .select("id")
    .single();

  if (insertErr || !novo) return { erro: insertErr?.message ?? "Falha ao duplicar." };
  revalidatePath("/pt/alunos");
  return { ok: true, planId: novo.id };
}
