import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostKind } from "./sanitizar-post.ts";

export type AutorPost = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: "atleta" | "pt";
  ptCode: string | null;
};

export type ComentarioFeed = {
  id: string;
  body: string;
  createdAt: string;
  author: AutorPost;
};

export type PostFeed = {
  id: string;
  kind: PostKind;
  body: string | null;
  workoutTitle: string | null;
  workoutSets: number | null;
  workoutVolume: number | null;
  recordLift: string | null;
  recordValue: number | null;
  mediaPath: string | null;
  mediaKind: "image" | "video" | null;
  createdAt: string;
  author: AutorPost;
  likesCount: number;
  souEuQueGostei: boolean;
  comentarios: ComentarioFeed[];
  comentariosCount: number;
};

export type Filtro = "tudo" | "seguindo" | "pts" | "meus";

type LinhaPost = {
  id: string;
  type: PostKind;
  body: string | null;
  workout_title: string | null;
  workout_sets: number | null;
  workout_volume: number | null;
  record_lift: string | null;
  record_value: number | null;
  media_path: string | null;
  media_kind: "image" | "video" | null;
  created_at: string;
  author_id: string;
  profiles: { id: string; name: string | null; avatar_url: string | null; role: "atleta" | "pt"; pt_code: string | null } | null;
};

function paraAutor(p: LinhaPost["profiles"], authorId: string): AutorPost {
  return {
    id: p?.id ?? authorId,
    name: p?.name ?? null,
    avatarUrl: p?.avatar_url ?? null,
    role: p?.role ?? "atleta",
    ptCode: p?.pt_code ?? null,
  };
}

const SELECT_POST =
  "id, type, body, workout_title, workout_sets, workout_volume, record_lift, record_value, media_path, media_kind, created_at, author_id, profiles!author_id(id, name, avatar_url, role, pt_code)";

/**
 * Lê o feed já filtrado + gostos/comentários de cada post. Uma só porta —
 * /feed usa isto, mas também /u/[id] e /pt/[codigo] para "publicações
 * deste utilizador" (filtro implícito por author_id em vez dos 4 filtros).
 */
export async function carregarFeed(
  supabase: SupabaseClient,
  userId: string,
  filtro: Filtro,
): Promise<PostFeed[]> {
  let query = supabase
    .from("posts")
    .select(SELECT_POST)
    .order("created_at", { ascending: false })
    .limit(60);

  if (filtro === "meus") {
    query = query.eq("author_id", userId);
  } else if (filtro === "seguindo") {
    const { data: seguidos } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    const ids = (seguidos ?? []).map((s) => s.following_id as string);
    if (ids.length === 0) return [];
    query = query.in("author_id", ids);
  } else if (filtro === "pts") {
    const { data: pts } = await supabase.from("profiles").select("id").eq("role", "pt");
    const ids = (pts ?? []).map((p) => p.id as string);
    if (ids.length === 0) return [];
    query = query.in("author_id", ids);
  }

  const { data: posts } = await query;
  return montarPostsComInteracoes(supabase, (posts ?? []) as unknown as LinhaPost[], userId);
}

/** Publicações de UM utilizador (perfil público) — mesma montagem do feed. */
export async function carregarPostsDoUtilizador(
  supabase: SupabaseClient,
  authorId: string,
  viewerId: string,
): Promise<PostFeed[]> {
  const { data: posts } = await supabase
    .from("posts")
    .select(SELECT_POST)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(60);
  return montarPostsComInteracoes(supabase, (posts ?? []) as unknown as LinhaPost[], viewerId);
}

async function montarPostsComInteracoes(
  supabase: SupabaseClient,
  posts: LinhaPost[],
  viewerId: string,
): Promise<PostFeed[]> {
  if (posts.length === 0) return [];
  const postIds = posts.map((p) => p.id);

  const [{ data: likes }, { data: comentarios }, { data: meusGostos }] = await Promise.all([
    supabase.from("post_likes").select("post_id").in("post_id", postIds),
    supabase
      .from("post_comments")
      .select("id, post_id, body, created_at, user_id, profiles!user_id(id, name, avatar_url, role, pt_code)")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
    supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", viewerId),
  ]);

  const likesPorPost = new Map<string, number>();
  for (const l of likes ?? []) likesPorPost.set(l.post_id, (likesPorPost.get(l.post_id) ?? 0) + 1);

  const meusGostosSet = new Set((meusGostos ?? []).map((l) => l.post_id as string));

  const comentariosPorPost = new Map<string, ComentarioFeed[]>();
  for (const c of (comentarios ?? []) as unknown as {
    id: string;
    post_id: string;
    body: string;
    created_at: string;
    user_id: string;
    profiles: LinhaPost["profiles"];
  }[]) {
    const lista = comentariosPorPost.get(c.post_id) ?? [];
    lista.push({ id: c.id, body: c.body, createdAt: c.created_at, author: paraAutor(c.profiles, c.user_id) });
    comentariosPorPost.set(c.post_id, lista);
  }

  return posts.map((p) => {
    const todosComentarios = comentariosPorPost.get(p.id) ?? [];
    return {
      id: p.id,
      kind: p.type,
      body: p.body,
      workoutTitle: p.workout_title,
      workoutSets: p.workout_sets,
      workoutVolume: p.workout_volume,
      recordLift: p.record_lift,
      recordValue: p.record_value,
      mediaPath: p.media_path,
      mediaKind: p.media_kind,
      createdAt: p.created_at,
      author: paraAutor(p.profiles, p.author_id),
      likesCount: likesPorPost.get(p.id) ?? 0,
      souEuQueGostei: meusGostosSet.has(p.id),
      comentarios: todosComentarios.slice(-3),
      comentariosCount: todosComentarios.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Fontes para o composer — só o que o próprio utilizador pode publicar.
// ---------------------------------------------------------------------------

export type FontePickerTreino = { id: string; title: string; nSets: number; volumeKg: number; performedAt: string };
export type FontePickerRecorde = { id: string; lift: string; valueKg: number; recordedAt: string };
export type FontePickerVideo = { id: string; exercise: string | null; createdAt: string };

export async function carregarFontesParaComposer(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ treinos: FontePickerTreino[]; recordes: FontePickerRecorde[]; videos: FontePickerVideo[] }> {
  const [{ data: sessoes }, { data: recordes }, { data: videos }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, title, n_sets, volume_kg, performed_at")
      .eq("user_id", userId)
      .order("performed_at", { ascending: false })
      .limit(10),
    supabase
      .from("personal_records")
      .select("id, lift, value_kg, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(10),
    supabase
      .from("training_videos")
      .select("id, exercise, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    treinos: (sessoes ?? []).map((s) => ({
      id: s.id as string,
      title: s.title as string,
      nSets: s.n_sets as number,
      volumeKg: s.volume_kg as number,
      performedAt: s.performed_at as string,
    })),
    recordes: (recordes ?? []).map((r) => ({
      id: r.id as string,
      lift: r.lift as string,
      valueKg: Number(r.value_kg),
      recordedAt: r.recorded_at as string,
    })),
    videos: (videos ?? []).map((v) => ({
      id: v.id as string,
      exercise: v.exercise as string | null,
      createdAt: v.created_at as string,
    })),
  };
}

// ---------------------------------------------------------------------------
// Perfil público (genérico — /u/[id]) e seguidores
// ---------------------------------------------------------------------------

export type PerfilPublico = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: "atleta" | "pt";
  ptCode: string | null;
  city: string | null;
  /** atleta: o objetivo (coluna headline); PT: o título do currículo */
  headline: string | null;
  bio: string | null;
  createdAt: string | null;
  seguidoresCount: number;
  seguindoCount: number;
  souEuASeguir: boolean;
};

export async function carregarPerfilPublico(
  supabase: SupabaseClient,
  targetId: string,
  viewerId: string,
): Promise<PerfilPublico | null> {
  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, name, avatar_url, role, pt_code, city, headline, bio, created_at")
    .eq("id", targetId)
    .maybeSingle();
  if (!perfil) return null;

  const [{ count: seguidoresCount }, { count: seguindoCount }, { data: jaSigo }] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId),
    supabase.from("follows").select("follower_id").eq("follower_id", viewerId).eq("following_id", targetId).maybeSingle(),
  ]);

  return {
    id: perfil.id,
    name: perfil.name,
    avatarUrl: perfil.avatar_url,
    role: perfil.role,
    ptCode: perfil.pt_code,
    city: perfil.city,
    headline: perfil.headline ?? null,
    bio: perfil.bio ?? null,
    createdAt: perfil.created_at ?? null,
    seguidoresCount: seguidoresCount ?? 0,
    seguindoCount: seguindoCount ?? 0,
    souEuASeguir: Boolean(jaSigo),
  };
}

// ---------------------------------------------------------------------------
// Descobrir — atletas e PTs por nome/cidade/especialidade
// ---------------------------------------------------------------------------

export type PessoaEncontrada = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: "atleta" | "pt";
  ptCode: string | null;
  city: string | null;
  headline: string | null;
  specialties: string[];
  isVerified: boolean;
  souEuASeguir: boolean;
};

export async function buscarPessoas(
  supabase: SupabaseClient,
  viewerId: string,
  query: string,
  especialidadesMatch: string[],
): Promise<PessoaEncontrada[]> {
  let req = supabase
    .from("profiles")
    .select("id, name, avatar_url, role, pt_code, city, headline, specialties, is_verified")
    .neq("id", viewerId)
    .order("role", { ascending: true }) // pt antes de atleta (agrupa visualmente)
    .order("name", { ascending: true })
    .limit(40);

  if (query) {
    const ors = [`name.ilike.*${query}*`, `city.ilike.*${query}*`, `headline.ilike.*${query}*`];
    if (especialidadesMatch.length) ors.push(`specialties.ov.{${especialidadesMatch.join(",")}}`);
    req = req.or(ors.join(","));
  }

  const { data: pessoas } = await req;
  if (!pessoas || pessoas.length === 0) return [];

  const { data: seguidos } = await supabase.from("follows").select("following_id").eq("follower_id", viewerId);
  const seguidosSet = new Set((seguidos ?? []).map((s) => s.following_id as string));

  return pessoas.map((p) => ({
    id: p.id as string,
    name: p.name as string | null,
    avatarUrl: p.avatar_url as string | null,
    role: p.role as "atleta" | "pt",
    ptCode: p.pt_code as string | null,
    city: p.city as string | null,
    headline: p.headline as string | null,
    specialties: (p.specialties as string[] | null) ?? [],
    isVerified: Boolean(p.is_verified),
    souEuASeguir: seguidosSet.has(p.id as string),
  }));
}
