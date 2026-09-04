import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPerfilMotor, janelaRecente } from "@/lib/treino/perfil";
import { type Injury, type Progression } from "@/lib/motor";
import { gerarPlanoV2 } from "@/lib/motor2";
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

  const ctx = await carregarPerfilMotor(supabase, user.id);
  if (!ctx) redirect("/onboarding");

  const { data: plano } = await supabase
    .from("training_plans")
    .select("progression")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plano) redirect("/plano");
  const prog = (plano.progression ?? null) as Progression | null;

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

  const planoV2 = gerarPlanoV2(ctx.motorProfile, ctx.maxes, {
    progression: prog,
    checkinZones,
  });
  const diaBruto = planoV2.days[dayIndex];
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
          weekNumber={prog?.week ?? 1}
          deload={!!prog?.deloadWeek}
          checkinAtivo={checkinZones.length > 0}
        />
      )}
    </main>
  );
}
