import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarFeed, carregarFontesParaComposer, type Filtro } from "@/lib/social/feed-dados";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { FeedView } from "./feed-view";

export const metadata: Metadata = {
  title: "Feed · APEX",
};

const FILTROS: Filtro[] = ["tudo", "seguindo", "pts", "meus"];

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro: filtroParam } = await searchParams;
  const filtro: Filtro = FILTROS.includes(filtroParam as Filtro) ? (filtroParam as Filtro) : "tudo";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [posts, fontes] = await Promise.all([
    carregarFeed(supabase, user.id, filtro),
    carregarFontesParaComposer(supabase, user.id),
  ]);

  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-5 py-8">
      <BotaoVoltar />
      <FeedView
        meId={user.id}
        filtroInicial={filtro}
        posts={posts}
        fontes={fontes}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      />
    </main>
  );
}
