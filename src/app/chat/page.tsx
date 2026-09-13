import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkAtivo, alunosLigados } from "@/lib/chat/link";
import { EscolherAluno } from "@/app/_ui/escolher-aluno";
import { ChatView, type Mensagem } from "./chat-view";

export const metadata: Metadata = {
  title: "Chat · APEX",
};

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // Um PT pode ter vários alunos ligados — "a ligação mais recente"
  // (linkAtivo) não sabe escolher qual, e sem isto o chat abria sempre a
  // mesma conversa a um PT com dois alunos, fosse ela de quem fosse. Um
  // atleta só tem um PT, por isso o caminho dele (abaixo) não muda.
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (perfil?.role === "pt") {
    const alunos = await alunosLigados(supabase, user.id);
    if (alunos.length === 0) {
      return <SemConversa />;
    }
    if (alunos.length === 1) {
      redirect(`/pt/aluno/${alunos[0].id}/chat`);
    }
    return <EscolherAluno alunos={alunos} destino="chat" titulo="Conversas" />;
  }

  const link = await linkAtivo(supabase, user.id);
  if (!link) {
    return <SemConversa />;
  }

  const { data: outro } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", link.outroId)
    .single();

  const { data: mensagens } = await supabase
    .from("messages")
    .select(
      "id, sender_id, body, media_path, media_kind, is_evolution, weight_kg, measurement, read_at, created_at",
    )
    .eq("link_id", link.id)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <main className="apex-ecra-claro mx-auto flex h-dvh w-full max-w-lg flex-col px-0">
      <ChatView
        linkId={link.id}
        meId={user.id}
        perspetiva={link.perspetiva}
        scopeEvolucao={link.scope_evolucao}
        outroNome={outro?.name ?? (link.perspetiva === "aluno" ? "PT" : "Atleta")}
        inicial={(mensagens ?? []) as Mensagem[]}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      />
    </main>
  );
}

function SemConversa() {
  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-5 py-10">
      <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: "var(--apex-tinta)" }}>
        Sem conversa
      </h1>
      <p className="apex-tipo-corpo" style={{ color: "var(--apex-cinza-texto)" }}>
        O chat abre quando tens uma ligação PT↔aluno ativa.
      </p>
      <Link
        href="/painel"
        className="apex-tipo-secundario mt-2 self-start underline underline-offset-4"
        style={{ color: "var(--apex-tinta)" }}
      >
        Ir para o painel
      </Link>
    </main>
  );
}
