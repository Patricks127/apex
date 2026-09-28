import Link from "next/link";
import type { PerfilPublico, PostFeed } from "@/lib/social/feed-dados";
import { LIFT_LABEL, type Lift } from "@/lib/motor";
import { formatarData } from "@/lib/fuso";
import { formatarKg } from "@/lib/formato";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { ListaPosts } from "@/app/u/lista-posts";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
} as const;

export type MarcaPerfil = { lift: Lift; kg: number; estimado: boolean };

/** Apresentação do perfil do atleta (page.tsx vai buscar os dados). */
export function VistaPerfil({
  perfil,
  nTreinos,
  nPublicacoes,
  marcas,
  posts,
  meId,
}: {
  perfil: PerfilPublico;
  nTreinos: number;
  nPublicacoes: number;
  marcas: MarcaPerfil[];
  posts: PostFeed[];
  meId: string;
}) {
  const desde = perfil.createdAt ? formatarData(perfil.createdAt, { month: "long", year: "numeric" }) : null;

  return (
    <main className="apex-ecra-claro mx-auto flex w-full max-w-lg flex-col gap-6 px-5 pt-6 pb-8">
      <BotaoVoltar />

      <header className="apex-perfil-cabecalho">
        <div className="apex-avatar apex-avatar--grande">
          {perfil.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={perfil.avatarUrl} alt="" />
          ) : (
            <span className="apex-tipo-saudacao" style={{ color: COR.fraco }}>
              {(perfil.name ?? "?").trim().charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="apex-tipo-saudacao" style={{ color: COR.tinta }}>
            {perfil.name ?? "Atleta"}
          </h1>
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            {["Atleta", perfil.city].filter(Boolean).join(" · ")}
          </p>
          {desde ? (
            <p className="apex-tipo-etiqueta" style={{ color: COR.fraco, fontWeight: 500 }}>
              Na APEX desde {desde}
            </p>
          ) : null}
        </div>
      </header>

      {perfil.headline || perfil.bio ? (
        <section className="flex flex-col gap-2">
          {perfil.headline ? (
            <div className="apex-cartao apex-cartao--compacto">
              <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
                Objetivo
              </span>
              <p className="apex-tipo-corpo" style={{ color: COR.tinta, fontWeight: 600 }}>
                {perfil.headline}
              </p>
            </div>
          ) : null}
          {perfil.bio ? (
            <p className="apex-tipo-corpo whitespace-pre-line" style={{ color: COR.tinta }}>
              {perfil.bio}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
          Ainda sem objetivo nem bio — conta aos outros o que andas a treinar.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href="/perfil/editar" className="apex-botao apex-botao--claro">
          Editar perfil
        </Link>
        <Link
          href="/perfil/definicoes"
          className="apex-tipo-secundario flex items-center justify-center border px-4 text-center"
          style={{ minHeight: 48, borderColor: COR.linha, color: COR.tinta, fontWeight: 700 }}
        >
          Definições
        </Link>
      </div>

      <div className="apex-kpis">
        <Kpi numero={nTreinos} etiqueta={nTreinos === 1 ? "treino concluído" : "treinos concluídos"} />
        <Kpi numero={nPublicacoes} etiqueta={nPublicacoes === 1 ? "publicação" : "publicações"} />
        <Kpi numero={perfil.seguidoresCount} etiqueta={perfil.seguidoresCount === 1 ? "seguidor" : "seguidores"} />
        <Kpi numero={perfil.seguindoCount} etiqueta="a seguir" />
      </div>

      <section className="flex flex-col">
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Melhores marcas
        </h2>
        {marcas.length === 0 ? (
          <p className="apex-tipo-secundario mt-2" style={{ color: COR.fraco }}>
            Ainda sem recordes.{" "}
            <Link href="/progresso" className="underline underline-offset-4" style={{ color: COR.tinta }}>
              Regista um em Progresso
            </Link>
            .
          </p>
        ) : (
          marcas.map((m) => (
            <div key={m.lift} className="apex-linha-exercicio">
              <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
                {LIFT_LABEL[m.lift]}
              </span>
              <div className="apex-linha-exercicio__valores">
                <span className="apex-tabular apex-linha-exercicio__carga">{formatarKg(m.kg)}</span>
                <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
                  {m.estimado ? "estimado" : "testado"}
                </span>
              </div>
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Publicações
        </h2>
        <ListaPosts posts={posts} meId={meId} vazioTexto="Ainda sem publicações — partilha um treino no Feed." />
      </section>
    </main>
  );
}

function Kpi({ numero, etiqueta }: { numero: number; etiqueta: string }) {
  return (
    <div className="apex-kpi">
      <span className="apex-kpi__numero apex-tabular">{numero}</span>
      <span className="apex-kpi__etiqueta">{etiqueta}</span>
    </div>
  );
}
