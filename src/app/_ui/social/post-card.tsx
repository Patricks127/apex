"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { LIFT_LABEL, type Lift } from "@/lib/motor";
import {
  apagarPost,
  alternarGosto,
  comentar,
  apagarComentario,
  type EstadoSocial,
} from "@/app/actions/social";
import type { PostFeed } from "@/lib/social/feed-dados";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
  erro: "var(--apex-erro)",
} as const;

const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const publicUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-media/${path}`;

function iniciais(name: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function linkAutor(author: PostFeed["author"]): string {
  return author.role === "pt" && author.ptCode ? `/pt/${author.ptCode}` : `/u/${author.id}`;
}

export function PostCard({ post, meId, aoMudar }: { post: PostFeed; meId: string; aoMudar: () => void }) {
  const [mostrarComentar, setMostrarComentar] = useState(false);
  const souAutor = post.author.id === meId;

  async function apagar() {
    const fd = new FormData();
    fd.set("post_id", post.id);
    await apagarPost(fd);
    aoMudar();
  }

  async function gostar() {
    const fd = new FormData();
    fd.set("post_id", post.id);
    await alternarGosto(fd);
    aoMudar();
  }

  return (
    <article className="apex-post">
      <div className="apex-post__cabecalho">
        <Link href={linkAutor(post.author)} className="apex-avatar">
          {post.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author.avatarUrl} alt="" />
          ) : (
            <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              {iniciais(post.author.name)}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={linkAutor(post.author)}
            className="apex-tipo-nome-exercicio"
            style={{ color: COR.tinta, textDecoration: "none" }}
          >
            {post.author.name ?? "Utilizador"}
            {post.author.role === "pt" ? (
              <span className="apex-chip-neutro apex-tipo-etiqueta" style={{ marginLeft: 6 }}>
                PT
              </span>
            ) : null}
          </Link>
          <p className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
            {dataLonga(post.createdAt)}
          </p>
        </div>
        {souAutor ? (
          <button type="button" onClick={apagar} className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Apagar
          </button>
        ) : null}
      </div>

      <ConteudoPost post={post} />

      <div className="apex-post__acoes">
        <button type="button" onClick={gostar} className="apex-post__acao" data-ativa={post.souEuQueGostei}>
          {post.souEuQueGostei ? "Gostei" : "Gostar"} {post.likesCount > 0 ? `· ${post.likesCount}` : ""}
        </button>
        <button type="button" onClick={() => setMostrarComentar((v) => !v)} className="apex-post__acao">
          Comentar {post.comentariosCount > 0 ? `· ${post.comentariosCount}` : ""}
        </button>
      </div>

      {post.comentarios.length > 0 ? (
        <div className="flex flex-col gap-2">
          {post.comentarios.map((c) => (
            <ComentarioLinha key={c.id} comentario={c} meId={meId} aoMudar={aoMudar} />
          ))}
        </div>
      ) : null}

      {mostrarComentar ? <FormComentar postId={post.id} aoComentado={aoMudar} /> : null}
    </article>
  );
}

function ConteudoPost({ post }: { post: PostFeed }) {
  return (
    <div className="flex flex-col gap-2">
      {post.kind === "treino" ? (
        <div className="apex-post__estruturado">
          <p className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
            {post.workoutTitle}
          </p>
          <p className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
            {post.workoutSets} séries · {Math.round(post.workoutVolume ?? 0)} kg de volume
          </p>
        </div>
      ) : post.kind === "recorde" ? (
        <div className="apex-post__estruturado">
          <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Novo recorde
          </p>
          <p className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: "var(--apex-azul)" }}>
            {LIFT_LABEL[post.recordLift as Lift] ?? post.recordLift} — {post.recordValue} kg
          </p>
        </div>
      ) : post.kind === "video" && post.mediaPath ? (
        <div className="apex-post__estruturado">
          <video src={publicUrl(post.mediaPath)} controls />
        </div>
      ) : post.kind === "imagem" && post.mediaPath ? (
        <div className="apex-post__estruturado">
          {/* eslint-disable-next-line @next/next/no-img-element -- post-media é público, sem otimização própria do Next necessária aqui (mesmo padrão de avatar/evolução no resto da app) */}
          <img src={publicUrl(post.mediaPath)} alt="" />
        </div>
      ) : null}

      {post.body ? (
        <p className="apex-tipo-corpo whitespace-pre-wrap break-words" style={{ color: COR.tinta }}>
          {post.body}
        </p>
      ) : null}
    </div>
  );
}

function ComentarioLinha({
  comentario,
  meId,
  aoMudar,
}: {
  comentario: PostFeed["comentarios"][number];
  meId: string;
  aoMudar: () => void;
}) {
  async function apagar() {
    const fd = new FormData();
    fd.set("comment_id", comentario.id);
    await apagarComentario(fd);
    aoMudar();
  }

  return (
    <div className="apex-comentario">
      <Link href={linkAutor(comentario.author)} className="apex-avatar apex-avatar--pequeno">
        {comentario.author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comentario.author.avatarUrl} alt="" />
        ) : (
          <span className="apex-tipo-etiqueta" style={{ color: COR.fraco, fontSize: 10 }}>
            {iniciais(comentario.author.name)}
          </span>
        )}
      </Link>
      <div className="apex-comentario__corpo">
        <p className="apex-tipo-etiqueta" style={{ color: COR.tinta }}>
          {comentario.author.name ?? "Utilizador"}
        </p>
        <p className="apex-tipo-corpo whitespace-pre-wrap break-words" style={{ color: COR.tinta }}>
          {comentario.body}
        </p>
        {comentario.author.id === meId ? (
          <button type="button" onClick={apagar} className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Apagar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FormComentar({ postId, aoComentado }: { postId: string; aoComentado: () => void }) {
  const [estado, submeter, aEnviar] = useActionState<EstadoSocial, FormData>(comentar, {});

  return (
    <form
      action={(fd) => {
        submeter(fd);
        aoComentado();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="post_id" value={postId} />
      <textarea
        name="body"
        rows={2}
        maxLength={500}
        placeholder="Escreve um comentário…"
        className="apex-tipo-corpo resize-none border px-3 py-2 outline-none"
        style={{ borderColor: COR.linha, borderRadius: 2, background: "transparent", color: COR.tinta }}
      />
      {estado.erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
          {estado.erro}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={aEnviar}
        className="apex-botao apex-botao--claro self-start"
        style={{ width: "auto", padding: "8px 16px" }}
      >
        {aEnviar ? "A enviar…" : "Comentar"}
      </button>
    </form>
  );
}
