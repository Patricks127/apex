"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { linkPertenceAoUtilizador } from "@/lib/chat/link";

const BLOQUEIO_RLS =
  "Não foi possível enviar. As políticas de segurança da base de dados podem estar a bloquear esta operação.";

export type EstadoEnvio = { erro?: string; ok?: boolean };

// ---------------------------------------------------------------------------
// Mensagem de texto
// ---------------------------------------------------------------------------

export async function enviarMensagem(
  _anterior: EstadoEnvio,
  formData: FormData,
): Promise<EstadoEnvio> {
  const linkId = String(formData.get("link_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!body) return { erro: "Escreve alguma coisa." };
  if (body.length > 4000) return { erro: "Mensagem demasiado longa (máx. 4000)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const link = await linkPertenceAoUtilizador(supabase, linkId, user.id);
  if (!link) return { erro: "Não tens uma ligação ativa." };

  const { error } = await supabase.from("messages").insert({
    link_id: link.id,
    sender_id: user.id,
    body,
  });
  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/chat");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Registar uma mensagem de media (o upload já foi feito pelo browser)
// ---------------------------------------------------------------------------

export async function registarMedia(
  _anterior: EstadoEnvio,
  formData: FormData,
): Promise<EstadoEnvio> {
  const linkId = String(formData.get("link_id") ?? "");
  const mediaPath = String(formData.get("media_path") ?? "");
  const mediaKind = String(formData.get("media_kind") ?? "");
  const isEvolution = String(formData.get("is_evolution") ?? "") === "true";
  const weightRaw = String(formData.get("weight_kg") ?? "").trim();
  const measurement = String(formData.get("measurement") ?? "").trim();

  if (mediaKind !== "image" && mediaKind !== "video") {
    return { erro: "Tipo de media inválido." };
  }
  if (isEvolution && mediaKind !== "image") {
    return { erro: "As fotos de evolução têm de ser imagens." };
  }
  if (measurement.length > 120) return { erro: "Medida demasiado longa." };

  let weightKg: number | null = null;
  if (weightRaw) {
    weightKg = Number.parseFloat(weightRaw.replace(",", "."));
    if (!isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
      return { erro: "Peso fora do intervalo (20–400 kg)." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const link = await linkPertenceAoUtilizador(supabase, linkId, user.id);
  if (!link) return { erro: "Não tens uma ligação ativa." };

  // O caminho TEM de ser do próprio, na pasta certa.
  const prefixo = `${user.id}/${isEvolution ? "evolucao" : "chat"}/`;
  if (!mediaPath.startsWith(prefixo) || mediaPath.includes("..")) {
    return { erro: "Caminho de ficheiro inválido." };
  }

  const { error } = await supabase.from("messages").insert({
    link_id: link.id,
    sender_id: user.id,
    media_path: mediaPath,
    media_kind: mediaKind,
    is_evolution: isEvolution,
    weight_kg: isEvolution ? weightKg : null,
    measurement: isEvolution ? measurement || null : null,
  });
  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/chat");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Marcar como lidas as mensagens do OUTRO ao abrir o chat
// ---------------------------------------------------------------------------

export async function marcarLidas(linkId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("link_id", linkId)
    .neq("sender_id", user.id)
    .is("read_at", null);

  revalidatePath("/chat");
}

// ---------------------------------------------------------------------------
// URLs assinados para a media privada (validade 60 min). NUNCA URL público.
// ---------------------------------------------------------------------------

export async function assinarMedia(
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
