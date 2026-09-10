import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPerfilMotor, carregarPlanoAtivo, janelaRecente } from "@/lib/treino/perfil";
import { type DiaGerado, type Injury } from "@/lib/motor";
import { gerarPlanoV2, aplicarCautelaLeitura } from "@/lib/motor2";
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

  let diaBruto: DiaGerado | undefined;
  let weekNumber: number;
  let deload: boolean;

  if (planoAtivo.souDono) {
    // Plano gerado pelo motor: regenera ao vivo (comportamento de sempre) —
    // é assim que a cautela do check-in e a progressão se aplicam.
    const ctx = await carregarPerfilMotor(supabase, user.id);
    if (!ctx) redirect("/onboarding");
    const prog = planoAtivo.progression;
    const planoV2 = gerarPlanoV2(ctx.motorProfile, ctx.maxes, { progression: prog, checkinZones });
    diaBruto = planoV2.days[dayIndex];
    weekNumber = prog?.week ?? 1;
    deload = !!prog?.deloadWeek;
  } else {
    // Plano de PT: `planoAtivo.days` já vem com a progressão aplicada em
    // leitura (carregarPlanoAtivo → planoParaExibir) — os exercícios em si
    // (days) nunca se regeneram, são os que o PT escreveu. Só falta a
    // cautela do check-in, aplicada ao vivo tal como no motor.
    const diasComCautela = aplicarCautelaLeitura(planoAtivo.days.days, checkinZones);
    diaBruto = diasComCautela[dayIndex];
    weekNumber = planoAtivo.days.meta.week ?? 1;
    deload = !!planoAtivo.days.meta.deloadWeek;
  }

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
