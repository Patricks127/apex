import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ESPECIALIDADES, labelEspecialidade } from "@/lib/perfil";
import { buscarPessoas } from "@/lib/social/feed-dados";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { BotaoSeguir } from "./botao-seguir";

export const metadata: Metadata = {
  title: "Descobrir · APEX",
};

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
} as const;

export default async function DescobrirPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").replace(/[(),*{}]/g, " ").trim().slice(0, 60);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const espMatch = query
    ? ESPECIALIDADES.filter(
        (e) => e.label.toLowerCase().includes(query.toLowerCase()) || e.id.includes(query.toLowerCase()),
      ).map((e) => e.id)
    : [];

  const pessoas = await buscarPessoas(supabase, user.id, query, espMatch);

  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-5 py-8">
      <header>
        <BotaoVoltar />
        <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          Descobrir
        </h1>
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Procura atletas e PTs por nome, cidade ou especialidade.
        </p>
      </header>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="ex.: Lisboa, powerlifting, Rui…"
          className="apex-tipo-corpo w-full border px-3 py-2.5 outline-none"
          style={{ borderColor: COR.linha, borderRadius: 2, background: "var(--apex-branco)", color: COR.tinta }}
        />
        <button type="submit" className="apex-botao apex-botao--claro shrink-0" style={{ width: "auto", padding: "0 20px" }}>
          Procurar
        </button>
      </form>

      {pessoas.length === 0 ? (
        <p className="apex-tipo-corpo py-10 text-center" style={{ color: COR.fraco }}>
          {query ? "Ninguém encontrado." : "Ainda não há ninguém para descobrir."}
        </p>
      ) : (
        <div>
          {pessoas.map((p) => (
            <div key={p.id} className="apex-pessoa-item">
              <Link href={p.role === "pt" && p.ptCode ? `/pt/${p.ptCode}` : `/u/${p.id}`} className="apex-avatar">
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" />
                ) : (
                  <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
                    {(p.name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={p.role === "pt" && p.ptCode ? `/pt/${p.ptCode}` : `/u/${p.id}`}
                  className="apex-tipo-nome-exercicio"
                  style={{ color: COR.tinta, textDecoration: "none" }}
                >
                  {p.name ?? "Utilizador"}
                  {p.role === "pt" ? (
                    <span className="apex-chip-neutro apex-tipo-etiqueta" style={{ marginLeft: 6 }}>
                      PT{p.isVerified ? " · verificado" : ""}
                    </span>
                  ) : null}
                </Link>
                <p className="apex-tipo-secundario truncate" style={{ color: COR.fraco }}>
                  {p.headline ?? ""}
                </p>
                <p className="apex-tipo-etiqueta truncate" style={{ color: COR.fraco }}>
                  {[p.city, p.specialties.slice(0, 2).map(labelEspecialidade).join(", ")].filter(Boolean).join(" · ")}
                </p>
              </div>
              <BotaoSeguir followingId={p.id} aSeguir={p.souEuASeguir} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
