import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPerfilPublico, carregarPostsDoUtilizador } from "@/lib/social/feed-dados";
import type { Lift } from "@/lib/motor";
import { VistaPerfil } from "./vista-perfil";

export const metadata: Metadata = {
  title: "O meu perfil · APEX",
};

const LIFTS: Lift[] = ["agachamento", "supino", "terra", "press"];

/**
 * Perfil do ATLETA, visto pelo próprio (Fase 3, ponto 9). Tudo dados reais
 * — nada estimado nem inventado: treinos concluídos (workout_sessions),
 * publicações, seguidores, melhores marcas (personal_records: a melhor
 * TESTADA por levantamento; só estimadas → a melhor estimada, dito como
 * tal). O que os outros veem é /u/[id] (sem os treinos nem as marcas —
 * a RLS só os deixa ler ao próprio e ao PT com permissão).
 *
 * PT: o perfil dele é o currículo público (/pt/[codigo]) — vai para lá.
 */
export default async function MeuPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const perfil = await carregarPerfilPublico(supabase, user.id, user.id);
  if (!perfil) redirect("/painel");
  if (perfil.role === "pt") redirect(perfil.ptCode ? `/pt/${perfil.ptCode}` : "/perfil/editar");

  const [{ count: nTreinos }, { count: nPublicacoes }, { data: recordes }, posts] = await Promise.all([
    supabase.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("personal_records").select("lift, value_kg, source").eq("user_id", user.id),
    carregarPostsDoUtilizador(supabase, user.id, user.id),
  ]);

  const marcas = LIFTS.map((lift) => {
    const deste = (recordes ?? []).filter((r) => r.lift === lift);
    const testados = deste.filter((r) => r.source !== "auto");
    const base = testados.length > 0 ? testados : deste;
    if (base.length === 0) return null;
    return { lift, kg: Math.max(...base.map((r) => Number(r.value_kg))), estimado: testados.length === 0 };
  }).filter((m): m is { lift: Lift; kg: number; estimado: boolean } => m !== null);

  return (
    <VistaPerfil
      perfil={perfil}
      nTreinos={nTreinos ?? 0}
      nPublicacoes={nPublicacoes ?? 0}
      marcas={marcas}
      posts={posts}
      meId={user.id}
    />
  );
}
