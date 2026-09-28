import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormularioOnboarding } from "./formulario-onboarding";

export const metadata: Metadata = {
  title: "Onboarding · APEX",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // perfil_privado (migração 023): só o próprio lê estes dados.
  const { data: perfil } = await supabase
    .from("perfil_privado")
    .select(
      "goal, sex, level, days_per_week, location, location_note, injuries, injury_note, focus_muscles, split_format, gym_days_per_week, home_equipment",
    )
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-10">
      <Link href="/painel" className="self-start text-sm text-zinc-500 hover:text-zinc-300">
        ← Painel
      </Link>
      <FormularioOnboarding
        inicial={{
          goal: perfil?.goal ?? null,
          sex: perfil?.sex ?? null,
          level: perfil?.level ?? null,
          days_per_week: perfil?.days_per_week ?? null,
          location: perfil?.location ?? null,
          location_note: perfil?.location_note ?? null,
          injuries: perfil?.injuries ?? [],
          injury_note: perfil?.injury_note ?? null,
          focus_muscles: perfil?.focus_muscles ?? [],
          split_format: perfil?.split_format ?? null,
          gym_days_per_week: perfil?.gym_days_per_week ?? null,
          home_equipment: perfil?.home_equipment ?? [],
        }}
      />
    </main>
  );
}
