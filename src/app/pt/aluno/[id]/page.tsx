import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXERCICIOS, MUSCULO_LABEL } from "@/lib/motor2";
import { LIFT_LABEL, type Lift, type PlanoGerado } from "@/lib/motor";
import { atencaoDosAlunos } from "@/lib/treino/atencao-dados";
import { MOTIVO_LABEL } from "@/lib/treino/atencao";
import { EditorPlanoPt, type ExercicioPicker, type DiaEditorInicial } from "./editor-plano-pt";

export const metadata: Metadata = {
  title: "Ficha do aluno · APEX",
};

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
} as const;

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
    .select("id, scope_treinos, scope_evolucao")
    .eq("pt_id", user.id)
    .eq("student_id", alunoId)
    .eq("status", "ativo")
    .maybeSingle();

  const { data: aluno } = await supabase.from("profiles").select("name").eq("id", alunoId).maybeSingle();

  if (!link || !link.scope_treinos) {
    return (
      <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-5 py-10">
        <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          {aluno?.name ?? "Aluno"}
        </h1>
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          {!link
            ? "Não tens uma ligação ativa com este aluno."
            : "Este aluno não te deu permissão de treinos — não podes atribuir-lhe um plano."}
        </p>
        <Link href="/pt/alunos" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Voltar aos alunos
        </Link>
      </main>
    );
  }

  const [{ data: planoExistente }, atencaoMap, { data: prs }, { data: sessoes }] = await Promise.all([
    supabase
      .from("training_plans")
      .select("name, days")
      .eq("owner_id", user.id)
      .eq("student_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    atencaoDosAlunos(supabase, [alunoId]),
    supabase.from("personal_records").select("lift, value_kg").eq("user_id", alunoId),
    supabase
      .from("workout_sessions")
      .select("title, completion, avg_rpe, week_number, created_at")
      .eq("user_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const evolucao = link.scope_evolucao
    ? await supabase
        .from("messages")
        .select("weight_kg, measurement, created_at")
        .eq("link_id", link.id)
        .eq("is_evolution", true)
        .order("created_at", { ascending: false })
        .limit(5)
        .then((r) => r.data ?? [])
    : null;

  const motivos = atencaoMap.get(alunoId) ?? [];

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
    <main className="apex-ecra-claro mx-auto flex w-full max-w-lg flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/pt/alunos" className="apex-tipo-secundario self-start underline underline-offset-4" style={{ color: COR.fraco }}>
          ← Alunos
        </Link>
        <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          {aluno?.name ?? "Aluno"}
        </h1>
        {motivos.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {motivos.map((m) => (
              <span key={m} className="apex-chip-alerta apex-tipo-etiqueta">
                {MOTIVO_LABEL[m]}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <nav className="flex flex-wrap gap-4">
        <Link
          href={`/pt/aluno/${alunoId}/chat`}
          className="apex-tipo-secundario underline underline-offset-4"
          style={{ color: COR.tinta }}
        >
          Chat
        </Link>
        <Link
          href={`/pt/aluno/${alunoId}/videos`}
          className="apex-tipo-secundario underline underline-offset-4"
          style={{ color: COR.tinta }}
        >
          Vídeos
        </Link>
      </nav>

      <Metricas prs={prs ?? []} evolucao={evolucao} />

      <Historico sessoes={sessoes ?? []} />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
            {planoExistente ? "Editar plano" : "Atribuir plano"}
          </h2>
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            {planoExistente ? "Editar o plano que atribuíste a este aluno." : "Criar um plano para este aluno."}
          </p>
        </div>

        <EditorPlanoPt
          alunoId={alunoId}
          exercicios={exercicios}
          nomeInicial={planoExistente?.name ?? ""}
          diasIniciais={diasIniciais}
        />
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------

function Metricas({
  prs,
  evolucao,
}: {
  prs: { lift: string; value_kg: number }[];
  evolucao: { weight_kg: number | null; measurement: string | null; created_at: string }[] | null;
}) {
  if (prs.length === 0 && (evolucao == null || evolucao.length === 0)) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
        Métricas
      </h2>

      {prs.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Recordes pessoais
          </span>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {prs.map((pr) => (
              <span key={pr.lift} className="apex-tipo-secundario apex-tabular" style={{ color: COR.tinta }}>
                {LIFT_LABEL[pr.lift as Lift] ?? pr.lift}: <strong>{pr.value_kg} kg</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {evolucao == null ? (
        <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Sem permissão de evolução.
        </p>
      ) : evolucao.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Evolução recente
          </span>
          <div className="flex flex-col">
            {evolucao.map((e, i) => (
              <div key={i} className="flex items-center justify-between border-b py-1.5" style={{ borderColor: COR.linha }}>
                <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
                  {new Date(e.created_at).toLocaleDateString("pt-PT")}
                </span>
                <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.tinta }}>
                  {[e.weight_kg != null ? `${e.weight_kg} kg` : null, e.measurement].filter(Boolean).join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Historico({
  sessoes,
}: {
  sessoes: { title: string; completion: number | null; avg_rpe: number | null; week_number: number; created_at: string }[];
}) {
  if (sessoes.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
        Histórico
      </h2>
      <div className="flex flex-col">
        {sessoes.map((s, i) => (
          <div key={i} className="apex-linha-exercicio">
            <div className="apex-linha-exercicio__principal">
              <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
                {s.title}
              </span>
              <span className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
                {new Date(s.created_at).toLocaleDateString("pt-PT")} · semana {s.week_number}
              </span>
            </div>
            <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
              {s.completion != null ? `${Math.round(s.completion * 100)}%` : "—"}
              {s.avg_rpe != null ? ` · RPE ${s.avg_rpe.toFixed(1)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
