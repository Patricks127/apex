import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkComAluno } from "@/lib/chat/link";
import { ChatView, type Mensagem } from "@/app/chat/chat-view";

export const metadata: Metadata = {
  title: "Chat · APEX",
};

export default async function ChatComAlunoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: alunoId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const link = await linkComAluno(supabase, user.id, alunoId);
  if (!link) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-100">Sem conversa</h1>
        <p className="text-sm text-zinc-400">Não tens uma ligação ativa com este aluno.</p>
        <Link
          href="/pt/alunos"
          className="mt-2 self-start text-sm font-medium text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
        >
          Voltar aos alunos
        </Link>
      </main>
    );
  }

  const { data: aluno } = await supabase.from("profiles").select("name").eq("id", alunoId).single();

  const { data: mensagens } = await supabase
    .from("messages")
    .select(
      "id, sender_id, body, media_path, media_kind, is_evolution, weight_kg, measurement, read_at, created_at",
    )
    .eq("link_id", link.id)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-lg flex-col px-0">
      <ChatView
        linkId={link.id}
        meId={user.id}
        perspetiva="pt"
        scopeEvolucao={link.scope_evolucao}
        outroNome={aluno?.name ?? "Atleta"}
        inicial={(mensagens ?? []) as Mensagem[]}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      />
    </main>
  );
}
