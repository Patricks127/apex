import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXERCICIOS, MUSCULO_LABEL } from "@/lib/motor2";
import { type PlanoGerado } from "@/lib/motor";
import { atencaoDosAlunos } from "@/lib/treino/atencao-dados";
import { MOTIVO_LABEL } from "@/lib/treino/atencao";
import { carregarPlanoAtivo } from "@/lib/treino/perfil";
import { formatarData } from "@/lib/fuso";
import { carregarProgresso } from "@/lib/treino/progresso-dados";
import { pontosAdesaoComFallback } from "@/lib/treino/adesao-semanal";
import { apagarPlanoDocumento } from "@/app/actions/plan-documents";
import { EditorPlanoPt, type ExercicioPicker, type DiaEditorInicial } from "./editor-plano-pt";
import { SeccaoAdesaoSemanal, SeccaoForcaLeitura, SeccaoVolumeLeitura, SeccaoMetricasLeitura } from "./graficos-aluno";
import { AnexarPlanoForm } from "./anexar-plano-form";
import { formatarKg, formatarNumero } from "@/lib/formato";

const JANELAS_ADESAO_FICHA = 12; // mais história do que a linha do painel (6) — a ficha tem espaço

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
    .select("id, scope_treinos, scope_evolucao, scope_metricas")
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

  const [{ data: planoExistente }, atencaoMap, planoAtivo, progresso, { data: documentos }] = await Promise.all([
    supabase
      .from("training_plans")
      .select("name, days")
      .eq("owner_id", user.id)
      .eq("student_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    atencaoDosAlunos(supabase, [alunoId]),
    // Plano ATIVO real do aluno (próprio ou de qualquer PT, ver migração
    // 019) — só para saber os dias previstos/semana da adesão abaixo.
    // Diferente de `planoExistente`, que é sempre o plano que ESTE PT
    // atribuiu (para pré-preencher o editor), possa ou não ser o ativo.
    carregarPlanoAtivo(supabase, alunoId),
    carregarProgresso(supabase, alunoId),
    // Planos em PDF anexados a este aluno — de qualquer PT com scope
    // (migração 020, mesma decisão consciente da 019: histórico inclui
    // anexos de um PT anterior já revogado, ver decisions-and-principles.md).
    supabase
      .from("plan_documents")
      .select("id, pt_id, file_name, size_bytes, storage_path, created_at")
      .eq("student_id", alunoId)
      .order("created_at", { ascending: false }),
  ]);

  const documentosComUrl = await Promise.all(
    (documentos ?? []).map(async (d) => {
      const { data: assinado } = await supabase.storage
        .from("plan-documents")
        .createSignedUrl(d.storage_path, 60 * 60);
      return {
        id: d.id as string,
        nomeFicheiro: d.file_name as string,
        sizeBytes: d.size_bytes as number,
        createdAt: d.created_at as string,
        souEuQueAnexei: d.pt_id === user.id,
        url: assinado?.signedUrl ?? null,
      };
    }),
  );

  const diasPrevistosSemana = planoAtivo ? planoAtivo.days.days.filter((d) => !d.rest).length : null;
  // Fallback binário sem plano estruturado (inclui PDF) — mesma porta que
  // a linha do painel usa, para nunca divergirem. Ver adesao-semanal.ts.
  const pontosAdesao = pontosAdesaoComFallback(
    progresso.sessoes.map((s) => ({ performedAt: s.performedAt })),
    diasPrevistosSemana,
    JANELAS_ADESAO_FICHA,
  );

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

      <div className="flex flex-col gap-1">
        <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          Dar um plano
        </h2>
        <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
          Dois caminhos independentes — escolhe um, ou os dois (o PDF manda sempre que existir, ver /plano do aluno).
        </p>
      </div>

      <SeccaoPlanosDocumento alunoId={alunoId} documentos={documentosComUrl} />

      <section className="flex flex-col gap-4 border-t pt-6" style={{ borderColor: COR.linha }}>
        <div>
          <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
            Criar plano na app
          </h2>
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            {planoExistente
              ? "Editar o plano que atribuíste a este aluno."
              : "O editor completo, dia a dia — precisa de pelo menos um dia com exercícios antes de gravar."}
          </p>
        </div>

        <EditorPlanoPt
          alunoId={alunoId}
          exercicios={exercicios}
          nomeInicial={planoExistente?.name ?? ""}
          diasIniciais={diasIniciais}
        />
      </section>

      <SeccaoAdesaoSemanal pontos={pontosAdesao} />

      <SeccaoForcaLeitura recordes={progresso.recordes} />

      <SeccaoVolumeLeitura sessoes={progresso.sessoes} />

      {link.scope_metricas ? (
        <SeccaoMetricasLeitura metricas={progresso.metricas} />
      ) : (
        <section className="flex flex-col gap-1">
          <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
            Peso e medidas
          </h2>
          <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Sem permissão de métricas.
          </p>
        </section>
      )}

      <Evolucao evolucao={evolucao} />

      <Historico sessoes={progresso.sessoes.slice(0, 8)} />
    </main>
  );
}

// ---------------------------------------------------------------------------

type PlanoDocumento = {
  id: string;
  nomeFicheiro: string;
  sizeBytes: number;
  createdAt: string;
  souEuQueAnexei: boolean;
  url: string | null;
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${formatarNumero(bytes / (1024 * 1024), 1)} MB`;
}

/**
 * Caminho 1 de 2 para dar um plano — completamente independente do editor
 * estruturado abaixo (secção própria, form próprio, Server Action própria,
 * sem validação de dias nenhuma). O caminho rápido: o PT já tem o plano
 * feito, anexa o ficheiro, a aluna vê-o de imediato. Qualquer PT com scope
 * vê o histórico (mesma decisão da 019), mas só quem anexou tem o botão de
 * apagar — a RLS já bloquearia os outros, isto é só não mostrar um botão
 * que nunca funcionaria.
 */
function SeccaoPlanosDocumento({ alunoId, documentos }: { alunoId: string; documentos: PlanoDocumento[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Anexar plano em PDF
        </h2>
        <p className="apex-tipo-secundario" style={{ color: COR.fraco, marginTop: 4 }}>
          O caminho rápido — já tens o plano feito, anexa o ficheiro e a aluna vê-o de imediato.
        </p>
      </div>

      {documentos.length > 0 ? (
        <div className="flex flex-col">
          {documentos.map((d) => (
            <div key={d.id} className="apex-linha-exercicio">
              <div className="apex-linha-exercicio__principal">
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apex-tipo-nome-exercicio underline underline-offset-4"
                    style={{ color: COR.tinta }}
                  >
                    {d.nomeFicheiro}
                  </a>
                ) : (
                  <span className="apex-tipo-nome-exercicio" style={{ color: COR.fraco }}>
                    {d.nomeFicheiro} (link indisponível)
                  </span>
                )}
                <span className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
                  {formatarData(d.createdAt)} · {formatarTamanho(d.sizeBytes)}
                </span>
              </div>
              {d.souEuQueAnexei ? (
                <form action={apagarPlanoDocumento}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="aluno_id" value={alunoId} />
                  <button
                    type="submit"
                    className="apex-tipo-etiqueta shrink-0 border px-2.5 py-1.5"
                    style={{ borderColor: COR.linha, color: COR.fraco }}
                  >
                    Apagar
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <AnexarPlanoForm alunoId={alunoId} />
    </section>
  );
}

// Fotos de evolução (chat, is_evolution) — diferente de "Peso e medidas"
// acima (essa é o registo estruturado de /progresso, gráfico com números).
// Recordes pessoais já não aparecem aqui em lista plana — têm a secção
// "Força" acima, com gráfico e o valor atual junto.
function Evolucao({
  evolucao,
}: {
  evolucao: { weight_kg: number | null; measurement: string | null; created_at: string }[] | null;
}) {
  if (evolucao == null) {
    return (
      <section className="flex flex-col gap-1">
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Fotos de evolução
        </h2>
        <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Sem permissão de evolução.
        </p>
      </section>
    );
  }
  if (evolucao.length === 0) return null;

  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
        Fotos de evolução
      </h2>
      <div className="flex flex-col">
        {evolucao.map((e, i) => (
          <div key={i} className="flex items-center justify-between border-b py-1.5" style={{ borderColor: COR.linha }}>
            <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
              {formatarData(e.created_at)}
            </span>
            <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.tinta }}>
              {[e.weight_kg != null ? formatarKg(e.weight_kg) : null, e.measurement].filter(Boolean).join(" · ")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Historico({
  sessoes,
}: {
  sessoes: { title: string; completion: number | null; avgRpe: number | null; weekNumber: number | null; performedAt: string }[];
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
                {formatarData(s.performedAt)}
                {s.weekNumber != null ? ` · semana ${s.weekNumber}` : ""}
              </span>
            </div>
            <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
              {s.completion != null ? `${Math.round(s.completion * 100)}%` : "—"}
              {s.avgRpe != null ? ` · RPE médio ${formatarNumero(s.avgRpe, 1)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
