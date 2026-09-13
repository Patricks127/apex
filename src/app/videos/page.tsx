import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkAtivo, alunosLigados } from "@/lib/chat/link";
import { EscolherAluno } from "@/app/_ui/escolher-aluno";
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

  // Um PT pode ter vários alunos ligados — "a ligação mais recente"
  // (linkAtivo) não sabe escolher qual, e sem isto a galeria abria sempre
  // a do mesmo aluno a um PT com dois. Um atleta só tem um PT, o caminho
  // dele (abaixo) não muda.
  if (perfil?.role === "pt") {
    const alunos = await alunosLigados(supabase, user.id);
    if (alunos.length === 0) {
      return (
        <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-5 py-10">
          <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: "var(--apex-tinta)" }}>
            Vídeos
          </h1>
          <p className="apex-tipo-corpo" style={{ color: "var(--apex-cinza-texto)" }}>
            Vais ver aqui os vídeos dos alunos que te derem permissão de vídeos.
          </p>
          <Link
            href="/painel"
            className="apex-tipo-secundario mt-2 self-start underline underline-offset-4"
            style={{ color: "var(--apex-tinta)" }}
          >
            Voltar ao painel
          </Link>
        </main>
      );
    }
    if (alunos.length === 1) {
      redirect(`/pt/aluno/${alunos[0].id}/videos`);
    }
    return <EscolherAluno alunos={alunos} destino="videos" titulo="Vídeos" />;
  }

  // Atleta: vê sempre a própria galeria.
  const link = await linkAtivo(supabase, user.id);

  const { data: videos } = await supabase
    .from("training_videos")
    .select("id, user_id, storage_path, exercise, created_at")
    .eq("user_id", user.id)
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

  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-8">
      <VideosView
        perspetiva="aluno"
        scopeVideos={link ? link.scope_videos : true}
        alunoNome=""
        videos={(videos ?? []) as VideoRow[]}
        feedback={(feedback ?? []) as FeedbackRow[]}
        meId={user.id}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      />
    </main>
  );
}
