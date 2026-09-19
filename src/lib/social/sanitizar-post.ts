/* ============================================================
   Garantia de isolamento privado→público da rede social (PASSO 8).

   A tabela `posts` (existente desde antes desta fase — "migração 001")
   usa COLUNAS NOMEADAS por tipo (workout_title, workout_sets,
   workout_volume, record_lift, record_value, media_path, media_kind) em
   vez de um payload jsonb livre. Isto é mais forte do que sanitizar em
   código: é estruturalmente impossível gravar checkin/discomfort_zones/
   weight_kg/measurement num post, porque essas colunas não existem na
   tabela. `ColunasPost` (abaixo) espelha isso no lado do TypeScript —
   nem sequer TEM um campo `workoutRpe` (a única coluna sensível que a
   tabela ainda tem), por isso nenhum código consegue popular esse campo
   por engano só por passar pelo tipo errado.

   Arquitetura, mais forte do que "sanitizar o que o cliente manda": o
   composer NUNCA envia colunas — só um `source_id`. A Server Action
   (criarPost, actions/social.ts) busca essa linha do lado do SERVIDOR e
   chama `prepararPost`, que:

     1. Confirma que a fonte pertence a quem publica (`authorId ===
        authUserId`) — mesmo que a RLS da tabela de origem deixe um PT
        LIGADO ler a linha de um aluno (scope_treinos/scope_videos), isso
        nunca pode virar "o PT publica o treino do aluno como seu".
     2. Chama `sanitizePost`, que constrói as colunas a partir de campos
        EXPLICITAMENTE escolhidos (nunca um spread do objeto rico).

   Testado exaustivamente em sanitizar-post.test.ts, incluindo a
   comparação com uma versão INGÉNUA para provar que o teste falha sem a
   proteção — não é uma asserção vazia.
   ============================================================ */

import type { Lift } from "../motor/index.ts";

export type PostKind = "treino" | "recorde" | "conquista" | "video" | "imagem" | "texto";

/** Sessão tal como a BD a devolve — inclui campos que NUNCA podem chegar
 *  a um post (avgRpe, completion, checkin). `title`/`nSets`/`volumeKg`
 *  são os únicos com coluna correspondente em `posts`. */
export type SessaoParaPost = {
  title: string;
  nSets: number;
  volumeKg: number;
  avgRpe?: number | null;
  completion?: number | null;
  checkin?: {
    discomfortZones: string[];
    effort: string | null;
    note: string | null;
  } | null;
};

export type RecordeParaPost = {
  lift: Lift;
  valueKg: number;
};

/** Vídeo tal como a BD o devolve — `feedback` (comentários do PT) nunca
 *  pode chegar a um post; nem sequer há coluna para o guardar. */
export type VideoParaPost = {
  storagePath: string;
  feedback?: { body: string }[];
};

/** Imagem anexada NA HORA (upload direto do composer) — ao contrário de
 *  vídeo, que copia de um `training_videos` privado já existente, aqui
 *  não há fonte privada nenhuma para verificar posse: o storagePath já
 *  vem de um upload feito pelo PRÓPRIO autor, para post-media (bucket
 *  público), dentro da Server Action (ver actions/social.ts) — nunca
 *  lido de private-media. */
export type ImagemParaPost = { storagePath: string };

export type FontePost =
  | { kind: "treino"; authorId: string; sessao: SessaoParaPost }
  | { kind: "recorde"; authorId: string; recorde: RecordeParaPost }
  | { kind: "video"; authorId: string; video: VideoParaPost }
  | { kind: "imagem"; authorId: string; imagem: ImagemParaPost }
  | { kind: "conquista"; texto: string }
  | { kind: "texto"; texto: string };

/**
 * As colunas de `posts` que a Server Action pode escrever. Note a
 * ausência DELIBERADA de `workoutRpe` — a única coluna sensível que a
 * tabela ainda tem — para que nenhum código consiga popular esse campo
 * só por passar pelo tipo errado; é sempre gravado como null pela query
 * de insert em criarPost, nunca lido daqui.
 */
export type ColunasPost = {
  body: string | null;
  workoutTitle: string | null;
  workoutSets: number | null;
  workoutVolume: number | null;
  recordLift: string | null;
  recordValue: number | null;
  mediaPath: string | null;
  mediaKind: "image" | "video" | null;
};

const MAX_BODY = 2000;

// Rede de segurança adicional (o tipo ColunasPost já impede isto em tempo
// de compilação) — se algum dia uma chave destas aparecer no resultado,
// alguém contornou o tipo (ex.: via `as any`) e é melhor rebentar aqui.
const CHAVES_PROIBIDAS = new Set([
  "workoutRpe",
  "workout_rpe",
  "avgRpe",
  "avg_rpe",
  "completion",
  "checkin",
  "rpe",
  "discomfortZones",
  "discomfort_zones",
  "effort",
  "note",
  "feedback",
  "weightKg",
  "weight_kg",
  "measurement",
]);

function colunasVazias(body: string | null): ColunasPost {
  return {
    body,
    workoutTitle: null,
    workoutSets: null,
    workoutVolume: null,
    recordLift: null,
    recordValue: null,
    mediaPath: null,
    mediaKind: null,
  };
}

/**
 * Constrói as colunas publicáveis a partir de campos EXPLICITAMENTE
 * escolhidos (nunca um spread do objeto de origem).
 */
export function sanitizePost(fonte: FontePost, bodyBruto: string): ColunasPost | { erro: string } {
  const bodyAparado = bodyBruto.trim().slice(0, MAX_BODY);
  const body = bodyAparado || null;

  let colunas: ColunasPost;
  switch (fonte.kind) {
    case "conquista":
    case "texto":
      if (!body) return { erro: "Escreve algo antes de publicar." };
      colunas = colunasVazias(body);
      break;
    case "treino": {
      const { title, nSets, volumeKg } = fonte.sessao;
      colunas = { ...colunasVazias(body), workoutTitle: title, workoutSets: nSets, workoutVolume: volumeKg };
      break;
    }
    case "recorde": {
      const { lift, valueKg } = fonte.recorde;
      colunas = { ...colunasVazias(body), recordLift: lift, recordValue: valueKg };
      break;
    }
    case "video": {
      const { storagePath } = fonte.video;
      colunas = { ...colunasVazias(body), mediaPath: storagePath, mediaKind: "video" };
      break;
    }
    case "imagem": {
      const { storagePath } = fonte.imagem;
      colunas = { ...colunasVazias(body), mediaPath: storagePath, mediaKind: "image" };
      break;
    }
  }

  for (const chave of Object.keys(colunas)) {
    if (CHAVES_PROIBIDAS.has(chave)) {
      // Nunca deve acontecer — ColunasPost nem sequer tem estas chaves no
      // tipo. Só dispara se alguém contornou o tipo com `as any`.
      throw new Error("sanitizePost: coluna proibida no resultado — isto nunca deve acontecer");
    }
  }

  return colunas;
}

/**
 * Porta única chamada pela Server Action: confirma que a fonte pertence a
 * quem publica ANTES de sanitizar. `fonte` vem já lida da BD do lado do
 * servidor (nunca do cliente) — `null` quando o source_id não existe ou a
 * RLS não deixou ler (tratado da mesma forma: "não encontrado").
 */
export function prepararPost(
  fonte: FontePost | null,
  authUserId: string,
  bodyBruto: string,
): (ColunasPost & { kind: PostKind }) | { erro: string } {
  if (!fonte) return { erro: "Não encontrado." };
  if ("authorId" in fonte && fonte.authorId !== authUserId) {
    return { erro: "Só podes publicar coisas tuas." };
  }
  const resultado = sanitizePost(fonte, bodyBruto);
  if ("erro" in resultado) return resultado;
  return { kind: fonte.kind, ...resultado };
}
