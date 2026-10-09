"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { linkPertenceAoUtilizador } from "@/lib/chat/link";
import { notificar } from "@/lib/social/notificar";
import { lerDecimal } from "@/lib/formato";

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

  const { data: remetente } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  await notificar(supabase, {
    userId: link.outroId,
    tipo: "mensagem",
    titulo: "Nova mensagem",
    corpo: `${remetente?.name ?? "Alguém"} enviou-te uma mensagem`,
    refId: link.id,
  });

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
    weightKg = lerDecimal(weightRaw);
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
  if (isEvolution && link.perspetiva !== "aluno") {
    return { erro: "As fotos de evolução são enviadas pelo atleta." };
  }

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

// ---------------------------------------------------------------------------
// Análise IA de uma foto de evolução (PT-only, com cache na BD)
// ---------------------------------------------------------------------------

export async function analisarFotoEvolucao(
  messageId: string,
): Promise<{ ok?: boolean; texto?: string; erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { data: msg } = await supabase
    .from("messages")
    .select("id, media_path, media_kind, is_evolution, link_id, ai_analysis")
    .eq("id", messageId)
    .single();

  if (!msg) return { erro: "Mensagem não encontrada." };
  if (!msg.is_evolution || msg.media_kind !== "image" || !msg.media_path) {
    return { erro: "Só é possível analisar fotos de evolução." };
  }

  const link = await linkPertenceAoUtilizador(supabase, msg.link_id, user.id);
  if (!link) return { erro: "Sem acesso a esta ligação." };

  const { data: ptLink } = await supabase
    .from("pt_links")
    .select("id")
    .eq("id", msg.link_id)
    .eq("pt_id", user.id)
    .eq("status", "ativo")
    .maybeSingle();
  if (!ptLink) return { erro: "Só o Personal Trainer pode pedir a análise." };

  if (msg.ai_analysis) return { ok: true, texto: msg.ai_analysis };

  const { data: blob, error: dlErr } = await supabase.storage
    .from("private-media")
    .download(msg.media_path);
  if (dlErr || !blob) return { erro: "Não foi possível obter a foto." };

  const buffer = Buffer.from(await blob.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mediaType = (blob.type || "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { erro: "ANTHROPIC_API_KEY não configurada no servidor." };

  let textoAnalise: string;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: "Analisa esta foto de progresso físico de forma objetiva e profissional. Descreve em 2-4 frases o que observas: postura, composição corporal visível, simetria e qualquer detalhe relevante para acompanhamento de treino. Responde em português europeu, sem julgamentos subjetivos.",
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const erro = await resp.text();
      console.error("[analisarFotoEvolucao] Anthropic API erro:", resp.status, erro);
      return { erro: "Falha na análise (API IA)." };
    }

    const json = (await resp.json()) as {
      content: { type: string; text?: string }[];
    };
    textoAnalise =
      json.content.find((c) => c.type === "text")?.text ?? "Sem resposta da IA.";
  } catch (e) {
    console.error("[analisarFotoEvolucao] fetch error:", e);
    return { erro: "Erro de rede ao contactar a IA." };
  }

  const { error: updateErr } = await supabase
    .from("messages")
    .update({ ai_analysis: textoAnalise })
    .eq("id", messageId);
  if (updateErr) {
    console.error("[analisarFotoEvolucao] erro ao guardar cache:", updateErr.message);
  }

  return { ok: true, texto: textoAnalise };
}

// ---------------------------------------------------------------------------
// Análise comparativa de duas fotos de evolução consecutivas (PT-only)
// ---------------------------------------------------------------------------

export async function compararFotosEvolucao(
  msgIdAnterior: string,
  msgIdAtual: string,
): Promise<{ ok?: boolean; texto?: string; erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, media_path, media_kind, is_evolution, link_id, ai_analysis, created_at")
    .in("id", [msgIdAnterior, msgIdAtual]);

  if (!msgs || msgs.length !== 2) return { erro: "Fotos não encontradas." };
  const [m1, m2] = msgs.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (!m1.is_evolution || !m2.is_evolution) return { erro: "Só fotos de evolução." };
  if (m1.link_id !== m2.link_id) return { erro: "Fotos de ligações diferentes." };

  const { data: ptLink } = await supabase
    .from("pt_links")
    .select("id")
    .eq("id", m1.link_id)
    .eq("pt_id", user.id)
    .eq("status", "ativo")
    .maybeSingle();
  if (!ptLink) return { erro: "Só o Personal Trainer pode pedir comparações." };

  if (!m1.ai_analysis || !m2.ai_analysis) {
    return { erro: "Analisa primeiro cada foto individualmente antes de comparar." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { erro: "ANTHROPIC_API_KEY não configurada." };

  const [res1, res2] = await Promise.all([
    supabase.storage.from("private-media").download(m1.media_path!),
    supabase.storage.from("private-media").download(m2.media_path!),
  ]);
  if (res1.error || !res1.data || res2.error || !res2.data) {
    return { erro: "Não foi possível obter as fotos para comparação." };
  }

  const [buf1, buf2] = await Promise.all([
    res1.data.arrayBuffer(),
    res2.data.arrayBuffer(),
  ]);
  const b64_1 = Buffer.from(buf1).toString("base64");
  const b64_2 = Buffer.from(buf2).toString("base64");
  const mt = "image/jpeg" as const;

  let textoComparacao: string;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mt, data: b64_1 } },
              { type: "image", source: { type: "base64", media_type: mt, data: b64_2 } },
              {
                type: "text",
                text: "Compara estas duas fotos de progresso físico (a primeira é a mais antiga, a segunda é a mais recente). Identifica objetivamente as diferenças visíveis: composição corporal, definição muscular, postura e quaisquer melhorias ou alterações. Responde em 3-5 frases em português europeu.",
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) return { erro: "Falha na comparação (API IA)." };
    const json = (await resp.json()) as {
      content: { type: string; text?: string }[];
    };
    textoComparacao =
      json.content.find((c) => c.type === "text")?.text ?? "Sem resposta da IA.";
  } catch {
    return { erro: "Erro de rede ao contactar a IA." };
  }

  return { ok: true, texto: textoComparacao };
}
