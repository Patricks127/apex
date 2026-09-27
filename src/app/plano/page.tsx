import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPlanoAtivo, treinoDeHojeFeito } from "@/lib/treino/perfil";
import { indiceDiaSemanaHoje } from "@/lib/treino/linha-tempo";
import { regenerarPlano, escolherPlano } from "@/app/actions/treino";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { VistaPlano } from "./vista-plano";
import { PlanoDocumentoDestaque } from "./plano-pdf";

export const metadata: Metadata = {
  title: "Plano · APEX",
};

type OutroPlano = {
  id: string;
  name: string;
  owner_id: string;
  feito_por: string; // "Gerado por ti" ou o nome do PT
};

export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ treino?: string }>;
}) {
  const { treino } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [{ data: perfil }, planoAtivo, { data: todos }, { data: documentos }] = await Promise.all([
    supabase.from("profiles").select("goal").eq("id", user.id).single(),
    carregarPlanoAtivo(supabase, user.id),
    supabase
      .from("training_plans")
      .select("id, name, owner_id, owner:profiles!owner_id(name)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .overrideTypes<{ id: string; name: string; owner_id: string; owner: { name: string | null } | null }[]>(),
    // Planos em PDF que algum PT te anexou (migração 020) — em paralelo
    // ao plano estruturado, não em vez dele.
    supabase
      .from("plan_documents")
      .select("id, file_name, size_bytes, created_at, storage_path")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const documentosComUrl = await Promise.all(
    (documentos ?? []).map(async (d) => {
      const { data: assinado } = await supabase.storage
        .from("plan-documents")
        .createSignedUrl(d.storage_path, 60 * 60);
      return {
        id: d.id as string,
        nomeFicheiro: d.file_name as string,
        sizeBytes: d.size_bytes as number,
        createdAt: d.created_at as string,
        url: assinado?.signedUrl ?? null,
      };
    }),
  );

  // Já treinaste hoje? Só interessa para o dia que É hoje na semana (ver
  // src/lib/treino/linha-tempo.ts — "a decorrer" só existe para o dia de
  // hoje). Casa por título com o dia real de hoje, não só "algo recente",
  // para não marcar "feito" se o treino registado foi de outro dia.
  const indiceHoje = indiceDiaSemanaHoje();
  const diaHoje = planoAtivo?.days.days[indiceHoje];
  const tituloHoje = diaHoje && !diaHoje.rest ? diaHoje.title : null;
  const hojeFeito = tituloHoje ? await treinoDeHojeFeito(supabase, user.id, tituloHoje) : false;

  const outros: OutroPlano[] = (todos ?? [])
    .filter((p) => p.id !== planoAtivo?.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      owner_id: p.owner_id,
      feito_por: p.owner_id === user.id ? "Gerado por ti" : `PT: ${p.owner?.name ?? "—"}`,
    }));

  // PDF manda: se o PT anexou um plano em ficheiro, é ESSE o plano — não se
  // mostra o plano estruturado a competir com ele (VistaPlano, pedido para
  // gerar/escolher, "Trocar de plano"), mesmo que exista um antigo. Ver
  // apex-plan-documents.md.
  const temPdf = documentosComUrl.length > 0;

  return (
    <main className="apex-ecra-claro mx-auto flex w-full max-w-lg flex-col gap-4 px-5 py-8">
      <BotaoVoltar />
      {treino === "gravado" ? (
        <p
          className="apex-tipo-corpo border-b pb-4"
          style={{ color: "var(--apex-tinta)", borderColor: "var(--apex-cinza-linha)" }}
        >
          {temPdf
            ? "Treino registado."
            : "Treino gravado. Quando fechares a semana, a progressão usa estes dados."}
        </p>
      ) : null}

      {temPdf ? (
        <PlanoDocumentoDestaque documentos={documentosComUrl} />
      ) : planoAtivo ? (
        <VistaPlano
          plano={planoAtivo.days}
          nome={planoAtivo.name}
          indiceHoje={indiceHoje}
          hojeFeito={hojeFeito}
        />
      ) : !perfil?.goal && outros.length === 0 ? (
        <div className="flex flex-col gap-3">
          <h1 className="apex-tipo-titulo-ecra" style={{ color: "var(--apex-tinta)" }}>
            Ainda não tens plano
          </h1>
          <p className="apex-tipo-corpo" style={{ color: "var(--apex-cinza-texto)" }}>
            Responde a seis perguntas rápidas e o motor gera a tua semana.
          </p>
          <Link href="/onboarding" className="apex-botao apex-botao--claro mt-2">
            Fazer o onboarding
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h1 className="apex-tipo-titulo-ecra" style={{ color: "var(--apex-tinta)" }}>
            {outros.length > 0 ? "Escolhe um plano" : "Plano por gerar"}
          </h1>
          <p className="apex-tipo-corpo" style={{ color: "var(--apex-cinza-texto)" }}>
            {outros.length > 0
              ? "Tens plano(s) disponível(eis) mas ainda não escolheste nenhum para seguir."
              : "O teu perfil está completo mas não há nenhum plano ativo."}
          </p>
          {perfil?.goal ? (
            <form action={regenerarPlano}>
              <button type="submit" className="apex-botao apex-botao--claro mt-2">
                Gerar plano
              </button>
            </form>
          ) : null}
        </div>
      )}

      {!temPdf && outros.length > 0 ? (
        <section className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: "var(--apex-cinza-linha)" }}>
          <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: "var(--apex-tinta)" }}>
            Trocar de plano
          </h2>
          <ul className="flex flex-col">
            {outros.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 border-b py-3"
                style={{ borderColor: "var(--apex-cinza-linha)" }}
              >
                <div className="min-w-0">
                  <p className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)", overflowWrap: "anywhere" }}>{p.name}</p>
                  <p className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>{p.feito_por}</p>
                </div>
                <form action={escolherPlano} className="shrink-0">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <button
                    type="submit"
                    className="apex-tipo-etiqueta border px-3"
                    style={{ minHeight: 44, borderColor: "var(--apex-cinza-linha)", color: "var(--apex-tinta)" }}
                  >
                    Seguir este
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
