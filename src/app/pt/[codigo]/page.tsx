import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { labelEspecialidade, labelServico } from "@/lib/perfil";
import { carregarPerfilPublico, carregarPostsDoUtilizador } from "@/lib/social/feed-dados";
import { BotaoSeguir } from "@/app/descobrir/botao-seguir";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { ListaPosts } from "@/app/u/lista-posts";

export const metadata: Metadata = {
  title: "Perfil de PT · APEX",
};

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
  azul: "var(--apex-azul)",
  azulFundo: "var(--apex-azul-fundo)",
} as const;

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const code = decodeURIComponent(codigo).toUpperCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: pt } = await supabase
    .from("profiles")
    .select(
      "id, name, avatar_url, headline, bio, city, experience, specialties, certs, services, price, gym, instagram, show_contacts, pt_code, is_verified, role",
    )
    .eq("pt_code", code)
    .eq("role", "pt")
    .maybeSingle();

  if (!pt) {
    return (
      <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-5 py-10">
        <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          PT não encontrado
        </h1>
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Não há nenhum personal trainer com o código {code}.
        </p>
        <Link href="/descobrir" className="apex-tipo-secundario mt-2 self-start underline underline-offset-4" style={{ color: COR.tinta }}>
          Procurar PTs
        </Link>
      </main>
    );
  }

  const meuPerfil = pt.id === user.id;

  // Contactos: tabela contactos_pt (migração 024) — a RLS só os devolve ao
  // próprio PT, a todos se show_contacts='todos', ou a alunos ATIVOS. A
  // condição mostrarContactos abaixo fica como segunda barreira (e para a
  // mensagem "só mostra aos alunos").
  const [{ data: link }, { data: meuPerfilRow }, perfilPublico, posts, { data: contactos }] = await Promise.all([
    supabase.from("pt_links").select("status").eq("pt_id", pt.id).eq("student_id", user.id).in("status", ["ativo", "pendente"]).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    carregarPerfilPublico(supabase, pt.id, user.id),
    carregarPostsDoUtilizador(supabase, pt.id, user.id),
    supabase.from("contactos_pt").select("contact_phone, contact_email").eq("id", pt.id).maybeSingle(),
  ]);
  const contactPhone = contactos?.contact_phone ?? null;
  const contactEmail = contactos?.contact_email ?? null;

  const souAtleta = meuPerfilRow?.role === "atleta";
  const alunoLigado = link?.status === "ativo";
  const pedidoPendente = link?.status === "pendente";
  const mostrarContactos = meuPerfil || pt.show_contacts === "todos" || alunoLigado;

  const precoFmt = pt.price != null && String(pt.price).trim() !== "" ? `${Math.round(Number(pt.price))} €` : null;

  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-5 py-8">
      <BotaoVoltar />
      <header className="apex-perfil-cabecalho">
        <div className="apex-avatar apex-avatar--grande">
          {pt.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pt.avatar_url} alt="" />
          ) : (
            <span className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.fraco }}>
              {(pt.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="apex-tipo-titulo-ecra truncate" style={{ marginTop: 0, color: COR.tinta }}>
              {pt.name ?? "Personal Trainer"}
            </h1>
            {pt.is_verified ? (
              <span className="apex-chip-neutro apex-tipo-etiqueta" style={{ color: COR.azul }}>
                Verificado
              </span>
            ) : null}
          </div>
          {pt.headline ? (
            <p className="apex-tipo-corpo" style={{ color: COR.tinta }}>
              {pt.headline}
            </p>
          ) : null}
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            {[pt.city, pt.experience ? `${pt.experience} anos de experiência` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      {perfilPublico ? (
        <div className="flex gap-6">
          <span className="apex-perfil-metrica">
            <span className="apex-tipo-titulo-seccao apex-tabular" style={{ marginTop: 0, color: COR.tinta }}>
              {perfilPublico.seguidoresCount}
            </span>
            <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              seguidores
            </span>
          </span>
          <span className="apex-perfil-metrica">
            <span className="apex-tipo-titulo-seccao apex-tabular" style={{ marginTop: 0, color: COR.tinta }}>
              {perfilPublico.seguindoCount}
            </span>
            <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              a seguir
            </span>
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {meuPerfil ? (
          <Link href="/perfil/editar" className="apex-tipo-secundario self-start underline underline-offset-4" style={{ color: COR.tinta }}>
            Editar o meu perfil
          </Link>
        ) : (
          <>
            {!meuPerfil && perfilPublico ? <BotaoSeguir followingId={pt.id} aSeguir={perfilPublico.souEuASeguir} /> : null}
            {souAtleta && !alunoLigado && !pedidoPendente ? (
              <Link href={`/ligar?pt=${pt.pt_code}`} className="apex-botao apex-botao--claro" style={{ width: "auto", padding: "10px 20px" }}>
                Enviar pedido de ligação
              </Link>
            ) : pedidoPendente ? (
              <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
                Já enviaste um pedido de ligação a este PT.
              </p>
            ) : alunoLigado ? (
              <p className="apex-tipo-secundario" style={{ color: COR.azul }}>
                Estás ligado a este PT.
              </p>
            ) : null}
          </>
        )}
      </div>

      {pt.bio ? (
        <Seccao titulo="Apresentação">
          <p className="apex-tipo-corpo whitespace-pre-wrap" style={{ color: COR.tinta }}>
            {pt.bio}
          </p>
        </Seccao>
      ) : null}

      {pt.specialties && pt.specialties.length > 0 ? (
        <Seccao titulo="Especialidades">
          <div className="flex flex-wrap gap-2">
            {(pt.specialties as string[]).map((s) => (
              <span key={s} className="apex-chip-neutro apex-tipo-etiqueta">
                {labelEspecialidade(s)}
              </span>
            ))}
          </div>
        </Seccao>
      ) : null}

      {pt.certs && pt.certs.length > 0 ? (
        <Seccao titulo="Certificações">
          <ul className="flex flex-col gap-1">
            {(pt.certs as string[]).map((c, i) => (
              <li key={i} className="apex-tipo-corpo" style={{ color: COR.tinta }}>
                • {c}
              </li>
            ))}
          </ul>
        </Seccao>
      ) : null}

      {(pt.services && pt.services.length > 0) || precoFmt ? (
        <Seccao titulo="Como trabalha">
          <p className="apex-tipo-corpo" style={{ color: COR.tinta }}>
            {(pt.services as string[]).map(labelServico).join(" · ") || "—"}
            {precoFmt ? ` · desde ${precoFmt}` : ""}
          </p>
          {pt.gym ? (
            <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
              Treina em {pt.gym}
            </p>
          ) : null}
        </Seccao>
      ) : null}

      <Seccao titulo="Contactos">
        {mostrarContactos ? (
          <ul className="flex flex-col gap-1">
            {contactPhone ? (
              <li className="apex-tipo-corpo" style={{ color: COR.tinta }}>
                Telefone: {contactPhone}
              </li>
            ) : null}
            {contactEmail ? (
              <li className="apex-tipo-corpo" style={{ color: COR.tinta }}>
                Email: {contactEmail}
              </li>
            ) : null}
            {pt.instagram ? (
              <li className="apex-tipo-corpo" style={{ color: COR.tinta }}>
                Instagram:{" "}
                <a href={`https://instagram.com/${pt.instagram}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  @{pt.instagram}
                </a>
              </li>
            ) : null}
            {!contactPhone && !contactEmail && !pt.instagram ? (
              <li className="apex-tipo-secundario" style={{ color: COR.fraco }}>
                Sem contactos preenchidos.
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            Este PT só mostra os contactos aos seus alunos. Envia um pedido de ligação.
          </p>
        )}
      </Seccao>

      <section>
        <h2 className="apex-tipo-titulo-seccao" style={{ color: COR.tinta }}>
          Publicações
        </h2>
        <ListaPosts posts={posts} meId={user.id} vazioTexto="Ainda sem publicações." />
      </section>
    </main>
  );
}

function Seccao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}
