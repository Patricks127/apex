import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkComAluno } from "@/lib/chat/link";
import { VideosView, type VideoRow, type FeedbackRow } from "@/app/videos/videos-view";

export const metadata: Metadata = {
  title: "Vídeos · APEX",
};

export default async function VideosComAlunoPage({
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
        <h1 className="text-2xl font-semibold text-zinc-100">Vídeos</h1>
        <p className="text-sm text-zinc-400">Não tens uma ligação ativa com este aluno.</p>
        <Link href="/pt/alunos" className="text-sm text-zinc-300 underline underline-offset-4">
          Voltar aos alunos
        </Link>
      </main>
    );
  }

  const { data: videos } = await supabase
    .from("training_videos")
    .select("id, user_id, storage_path, exercise, created_at")
    .eq("user_id", alunoId)
    .order("created_at", { ascending: false })
    .limit(100);

  const ids = (videos ?? []).map((v) => v.id);
  const { data: feedback } = ids.length
    ? await supabase
        .from("video_feedback")
        .select("id, video_id, pt_id, body, created_at")
        .in("video_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] as FeedbackRow[] };

  const { data: aluno } = await supabase.from("profiles").select("name").eq("id", alunoId).single();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <VideosView
        perspetiva="pt"
        scopeVideos={link.scope_videos}
        alunoNome={aluno?.name ?? "Atleta"}
        videos={(videos ?? []) as VideoRow[]}
        feedback={(feedback ?? []) as FeedbackRow[]}
        meId={user.id}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      />
    </main>
  );
}
