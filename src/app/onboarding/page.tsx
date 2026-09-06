import type { Metadata } from "next";
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

  const { data: perfil } = await supabase
    .from("profiles")
    .select(
      "goal, sex, level, days_per_week, location, location_note, injuries, injury_note, focus_muscles, split_format, gym_days_per_week, home_equipment",
    )
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-10">
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
