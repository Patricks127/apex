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

  return (
    <>
      <CodigoPt codigoInicial={ptCode} />

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
        <h2 className="text-sm font-medium text-zinc-400">
          Alunos ligados
          {alunos && alunos.length > 0 ? ` (${alunos.length})` : ""}
        </h2>
        {!alunos || alunos.length === 0 ? (
          <p className="text-sm text-zinc-600">Ainda não tens alunos ligados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alunos.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <p className="text-sm font-semibold text-zinc-100">
                  {a.aluno?.name ?? "Atleta"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Autorizou: <Scopes l={a} />
                </p>
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
        <Link
          href="/ligar"
          className="mt-3 inline-block rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          Ligar a um PT
        </Link>
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
