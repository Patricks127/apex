import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPlanoAtivo, janelaRecente } from "@/lib/treino/perfil";
import { type Injury } from "@/lib/motor";
import { aplicarCautelaLeitura } from "@/lib/motor2";
import { RegistoTreino } from "./registo-treino";

export const metadata: Metadata = {
  title: "Treino · APEX",
};

export default async function TreinoDiaPage({
  params,
}: {
  params: Promise<{ dia: string }>;
}) {
  const { dia } = await params;
  const dayIndex = Number.parseInt(dia, 10);
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) redirect("/plano");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const planoAtivo = await carregarPlanoAtivo(supabase, user.id);
  if (!planoAtivo) redirect("/plano");

  // Check-in mais recente (últimos 5 dias) → zonas de desconforto → carga cautelar
  const desde = janelaRecente(5);
  const { data: checkins } = await supabase
    .from("workout_checkins")
    .select("discomfort_zones")
    .eq("user_id", user.id)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1);
  const checkinZones = (checkins?.[0]?.discomfort_zones ?? []) as Injury[];

  // O snapshot em training_plans.days É o plano — nunca se regenera aqui.
  // Regenerar só acontece em três momentos explícitos (ver
  // src/app/actions/treino.ts): criar/regenerar plano, avançar a semana, ou
  // completar o onboarding de novo. Se este ecrã regenerasse ao vivo a cada
  // entrada, o que o aluno vê aqui podia deixar de bater certo com o que
  // /plano mostrou — e a progressão semanal (que compara executado com
  // planeado) perderia sentido, porque o planeado teria mudado sozinho.
  // `carregarPlanoAtivo` já devolve `days` com a progressão aplicada (em
  // leitura, para um plano de PT; já embutida no snapshot, para um plano do
  // motor — ver planoParaExibir). Só falta a cautela do check-in, também em
  // leitura, igual para os dois casos (ambos ligam exercicioId à mesma base
  // EXERCICIOS — ver aplicarCautelaLeitura).
  const diasComCautela = aplicarCautelaLeitura(planoAtivo.days.days, checkinZones);
  const diaBruto = diasComCautela[dayIndex];
  const weekNumber = planoAtivo.days.meta.week ?? 1;
  const deload = !!planoAtivo.days.meta.deloadWeek;

  const diaGerado = diaBruto && !diaBruto.rest ? diaBruto : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      {!diaGerado ? (
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold text-zinc-100">Dia de descanso</h1>
          <p className="text-sm text-zinc-400">Não há treino marcado para este dia.</p>
          <Link
            href="/plano"
            className="mt-2 self-start text-sm font-medium text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
          >
            Voltar ao plano
          </Link>
        </div>
      ) : (
        <RegistoTreino
          dia={diaGerado}
          weekNumber={weekNumber}
          deload={deload}
          checkinAtivo={checkinZones.length > 0}
        />
      )}
    </main>
  );
}
