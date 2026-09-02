import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PlanoGerado } from "@/lib/motor";
import { regenerarPlano } from "@/app/actions/treino";
import { VistaPlano } from "./vista-plano";

export const metadata: Metadata = {
  title: "Plano · APEX",
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

  const { data: perfil } = await supabase
    .from("profiles")
    .select("goal")
    .eq("id", user.id)
    .single();

  const { data: plano } = await supabase
    .from("training_plans")
    .select("id, name, days, created_at")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-10">
      {treino === "gravado" ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Treino gravado. Quando fechares a semana, a progressão usa estes dados.
        </p>
      ) : null}
      {plano ? (
        <VistaPlano plano={plano.days as PlanoGerado} nome={plano.name as string} />
      ) : !perfil?.goal ? (
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
          <h1 className="text-2xl font-semibold text-zinc-100">Plano por gerar</h1>
          <p className="text-sm text-zinc-400">
            O teu perfil está completo mas não há nenhum plano ativo.
          </p>
          <form action={regenerarPlano}>
            <button
              type="submit"
              className="mt-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
            >
              Gerar plano
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
