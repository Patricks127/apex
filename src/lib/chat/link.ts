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

/**
 * A ligação ativa do PT com UM aluno específico — ao contrário de
 * `linkAtivo` (que devolve só "a mais recente", sem saber escolher), esta
 * sabe exatamente qual aluno quer. Usada por /pt/aluno/[id]/chat e
 * /pt/aluno/[id]/videos.
 */
export async function linkComAluno(
  supabase: SupabaseClient,
  ptId: string,
  alunoId: string,
): Promise<LinkAtivo | null> {
  const { data } = await supabase
    .from("pt_links")
    .select("id, pt_id, student_id, scope_evolucao, scope_videos")
    .eq("pt_id", ptId)
    .eq("student_id", alunoId)
    .eq("status", "ativo")
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    pt_id: data.pt_id,
    student_id: data.student_id,
    scope_evolucao: !!data.scope_evolucao,
    scope_videos: !!data.scope_videos,
    perspetiva: "pt",
    outroId: data.student_id,
  };
}

/**
 * O `linkId` (recebido do cliente) pertence mesmo a este utilizador — como
 * aluno ou como PT — e está ativo? Usado pelas ações que recebem um
 * link_id explícito (enviarMensagem, registarMedia): NUNCA usar
 * `linkAtivo` para validar um link_id vindo do cliente — `linkAtivo`
 * devolve só "a ligação mais recente do utilizador", e um PT pode ter
 * várias ligações ativas ao mesmo tempo, uma por aluno. Comparar
 * `linkAtivo().id !== linkId` rejeitava qualquer aluno que não fosse o
 * mais recentemente ligado — era isto que impedia um PT com dois alunos
 * de enviar mensagens a um deles.
 */
export async function linkPertenceAoUtilizador(
  supabase: SupabaseClient,
  linkId: string,
  userId: string,
): Promise<LinkAtivo | null> {
  const { data } = await supabase
    .from("pt_links")
    .select("id, pt_id, student_id, scope_evolucao, scope_videos")
    .eq("id", linkId)
    .eq("status", "ativo")
    .or(`student_id.eq.${userId},pt_id.eq.${userId}`)
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

export type AlunoLigado = { id: string; nome: string };

/** Todos os alunos ligados (status ativo) a este PT — para /chat e
 *  /videos saberem se há um só (abrem-no direto) ou vários (perguntam
 *  qual) quando são abertos sem saber qual aluno. */
export async function alunosLigados(supabase: SupabaseClient, ptId: string): Promise<AlunoLigado[]> {
  const { data } = await supabase
    .from("pt_links")
    .select("aluno:profiles!student_id(id, name)")
    .eq("pt_id", ptId)
    .eq("status", "ativo")
    .overrideTypes<{ aluno: { id: string; name: string | null } | null }[]>();

  return (data ?? [])
    .filter((d): d is { aluno: { id: string; name: string | null } } => !!d.aluno?.id)
    .map((d) => ({ id: d.aluno.id, nome: d.aluno.name ?? "Atleta" }));
}
