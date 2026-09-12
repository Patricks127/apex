import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sair } from "@/app/actions/auth";
import { responderPedido, revogarAcesso } from "@/app/actions/ligacoes";
import { CodigoPt } from "./codigo-pt";
import { OMeuPt } from "./o-meu-pt";

export const metadata: Metadata = {
  title: "Painel · APEX",
};

const NOME_PAPEL: Record<string, string> = {
  atleta: "Atleta",
  pt: "Personal Trainer",
};

type PerfilRef = { id: string; name: string | null } | null;

type Ligacao = {
  id: string;
  status: string;
  scope_evolucao: boolean;
  scope_videos: boolean;
  scope_metricas: boolean;
  created_at: string;
  pt: PerfilRef;
  aluno: PerfilRef;
};

export default async function PainelPage() {
  const supabase = await createClient();

  // getUser() valida o token no servidor. Nunca usar getSession() para decidir acessos.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("name, role, pt_code")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-10">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-600">APEX</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-100">
            {perfil?.name ?? "—"}
          </h1>
          <p className="text-sm text-zinc-400">
            {perfil?.role ? (NOME_PAPEL[perfil.role] ?? perfil.role) : "Perfil incompleto"}
          </p>
        </div>
        <form action={sair}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
          >
            Terminar sessão
          </button>
        </form>
      </header>

      {perfil?.role === "pt" ? (
        <SeccaoPt userId={user.id} ptCode={perfil.pt_code ?? null} />
      ) : perfil?.role === "atleta" ? (
        <SeccaoAtleta userId={user.id} />
      ) : (
        <p className="text-sm text-zinc-500">
          O teu perfil ainda não está completo. Contacta o suporte.
        </p>
      )}

      <section className="mt-auto flex flex-col gap-1.5 border-t border-zinc-800 pt-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-600">Definições</h2>
        <div className="flex gap-4 text-xs">
          <Link href="/termos" className="text-zinc-400 underline underline-offset-4 hover:text-zinc-200">
            Termos de Utilização
          </Link>
          <Link href="/privacidade" className="text-zinc-400 underline underline-offset-4 hover:text-zinc-200">
            Política de Privacidade
          </Link>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// PT
// ---------------------------------------------------------------------------

async function SeccaoPt({ userId, ptCode }: { userId: string; ptCode: string | null }) {
  const supabase = await createClient();

  const { data: pedidos } = await supabase
    .from("pt_links")
    .select(
      "id, status, scope_evolucao, scope_videos, scope_metricas, created_at, aluno:profiles!student_id(id, name)",
    )
    .eq("pt_id", userId)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .overrideTypes<Ligacao[]>();

  const { data: alunos } = await supabase
    .from("pt_links")
    .select(
      "id, status, scope_evolucao, scope_videos, scope_metricas, created_at, aluno:profiles!student_id(id, name)",
    )
    .eq("pt_id", userId)
    .eq("status", "ativo")
    .order("updated_at", { ascending: false })
    .overrideTypes<Ligacao[]>();

  // Vídeos dos alunos ainda sem feedback (a RLS já filtra por scope_videos).
  let videosPorVer = 0;
  const alunoIds = (alunos ?? []).map((a) => a.aluno?.id).filter((x): x is string => !!x);
  if (alunoIds.length) {
    const { data: vids } = await supabase
      .from("training_videos")
      .select("id")
      .in("user_id", alunoIds);
    const vidIds = (vids ?? []).map((v) => v.id);
    if (vidIds.length) {
      const { data: fbs } = await supabase
        .from("video_feedback")
        .select("video_id")
        .in("video_id", vidIds);
      const comFeedback = new Set((fbs ?? []).map((f) => f.video_id));
      videosPorVer = vidIds.filter((id) => !comFeedback.has(id)).length;
    }
  }

  return (
    <>
      <CodigoPt codigoInicial={ptCode} />

      <Link
        href="/perfil/editar"
        className="-mt-2 self-start text-xs font-medium text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
      >
        Editar o meu perfil público
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-400">
          Pedidos pendentes
          {pedidos && pedidos.length > 0 ? ` (${pedidos.length})` : ""}
        </h2>
        {!pedidos || pedidos.length === 0 ? (
          <p className="text-sm text-zinc-600">Sem pedidos por responder.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pedidos.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <p className="text-sm font-semibold text-zinc-100">
                  {p.aluno?.name ?? "Atleta"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Quer autorizar: <Scopes l={p} />
                </p>
                <form action={responderPedido} className="mt-3 flex gap-2">
                  <input type="hidden" name="link_id" value={p.id} />
                  <button
                    name="accao"
                    value="aceitar"
                    className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
                  >
                    Aceitar
                  </button>
                  <button
                    name="accao"
                    value="recusar"
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Recusar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-400">
            Alunos ligados
            {alunos && alunos.length > 0 ? ` (${alunos.length})` : ""}
          </h2>
          {alunos && alunos.length > 0 ? (
            <div className="flex items-center gap-3 text-xs font-medium">
              <Link
                href="/chat"
                className="text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
              >
                Abrir conversa
              </Link>
              <Link
                href="/videos"
                className="text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
              >
                Ver vídeos
                {videosPorVer > 0 ? (
                  <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                    {videosPorVer}
                  </span>
                ) : null}
              </Link>
            </div>
          ) : null}
        </div>
        {!alunos || alunos.length === 0 ? (
          <p className="text-sm text-zinc-600">Ainda não tens alunos ligados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alunos.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    {a.aluno?.name ?? "Atleta"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Autorizou: <Scopes l={a} />
                  </p>
                </div>
                {a.aluno?.id ? (
                  // scope_treinos é sempre true numa ligação ativa (ver
                  // ligacoes.ts) — não precisa de verificação aqui.
                  <Link
                    href={`/pt/aluno/${a.aluno.id}`}
                    className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                  >
                    Plano
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Atleta
// ---------------------------------------------------------------------------

async function SeccaoAtleta({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: ligacao } = await supabase
    .from("pt_links")
    .select(
      "id, status, scope_evolucao, scope_videos, scope_metricas, created_at, pt:profiles!pt_id(id, name, pt_code)",
    )
    .eq("student_id", userId)
    .in("status", ["ativo", "pendente"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<Ligacao & { pt: { id: string; name: string | null; pt_code: string | null } | null }>();

  if (!ligacao) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-medium text-zinc-400">O teu PT</h2>
        <p className="mt-1 text-sm text-zinc-500">Ainda não estás ligado a nenhum PT.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/ligar"
            className="inline-block rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white"
          >
            Ligar a um PT
          </Link>
          <Link
            href="/descobrir"
            className="inline-block rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Descobrir PTs
          </Link>
          <Link
            href="/videos"
            className="inline-block rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Os meus vídeos
          </Link>
        </div>
      </section>
    );
  }

  if (ligacao.status === "pendente") {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-400">Pedido enviado</h2>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            À espera
          </span>
        </div>
        <p className="mt-1 text-lg font-semibold text-zinc-100">
          {ligacao.pt?.name ?? "PT"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Pediste para autorizar: <Scopes l={ligacao} />
        </p>
        <form action={revogarAcesso} className="mt-3">
          <input type="hidden" name="link_id" value={ligacao.id} />
          <button
            type="submit"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
          >
            Cancelar pedido
          </button>
        </form>
      </section>
    );
  }

  return (
    <OMeuPt
      linkId={ligacao.id}
      ptNome={ligacao.pt?.name ?? "PT"}
      ptCode={ligacao.pt?.pt_code ?? null}
      evolucao={ligacao.scope_evolucao}
      videos={ligacao.scope_videos}
      metricas={ligacao.scope_metricas}
    />
  );
}

// ---------------------------------------------------------------------------

function Scopes({ l }: { l: Pick<Ligacao, "scope_evolucao" | "scope_videos" | "scope_metricas"> }) {
  const ativos = [
    "treinos",
    l.scope_evolucao && "evolução",
    l.scope_videos && "vídeos",
    l.scope_metricas && "métricas",
  ].filter(Boolean) as string[];
  return <span className="text-zinc-300">{ativos.join(", ")}</span>;
}
