"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prepararPost, type FontePost, type PostKind } from "@/lib/social/sanitizar-post";
import { extensaoDe, idFicheiro } from "@/lib/chat/media";
import { notificar } from "@/lib/social/notificar";

const BLOQUEIO_RLS =
  "Não foi possível guardar. As políticas de segurança da base de dados podem estar a bloquear esta operação.";

export type EstadoSocial = { erro?: string; ok?: boolean };

const KINDS: PostKind[] = ["treino", "recorde", "conquista", "video", "texto"];

// ---------------------------------------------------------------------------
// Publicar — o composer nunca envia o payload, só kind + source_id (para
// treino/recorde/video) + body. A fonte é sempre relida do lado do servidor
// e a posse confirmada em prepararPost antes de sanitizar. Ver
// src/lib/social/sanitizar-post.ts para a garantia completa.
// ---------------------------------------------------------------------------

export async function criarPost(
  _anterior: EstadoSocial,
  formData: FormData,
): Promise<EstadoSocial> {
  const kind = String(formData.get("kind") ?? "");
  const body = String(formData.get("body") ?? "");
  const sourceId = String(formData.get("source_id") ?? "").trim();

  if (!KINDS.includes(kind as PostKind)) return { erro: "Tipo de publicação inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  let fonte: FontePost | null = null;

  if (kind === "treino") {
    if (!sourceId) return { erro: "Escolhe um treino." };
    const { data } = await supabase
      .from("workout_sessions")
      .select("user_id, title, n_sets, volume_kg")
      .eq("id", sourceId)
      .maybeSingle();
    fonte = data
      ? {
          kind: "treino",
          authorId: data.user_id,
          sessao: {
            title: data.title,
            nSets: data.n_sets,
            volumeKg: data.volume_kg,
          },
        }
      : null;
  } else if (kind === "recorde") {
    if (!sourceId) return { erro: "Escolhe um recorde." };
    const { data } = await supabase
      .from("personal_records")
      .select("user_id, lift, value_kg")
      .eq("id", sourceId)
      .maybeSingle();
    fonte = data
      ? {
          kind: "recorde",
          authorId: data.user_id,
          recorde: {
            lift: data.lift,
            valueKg: Number(data.value_kg),
          },
        }
      : null;
  } else if (kind === "video") {
    if (!sourceId) return { erro: "Escolhe um vídeo." };
    const { data } = await supabase
      .from("training_videos")
      .select("user_id, storage_path")
      .eq("id", sourceId)
      .maybeSingle();
    if (!data) return { erro: "Vídeo não encontrado." };
    // Verificação explícita ANTES de sequer tocar no storage — o vídeo
    // original vive em private-media/{uid}/videos/..., o MESMO sítio dos
    // vídeos de execução privados que o PT comenta. Um PT com
    // scope_videos consegue LER essa linha (RLS legítima para
    // acompanhamento) — isso nunca pode virar "copiar o vídeo do aluno
    // para uma publicação pública". Sem esta verificação, o próximo
    // passo (download) teria sucesso para um PT ligado, e o vídeo
    // privado do aluno acabaria num post que não é dele.
    if (data.user_id !== user.id) return { erro: "Só podes publicar vídeos teus." };

    // Nunca aponta o post para private-media — copia-se para post-media
    // (bucket público, separado) e o post referencia só a cópia. O
    // original fica privado, sempre; publicar é um ato deliberado que
    // cria uma cópia, tal como o post de treino copia os números da
    // sessão em vez de a referenciar.
    const { data: ficheiro, error: erroDownload } = await supabase.storage
      .from("private-media")
      .download(data.storage_path);
    if (erroDownload || !ficheiro) return { erro: "Não foi possível preparar o vídeo para publicar." };

    const extensao = extensaoDe(ficheiro.type || "video/mp4");
    const novoPath = `${user.id}/${idFicheiro()}.${extensao}`;
    const { error: erroUpload } = await supabase.storage
      .from("post-media")
      .upload(novoPath, ficheiro, { contentType: ficheiro.type || "video/mp4" });
    if (erroUpload) return { erro: "Não foi possível publicar o vídeo." };

    fonte = {
      kind: "video",
      authorId: data.user_id,
      video: { storagePath: novoPath },
    };
  } else {
    // conquista | texto — sem fonte externa, é só o texto escrito na hora.
    fonte = { kind: kind as "conquista" | "texto", texto: body };
  }

  const resultado = prepararPost(fonte, user.id, body);
  if ("erro" in resultado) return { erro: resultado.erro };

  // workout_rpe nunca aparece aqui — nem sequer existe em ColunasPost
  // (ver sanitizar-post.ts). A coluna fica sempre null pela omissão.
  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    type: resultado.kind,
    body: resultado.body,
    workout_title: resultado.workoutTitle,
    workout_sets: resultado.workoutSets,
    workout_volume: resultado.workoutVolume,
    record_lift: resultado.recordLift,
    record_value: resultado.recordValue,
    media_path: resultado.mediaPath,
    media_kind: resultado.mediaKind,
  });
  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/feed");
  return { ok: true };
}

export async function apagarPost(formData: FormData): Promise<EstadoSocial> {
  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return { erro: "Publicação inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  // RLS já restringe a apagar só a própria (author_id = auth.uid()), mas o
  // filtro aqui também evita um DELETE "silencioso" (0 linhas) confuso.
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", user.id);
  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/feed");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Gostos — alterna, decidido pelo estado real na BD (não pelo que o
// cliente diz que já viu), para não desalinhar em caso de corrida.
// ---------------------------------------------------------------------------

export async function alternarGosto(formData: FormData): Promise<EstadoSocial> {
  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return { erro: "Publicação inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  // Sem coluna `id` (chave primária composta post_id+user_id) — a
  // existência e o apagar usam sempre as duas colunas da chave, nunca um
  // id substituto.
  const { data: existente } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { erro: BLOQUEIO_RLS };
  } else {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    if (error) return { erro: BLOQUEIO_RLS };

    // Notifica só ao CRIAR o gosto, nunca ao tirar. Nunca a mim próprio
    // (a policy de notifications já bloqueia, mas evita a tentativa).
    const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).single();
    if (post && post.author_id !== user.id) {
      const { data: quemGostou } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      await notificar(supabase, {
        userId: post.author_id,
        tipo: "gosto",
        titulo: "Novo gosto",
        corpo: `${quemGostou?.name ?? "Alguém"} gostou da tua publicação`,
        refId: postId,
      });
    }
  }

  revalidatePath("/feed");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

export async function comentar(_anterior: EstadoSocial, formData: FormData): Promise<EstadoSocial> {
  const postId = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!postId) return { erro: "Publicação inválida." };
  if (!body) return { erro: "Escreve um comentário." };
  if (body.length > 500) return { erro: "Comentário demasiado longo (máx. 500)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, body });
  if (error) return { erro: BLOQUEIO_RLS };

  const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).single();
  if (post && post.author_id !== user.id) {
    const { data: quemComentou } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    await notificar(supabase, {
      userId: post.author_id,
      tipo: "comentario",
      titulo: "Novo comentário",
      corpo: `${quemComentou?.name ?? "Alguém"} comentou a tua publicação`,
      refId: postId,
    });
  }

  revalidatePath("/feed");
  return { ok: true };
}

export async function apagarComentario(formData: FormData): Promise<EstadoSocial> {
  const commentId = String(formData.get("comment_id") ?? "");
  if (!commentId) return { erro: "Comentário inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { error } = await supabase.from("post_comments").delete().eq("id", commentId).eq("user_id", user.id);
  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/feed");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Seguir
// ---------------------------------------------------------------------------

export async function seguir(formData: FormData): Promise<EstadoSocial> {
  const followingId = String(formData.get("following_id") ?? "");
  if (!followingId) return { erro: "Utilizador inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };
  if (followingId === user.id) return { erro: "Não podes seguir-te a ti próprio." };

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: followingId });
  // 23505 = já seguias (chave primária composta) — não é erro do ponto de vista do utilizador.
  if (error && error.code !== "23505") return { erro: BLOQUEIO_RLS };

  revalidatePath("/feed");
  revalidatePath("/descobrir");
  return { ok: true };
}

export async function deixarDeSeguir(formData: FormData): Promise<EstadoSocial> {
  const followingId = String(formData.get("following_id") ?? "");
  if (!followingId) return { erro: "Utilizador inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);
  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/feed");
  revalidatePath("/descobrir");
  return { ok: true };
}
