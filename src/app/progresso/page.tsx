import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarProgresso } from "@/lib/treino/progresso-dados";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { ProgressoView } from "./progresso-view";

export const metadata: Metadata = {
  title: "Progresso · APEX",
};

export default async function ProgressoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { recordes, metricas, sessoes } = await carregarProgresso(supabase, user.id);

  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-5 py-8">
      <BotaoVoltar />
      <ProgressoView recordes={recordes} metricas={metricas} sessoes={sessoes} />
    </main>
  );
}
