import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkAtivo } from "@/lib/chat/link";
import { VideosView, type VideoRow, type FeedbackRow } from "./videos-view";

export const metadata: Metadata = {
  title: "Vídeos · APEX",
};

export default async function VideosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const link = await linkAtivo(supabase, user.id);
  const souPt = link?.perspetiva === "pt";

  // Um PT sem aluno ligado não tem galeria para ver.
  if (perfil?.role === "pt" && !souPt) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-100">Vídeos</h1>
        <p className="text-sm text-zinc-400">
          Vais ver aqui os vídeos dos alunos que te derem permissão de vídeos.
        </p>
        <Link href="/painel" className="text-sm text-zinc-300 underline underline-offset-4">
          Voltar ao painel
        </Link>
      </main>
    );
  }

  // O atleta vê a própria galeria; o PT vê a do aluno ligado.
  const alunoId = link && souPt ? link.student_id : user.id;

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

  let alunoNome = "";
  if (souPt) {
    const { data: p } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", alunoId)
      .single();
    alunoNome = p?.name ?? "Atleta";
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <VideosView
        perspetiva={souPt ? "pt" : "aluno"}
        scopeVideos={link ? link.scope_videos : true}
        alunoNome={alunoNome}
        videos={(videos ?? []) as VideoRow[]}
        feedback={(feedback ?? []) as FeedbackRow[]}
        meId={user.id}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      />
    </main>
  );
}
