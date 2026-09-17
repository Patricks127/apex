import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPlanoAtivo, treinoDeHojeFeito, janelaRecente } from "@/lib/treino/perfil";
import { indiceDiaSemanaHoje, proximoDiaDeTreino, construirLinhaTempo } from "@/lib/treino/linha-tempo";
import { MOTIVO_LABEL, type MotivoAtencao } from "@/lib/treino/atencao";
import { atencaoDosAlunos } from "@/lib/treino/atencao-dados";
import type { DiaGerado } from "@/lib/motor";
import { sair } from "@/app/actions/auth";
import { responderPedido, revogarAcesso } from "@/app/actions/ligacoes";
import { BlocoDados } from "../_ui/design/bloco-dados";
import { Sino } from "../_ui/social/sino";
import { contarNaoLidas } from "@/lib/social/notificacoes-dados";
import { CodigoPt } from "./codigo-pt";
import { OMeuPt } from "./o-meu-pt";

export const metadata: Metadata = {
  title: "Painel · APEX",
};

const NOME_PAPEL: Record<string, string> = {
  atleta: "Atleta",
  pt: "Personal Trainer",
};

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
} as const;

type PerfilRef = { id: string; name: string | null } | null;

type Ligacao = {
  id: string;
  status: string;
  scope_evolucao: boolean;
  scope_videos: boolean;
  scope_metricas: boolean;
  created_at: string;
  pt: PerfilRef;
  aluno: PerfilRef;
};

export default async function PainelPage() {
  const supabase = await createClient();

  // getUser() valida o token no servidor. Nunca usar getSession() para decidir acessos.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [{ data: perfil }, naoLidas] = await Promise.all([
    supabase.from("profiles").select("name, role, pt_code").eq("id", user.id).single(),
    contarNaoLidas(supabase, user.id),
  ]);

  return (
    <main className="apex-ecra-claro mx-auto flex w-full max-w-lg flex-col gap-8 px-5 py-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            APEX
          </p>
          <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
            {perfil?.name ?? "—"}
          </h1>
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            {perfil?.role ? (NOME_PAPEL[perfil.role] ?? perfil.role) : "Perfil incompleto"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Sino naoLidas={naoLidas} />
          <form action={sair}>
            <button
              type="submit"
              className="apex-tipo-etiqueta border px-3 py-1.5"
              style={{ borderColor: COR.linha, color: COR.fraco }}
            >
              Terminar sessão
            </button>
          </form>
        </div>
      </header>

      {perfil?.role === "pt" ? (
        <SeccaoPt userId={user.id} ptCode={perfil.pt_code ?? null} />
      ) : perfil?.role === "atleta" ? (
        <SeccaoAtleta userId={user.id} />
      ) : (
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          O teu perfil ainda não está completo. Contacta o suporte.
        </p>
      )}

      <section className="mt-auto flex flex-col gap-1.5 border-t pt-4" style={{ borderColor: COR.linha }}>
        <h2 className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Definições
        </h2>
        <div className="flex gap-4">
          <Link href="/termos" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.fraco }}>
            Termos de Utilização
          </Link>
          <Link href="/privacidade" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.fraco }}>
            Política de Privacidade
          </Link>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Atleta — "o que faço agora?" em dois segundos
// ---------------------------------------------------------------------------

async function SeccaoAtleta({ userId }: { userId: string }) {
  return (
    <div className="flex flex-col gap-8">
      <BlocoTreinoHoje userId={userId} />
      <BlocoPtDoAtleta userId={userId} />
      <nav className="flex flex-wrap gap-4 border-t pt-4" style={{ borderColor: COR.linha }}>
        <Link href="/plano" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Plano
        </Link>
        <Link href="/chat" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Chat
        </Link>
        <Link href="/videos" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Vídeos
        </Link>
        <Link href="/progresso" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Progresso
        </Link>
        <Link href="/feed" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Feed
        </Link>
        <Link href="/descobrir" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Descobrir
        </Link>
        <Link href="/notificacoes" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Notificações
        </Link>
      </nav>
    </div>
  );
}

async function BlocoTreinoHoje({ userId }: { userId: string }) {
  const supabase = await createClient();
  const planoAtivo = await carregarPlanoAtivo(supabase, userId);

  if (!planoAtivo) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          Ainda sem plano
        </h2>
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Responde a seis perguntas rápidas e o motor gera a tua semana.
        </p>
        <Link href="/plano" className="apex-botao apex-botao--claro" style={{ marginTop: "var(--apex-space-2)" }}>
          Começar
        </Link>
      </section>
    );
  }

  const dias = planoAtivo.days.days;
  const indiceHoje = indiceDiaSemanaHoje();
  const diaHoje = dias[indiceHoje];

  const semanaAtual = planoAtivo.progression?.week ?? 1;
  const nPrevistos = dias.filter((d) => !d.rest).length;
  const { count: nFeitosCru } = await supabase
    .from("workout_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("week_number", semanaAtual);
  const nFeitos = Math.min(nPrevistos, nFeitosCru ?? 0);
  const percursoSemana = nPrevistos > 0 ? Math.round((nFeitos / nPrevistos) * 100) : 0;

  return (
    <section className="flex flex-col gap-5">
      {diaHoje.rest ? (
        <DescansoHoje dias={dias} indiceHoje={indiceHoje} />
      ) : (
        <TreinoHoje userId={userId} dia={diaHoje} indiceHoje={indiceHoje} />
      )}

      {nPrevistos > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              Esta semana
            </span>
            <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
              {nFeitos} de {nPrevistos}
            </span>
          </div>
          <div className="apex-progresso-claro">
            <div className="apex-progresso-claro__preenchido" style={{ width: `${percursoSemana}%` }} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

async function TreinoHoje({
  userId,
  dia,
  indiceHoje,
}: {
  userId: string;
  dia: DiaGerado;
  indiceHoje: number;
}) {
  const supabase = await createClient();
  const titulo = dia.title ?? "Treino";
  const feito = await treinoDeHojeFeito(supabase, userId, titulo);
  const { duracaoTotalMin } = construirLinhaTempo(dia, { estadoDia: "neutro" });
  const nExercicios = dia.exercises?.length ?? 0;

  if (feito) {
    return (
      <div className="flex flex-col gap-1">
        <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Hoje · {dia.dayName}
        </span>
        <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          {titulo}
        </h2>
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Já treinaste hoje. Bom trabalho.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Hoje · {dia.dayName}
        </span>
        <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          {titulo}
        </h2>
      </div>
      <BlocoDados
        itens={[
          { valor: String(nExercicios), etiqueta: "exercícios" },
          { valor: `${duracaoTotalMin}′`, etiqueta: "estimado" },
        ]}
      />
      <Link href={`/treino/${indiceHoje}`} className="apex-botao apex-botao--claro">
        Começar treino
      </Link>
    </div>
  );
}

function DescansoHoje({ dias, indiceHoje }: { dias: DiaGerado[]; indiceHoje: number }) {
  const proximo = proximoDiaDeTreino(dias, indiceHoje);
  return (
    <div className="flex flex-col gap-1">
      <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
        Hoje
      </span>
      <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
        Descanso
      </h2>
      <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
        {proximo
          ? `Próximo treino ${rotuloOffset(proximo.offset)}: ${proximo.dia.title} (${proximo.dia.dayName}).`
          : "Sem treinos marcados esta semana."}
      </p>
    </div>
  );
}

function rotuloOffset(offset: number): string {
  if (offset === 1) return "amanhã";
  if (offset === 2) return "depois de amanhã";
  return `daqui a ${offset} dias`;
}

async function BlocoPtDoAtleta({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: ligacao } = await supabase
    .from("pt_links")
    .select("id, status, scope_evolucao, scope_videos, scope_metricas, created_at, pt:profiles!pt_id(id, name, pt_code)")
    .eq("student_id", userId)
    .in("status", ["ativo", "pendente"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<Ligacao & { pt: { id: string; name: string | null; pt_code: string | null } | null }>();

  if (!ligacao) {
    return (
      <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
        Ainda não tens um PT ligado.{" "}
        <Link href="/ligar" className="underline underline-offset-4" style={{ color: COR.tinta }}>
          Ligar a um PT
        </Link>{" "}
        ou{" "}
        <Link href="/descobrir" className="underline underline-offset-4" style={{ color: COR.tinta }}>
          descobrir
        </Link>
        .
      </p>
    );
  }

  if (ligacao.status === "pendente") {
    return (
      <div className="flex flex-col gap-2">
        <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Pedido enviado
        </span>
        <p className="apex-tipo-corpo" style={{ color: COR.tinta }}>
          {ligacao.pt?.name ?? "PT"} — à espera de resposta.
        </p>
        <form action={revogarAcesso}>
          <input type="hidden" name="link_id" value={ligacao.id} />
          <button
            type="submit"
            className="apex-tipo-secundario underline underline-offset-4"
            style={{ color: COR.fraco }}
          >
            Cancelar pedido
          </button>
        </form>
      </div>
    );
  }

  const [{ count: mensagensPorLer }, feedbackRecente] = await Promise.all([
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("link_id", ligacao.id)
      .neq("sender_id", userId)
      .is("read_at", null),
    contarFeedbackRecente(supabase, userId),
  ]);

  return (
    <OMeuPt
      linkId={ligacao.id}
      ptNome={ligacao.pt?.name ?? "PT"}
      ptCode={ligacao.pt?.pt_code ?? null}
      evolucao={ligacao.scope_evolucao}
      videos={ligacao.scope_videos}
      metricas={ligacao.scope_metricas}
      mensagensPorLer={mensagensPorLer ?? 0}
      feedbackRecente={feedbackRecente}
    />
  );
}

/** "Feedback recente" (últimos 7 dias) — não "não lido": video_feedback não
 *  tem marca de leitura, por isso não afirmamos uma precisão que não
 *  temos. */
async function contarFeedbackRecente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number> {
  const { data: videos } = await supabase.from("training_videos").select("id").eq("user_id", userId);
  const ids = (videos ?? []).map((v) => v.id);
  if (!ids.length) return 0;
  const { count } = await supabase
    .from("video_feedback")
    .select("id", { count: "exact", head: true })
    .in("video_id", ids)
    .gte("created_at", janelaRecente(7));
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// PT
// ---------------------------------------------------------------------------


async function SeccaoPt({ userId, ptCode }: { userId: string; ptCode: string | null }) {
  const supabase = await createClient();

  const { data: pedidos } = await supabase
    .from("pt_links")
    .select(
      "id, status, scope_evolucao, scope_videos, scope_metricas, created_at, aluno:profiles!student_id(id, name)",
    )
    .eq("pt_id", userId)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .overrideTypes<Ligacao[]>();

  const { data: alunos } = await supabase
    .from("pt_links")
    .select(
      "id, status, scope_evolucao, scope_videos, scope_metricas, created_at, aluno:profiles!student_id(id, name)",
    )
    .eq("pt_id", userId)
    .eq("status", "ativo")
    .order("updated_at", { ascending: false })
    .overrideTypes<Ligacao[]>();

  const linkIds = (alunos ?? []).map((a) => a.id);
  const alunoIds = (alunos ?? []).map((a) => a.aluno?.id).filter((x): x is string => !!x);

  let videosPorVer = 0;
  let mensagensPorLer = 0;
  let atencaoPorAluno = new Map<string, MotivoAtencao[]>();

  if (alunoIds.length) {
    const [{ data: vids }, { count: msgsCount }, atencao] = await Promise.all([
      supabase.from("training_videos").select("id").in("user_id", alunoIds),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("link_id", linkIds)
        .neq("sender_id", userId)
        .is("read_at", null),
      atencaoDosAlunos(supabase, alunoIds),
    ]);

    mensagensPorLer = msgsCount ?? 0;
    atencaoPorAluno = atencao;

    const vidIds = (vids ?? []).map((v) => v.id);
    if (vidIds.length) {
      const { data: fbs } = await supabase.from("video_feedback").select("video_id").in("video_id", vidIds);
      const comFeedback = new Set((fbs ?? []).map((f) => f.video_id));
      videosPorVer = vidIds.filter((id) => !comFeedback.has(id)).length;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <BlocoPrincipalPt pedidos={pedidos ?? []} alunos={alunos ?? []} atencaoPorAluno={atencaoPorAluno} />

      <div className="flex flex-col">
        <Link href="/chat" className="apex-linha-exercicio" style={{ textDecoration: "none" }}>
          <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
            Mensagens
          </span>
          <span className="apex-tabular" style={{ color: mensagensPorLer > 0 ? COR.tinta : COR.fraco }}>
            {mensagensPorLer > 0 ? `${mensagensPorLer} por ler` : "Tudo lido"}
          </span>
        </Link>
        <Link href="/videos" className="apex-linha-exercicio" style={{ textDecoration: "none" }}>
          <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
            Vídeos
          </span>
          <span className="apex-tabular" style={{ color: videosPorVer > 0 ? COR.tinta : COR.fraco }}>
            {videosPorVer > 0 ? `${videosPorVer} por rever` : "Tudo revisto"}
          </span>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          O teu código
        </h2>
        <CodigoPt codigoInicial={ptCode} />
      </div>

      <nav className="flex flex-wrap gap-4" style={{ color: COR.tinta }}>
        <Link href="/perfil/editar" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Editar o meu perfil público
        </Link>
        <Link href="/feed" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Feed
        </Link>
        <Link href="/descobrir" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Descobrir
        </Link>
        <Link href="/notificacoes" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Notificações
        </Link>
      </nav>

      <ListaAlunos alunos={alunos ?? []} />
    </div>
  );
}

function BlocoPrincipalPt({
  pedidos,
  alunos,
  atencaoPorAluno,
}: {
  pedidos: Ligacao[];
  alunos: Ligacao[];
  atencaoPorAluno: Map<string, MotivoAtencao[]>;
}) {
  if (pedidos.length > 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          {pedidos.length} pedido{pedidos.length > 1 ? "s" : ""} por responder
        </h2>
        <div className="flex flex-col">
          {pedidos.map((p) => (
            <div key={p.id} className="apex-linha-exercicio" style={{ alignItems: "flex-start" }}>
              <div className="apex-linha-exercicio__principal">
                <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
                  {p.aluno?.name ?? "Atleta"}
                </span>
                <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
                  Quer autorizar: <Scopes l={p} />
                </span>
              </div>
              <form action={responderPedido} className="flex shrink-0 gap-2">
                <input type="hidden" name="link_id" value={p.id} />
                <button
                  name="accao"
                  value="aceitar"
                  className="apex-tipo-etiqueta border px-2.5 py-1.5"
                  style={{ borderColor: COR.tinta, color: COR.tinta }}
                >
                  Aceitar
                </button>
                <button
                  name="accao"
                  value="recusar"
                  className="apex-tipo-etiqueta border px-2.5 py-1.5"
                  style={{ borderColor: COR.linha, color: COR.fraco }}
                >
                  Recusar
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const comAtencao = alunos.filter((a) => a.aluno?.id && atencaoPorAluno.has(a.aluno.id));

  if (comAtencao.length > 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          {comAtencao.length} aluno{comAtencao.length > 1 ? "s" : ""} a precisar de atenção
        </h2>
        <div className="flex flex-col">
          {comAtencao.map((a) => (
            <Link
              key={a.id}
              href={`/pt/aluno/${a.aluno!.id}`}
              className="apex-linha-exercicio"
              style={{ textDecoration: "none" }}
            >
              <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
                {a.aluno?.name ?? "Atleta"}
              </span>
              <span className="flex gap-1.5">
                {atencaoPorAluno.get(a.aluno!.id)!.map((m) => (
                  <span key={m} className="apex-chip-alerta apex-tipo-etiqueta">
                    {MOTIVO_LABEL[m]}
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-1">
      <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
        Está tudo em dia
      </h2>
      <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
        Nenhum aluno precisa de atenção agora.
      </p>
    </section>
  );
}

function ListaAlunos({ alunos }: { alunos: Ligacao[] }) {
  return (
    <div className="flex items-baseline justify-between border-t pt-4" style={{ borderColor: COR.linha }}>
      <span className="apex-tipo-secundario" style={{ color: COR.fraco }}>
        {alunos.length === 0
          ? "Ainda não tens alunos ligados."
          : `${alunos.length} aluno${alunos.length > 1 ? "s" : ""} ligado${alunos.length > 1 ? "s" : ""}`}
      </span>
      {alunos.length > 0 ? (
        <Link href="/pt/alunos" className="apex-tipo-secundario underline underline-offset-4" style={{ color: COR.tinta }}>
          Ver todos
        </Link>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Scopes({ l }: { l: Pick<Ligacao, "scope_evolucao" | "scope_videos" | "scope_metricas"> }) {
  const ativos = [
    "treinos",
    l.scope_evolucao && "evolução",
    l.scope_videos && "vídeos",
    l.scope_metricas && "métricas",
  ].filter(Boolean) as string[];
  return <span style={{ color: COR.fraco }}>{ativos.join(", ")}</span>;
}
