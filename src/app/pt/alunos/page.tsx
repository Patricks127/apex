import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { atencaoDosAlunos } from "@/lib/treino/atencao-dados";
import type { MotivoAtencao } from "@/lib/treino/atencao";
import { ListaAlunosView, type AlunoLinha } from "./lista-alunos-view";

export const metadata: Metadata = {
  title: "Alunos · APEX",
};

// Prioridade de produto (não uma norma): dor é sinal de segurança, vem
// primeiro; depois inatividade (o PT deixa de saber o que se passa);
// depois esforço a mais; adesão baixa por último. Usada só para ordenar
// a lista por urgência — não muda o que cada motivo significa.
const PESO_MOTIVO: Record<MotivoAtencao, number> = {
  dor_recorrente: 4,
  inativo: 3,
  esforco_alto: 2,
  adesao_baixa: 1,
};

function pontuarUrgencia(motivos: MotivoAtencao[]): number {
  return motivos.reduce((soma, m) => soma + PESO_MOTIVO[m], 0);
}

export default async function ListaAlunosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (perfil?.role !== "pt") redirect("/painel");

  const { data: alunos } = await supabase
    .from("pt_links")
    .select("scope_evolucao, scope_videos, scope_metricas, aluno:profiles!student_id(id, name)")
    .eq("pt_id", user.id)
    .eq("status", "ativo")
    .overrideTypes<
      { scope_evolucao: boolean; scope_videos: boolean; scope_metricas: boolean; aluno: { id: string; name: string | null } | null }[]
    >();

  const alunoIds = (alunos ?? []).map((a) => a.aluno?.id).filter((x): x is string => !!x);
  const atencaoPorAluno = await atencaoDosAlunos(supabase, alunoIds);

  const linhas: AlunoLinha[] = (alunos ?? [])
    .filter((a) => a.aluno?.id)
    .map((a) => ({
      id: a.aluno!.id,
      nome: a.aluno!.name ?? "Atleta",
      motivos: atencaoPorAluno.get(a.aluno!.id) ?? [],
      scopes: { evolucao: a.scope_evolucao, videos: a.scope_videos, metricas: a.scope_metricas },
    }))
    .sort((x, y) => pontuarUrgencia(y.motivos) - pontuarUrgencia(x.motivos) || x.nome.localeCompare(y.nome));

  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-5 py-8">
      <ListaAlunosView alunos={linhas} />
    </main>
  );
}
