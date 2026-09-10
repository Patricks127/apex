import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXERCICIOS, MUSCULO_LABEL } from "@/lib/motor2";
import type { PlanoGerado } from "@/lib/motor";
import { EditorPlanoPt, type ExercicioPicker, type DiaEditorInicial } from "./editor-plano-pt";

export const metadata: Metadata = {
  title: "Ficha do aluno · APEX",
};

export default async function FichaAlunoPage({
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

  const { data: link } = await supabase
    .from("pt_links")
    .select("id, scope_treinos")
    .eq("pt_id", user.id)
    .eq("student_id", alunoId)
    .eq("status", "ativo")
    .maybeSingle();

  const { data: aluno } = await supabase.from("profiles").select("name").eq("id", alunoId).maybeSingle();

  if (!link || !link.scope_treinos) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-100">{aluno?.name ?? "Aluno"}</h1>
        <p className="text-sm text-zinc-400">
          {!link
            ? "Não tens uma ligação ativa com este aluno."
            : "Este aluno não te deu permissão de treinos — não podes atribuir-lhe um plano."}
        </p>
        <Link href="/painel" className="text-sm text-zinc-300 underline underline-offset-4 hover:text-zinc-100">
          Voltar ao painel
        </Link>
      </main>
    );
  }

  const { data: planoExistente } = await supabase
    .from("training_plans")
    .select("name, days")
    .eq("owner_id", user.id)
    .eq("student_id", alunoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const exercicios: ExercicioPicker[] = EXERCICIOS.map((e) => ({
    id: e.id,
    nome: e.nome,
    familia: e.familia,
    musculo: e.primarios[0] ? MUSCULO_LABEL[e.primarios[0].musculo] : "",
    equipamento: e.equipamento,
  }));

  let diasIniciais: DiaEditorInicial[] | undefined;
  if (planoExistente) {
    const plano = planoExistente.days as PlanoGerado;
    diasIniciais = plano.days
      .filter((d) => !d.rest && d.exercises && d.exercises.length > 0)
      .map((d) => ({
        nome: d.title ?? "Dia",
        exercicios: d.exercises!.map((e) => ({
          exercicioId: e.exercicioId ?? "",
          nome: e.name,
          series: e.sets.length,
          reps: e.sets[0]?.reps ?? 8,
          carga: e.sets[0]?.w ?? null,
          nota: e.nota ?? "",
        })),
      }));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/painel" className="self-start text-xs font-medium text-zinc-500 underline underline-offset-4 hover:text-zinc-300">
          ← Painel
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-100">{aluno?.name ?? "Aluno"}</h1>
        <p className="text-sm text-zinc-400">
          {planoExistente ? "Editar o plano que atribuíste a este aluno." : "Criar um plano para este aluno."}
        </p>
      </header>

      <EditorPlanoPt
        alunoId={alunoId}
        exercicios={exercicios}
        nomeInicial={planoExistente?.name ?? ""}
        diasIniciais={diasIniciais}
      />
    </main>
  );
}
