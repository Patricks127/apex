"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { linkAtivo } from "@/lib/chat/link";

const BLOQUEIO_RLS =
  "Não foi possível guardar. As políticas de segurança da base de dados podem estar a bloquear esta operação.";

export type EstadoVideo = { erro?: string; ok?: boolean };

// ---------------------------------------------------------------------------
// Aluno regista um vídeo (o upload já foi feito pelo browser)
// ---------------------------------------------------------------------------

export async function registarVideo(
  _anterior: EstadoVideo,
  formData: FormData,
): Promise<EstadoVideo> {
  const storagePath = String(formData.get("storage_path") ?? "");
  const exercise = String(formData.get("exercise") ?? "").trim();

  if (!exercise) return { erro: "Diz qual é o exercício." };
  if (exercise.length > 80) return { erro: "Nome do exercício demasiado longo." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  // O caminho tem de ser do próprio, na pasta certa.
  const prefixo = `${user.id}/videos/`;
  if (!storagePath.startsWith(prefixo) || storagePath.includes("..")) {
    return { erro: "Caminho de ficheiro inválido." };
  }

  const { error } = await supabase.from("training_videos").insert({
    user_id: user.id,
    storage_path: storagePath,
    exercise,
  });
  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/videos");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// PT escreve feedback num vídeo
// ---------------------------------------------------------------------------

export async function enviarFeedback(
  _anterior: EstadoVideo,
  formData: FormData,
): Promise<EstadoVideo> {
  const videoId = String(formData.get("video_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!body) return { erro: "Escreve o feedback." };
  if (body.length > 2000) return { erro: "Feedback demasiado longo (máx. 2000)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const link = await linkAtivo(supabase, user.id);
  if (!link || link.perspetiva !== "pt") {
    return { erro: "Só o PT ligado pode deixar feedback." };
  }

  // A RLS exige scope_videos + que o vídeo seja de um aluno ligado.
  const { error } = await supabase.from("video_feedback").insert({
    video_id: videoId,
    pt_id: user.id,
    body,
  });
  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/videos");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// URLs assinados para os vídeos (validade 60 min). NUNCA URL público.
// ---------------------------------------------------------------------------

export async function assinarVideos(
  paths: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  const limpos = [...new Set(paths.filter((p) => typeof p === "string" && p.length > 0))];
  if (limpos.length === 0) return out;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    for (const p of limpos) out[p] = null;
    return out;
  }

  const { data } = await supabase.storage
    .from("private-media")
    .createSignedUrls(limpos, 60 * 60);

  for (const p of limpos) out[p] = null;
  for (const item of data ?? []) {
    if (item.path && !item.error && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
