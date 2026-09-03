import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkAtivo = {
  id: string;
  pt_id: string;
  student_id: string;
  scope_evolucao: boolean;
  scope_videos: boolean;
  perspetiva: "aluno" | "pt";
  outroId: string;
};

/** A ligação PT↔aluno ATIVA do utilizador (como aluno ou como PT), ou null. */
export async function linkAtivo(
  supabase: SupabaseClient,
  userId: string,
): Promise<LinkAtivo | null> {
  const { data } = await supabase
    .from("pt_links")
    .select("id, pt_id, student_id, scope_evolucao, scope_videos")
    .or(`student_id.eq.${userId},pt_id.eq.${userId}`)
    .eq("status", "ativo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const perspetiva = data.student_id === userId ? "aluno" : "pt";
  return {
    id: data.id,
    pt_id: data.pt_id,
    student_id: data.student_id,
    scope_evolucao: !!data.scope_evolucao,
    scope_videos: !!data.scope_videos,
    perspetiva,
    outroId: perspetiva === "aluno" ? data.pt_id : data.student_id,
  };
}
