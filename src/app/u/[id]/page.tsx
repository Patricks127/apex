import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPerfilPublico, carregarPostsDoUtilizador } from "@/lib/social/feed-dados";
import { BotaoSeguir } from "@/app/descobrir/botao-seguir";
import { ListaPosts } from "../lista-posts";

export const metadata: Metadata = {
  title: "Perfil · APEX",
};

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
} as const;

export default async function PerfilAtletaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const perfil = await carregarPerfilPublico(supabase, id, user.id);
  if (!perfil) {
    return (
      <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-5 py-10">
        <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          Perfil não encontrado
        </h1>
        <Link href="/descobrir" className="apex-tipo-secundario self-start underline underline-offset-4" style={{ color: COR.tinta }}>
          Procurar pessoas
        </Link>
      </main>
    );
  }

  // Um PT tem uma página própria com currículo — esta é só para atletas.
  // Uma só URL canónica por PT em vez de duas a mostrar a mesma pessoa.
  if (perfil.role === "pt") {
    if (perfil.ptCode) redirect(`/pt/${perfil.ptCode}`);
    // PT sem pt_code (não devia acontecer — perfil.editar sempre atribui um):
    // cai para o mesmo ecrã genérico em vez de rebentar.
  }

  const meuPerfil = perfil.id === user.id;
  const posts = await carregarPostsDoUtilizador(supabase, perfil.id, user.id);

  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-5 py-8">
      <header className="apex-perfil-cabecalho">
        <div className="apex-avatar apex-avatar--grande">
          {perfil.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={perfil.avatarUrl} alt="" />
          ) : (
            <span className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.fraco }}>
              {(perfil.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="apex-tipo-titulo-ecra truncate" style={{ marginTop: 0, color: COR.tinta }}>
            {perfil.name ?? "Utilizador"}
          </h1>
          {perfil.city ? (
            <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
              {perfil.city}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <span className="apex-perfil-metrica">
            <span className="apex-tipo-titulo-seccao apex-tabular" style={{ marginTop: 0, color: COR.tinta }}>
              {perfil.seguidoresCount}
            </span>
            <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              seguidores
            </span>
          </span>
          <span className="apex-perfil-metrica">
            <span className="apex-tipo-titulo-seccao apex-tabular" style={{ marginTop: 0, color: COR.tinta }}>
              {perfil.seguindoCount}
            </span>
            <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              a seguir
            </span>
          </span>
        </div>
        {!meuPerfil ? <BotaoSeguir followingId={perfil.id} aSeguir={perfil.souEuASeguir} /> : null}
      </div>

      <section>
        <h2 className="apex-tipo-titulo-seccao" style={{ color: COR.tinta }}>
          Publicações
        </h2>
        <ListaPosts posts={posts} meId={user.id} vazioTexto="Ainda sem publicações." />
      </section>
    </main>
  );
}
