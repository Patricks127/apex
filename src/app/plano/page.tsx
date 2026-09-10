import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPlanoAtivo } from "@/lib/treino/perfil";
import { regenerarPlano, escolherPlano } from "@/app/actions/treino";
import { VistaPlano } from "./vista-plano";

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

  const [{ data: perfil }, planoAtivo, { data: todos }] = await Promise.all([
    supabase.from("profiles").select("goal").eq("id", user.id).single(),
    carregarPlanoAtivo(supabase, user.id),
    supabase
      .from("training_plans")
      .select("id, name, owner_id, owner:profiles!owner_id(name)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .overrideTypes<{ id: string; name: string; owner_id: string; owner: { name: string | null } | null }[]>(),
  ]);

  const outros: OutroPlano[] = (todos ?? [])
    .filter((p) => p.id !== planoAtivo?.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      owner_id: p.owner_id,
      feito_por: p.owner_id === user.id ? "Gerado por ti" : `PT: ${p.owner?.name ?? "—"}`,
    }));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-10">
      {treino === "gravado" ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Treino gravado. Quando fechares a semana, a progressão usa estes dados.
        </p>
      ) : null}

      {planoAtivo ? (
        <VistaPlano plano={planoAtivo.days} nome={planoAtivo.name} />
      ) : !perfil?.goal && outros.length === 0 ? (
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold text-zinc-100">Ainda não tens plano</h1>
          <p className="text-sm text-zinc-400">
            Responde a seis perguntas rápidas e o motor gera a tua semana.
          </p>
          <Link
            href="/onboarding"
            className="mt-2 inline-block self-start rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
          >
            Fazer o onboarding
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold text-zinc-100">
            {outros.length > 0 ? "Escolhe um plano" : "Plano por gerar"}
          </h1>
          <p className="text-sm text-zinc-400">
            {outros.length > 0
              ? "Tens plano(s) disponível(eis) mas ainda não escolheste nenhum para seguir."
              : "O teu perfil está completo mas não há nenhum plano ativo."}
          </p>
          {perfil?.goal ? (
            <form action={regenerarPlano}>
              <button
                type="submit"
                className="mt-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
              >
                Gerar plano
              </button>
            </form>
          ) : null}
        </div>
      )}

      {outros.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-sm font-medium text-zinc-400">Trocar de plano</h2>
          <ul className="flex flex-col gap-2">
            {outros.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{p.name}</p>
                  <p className="text-xs text-zinc-500">{p.feito_por}</p>
                </div>
                <form action={escolherPlano}>
                  <input type="hidden" name="plan_id" value={p.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
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
