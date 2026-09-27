import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { janelaRecente } from "@/lib/treino/perfil";
import { carregarProgresso } from "@/lib/treino/progresso-dados";
import { MOTIVO_LABEL, type MotivoAtencao } from "@/lib/treino/atencao";
import { atencaoDosAlunos } from "@/lib/treino/atencao-dados";
import { carregarResumoAlunos, type ResumoAluno } from "@/lib/treino/resumo-alunos";
import { chaveSemanaIso } from "@/lib/treino/adesao-semanal";
import { sair } from "@/app/actions/auth";
import { responderPedido, revogarAcesso } from "@/app/actions/ligacoes";
import { Sino } from "../_ui/social/sino";
import { Sparkline } from "../_ui/treino/sparkline";
import { contarNaoLidas } from "@/lib/social/notificacoes-dados";
import { CodigoPt } from "./codigo-pt";
import { OMeuPt } from "./o-meu-pt";
import { CabecalhoAtleta } from "./atleta/cabecalho-atleta";
import { CartaoTreinoHoje } from "./atleta/cartao-treino-hoje";
import { CartaoProgresso } from "./atleta/cartao-progresso";
import { CartaoAtividade } from "./atleta/cartao-atividade";

export const metadata: Metadata = {
  title: "Painel · APEX",
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

  // Fuso fixo, como o resto da app (ver commit do fuso Europe/Lisbon) —
  // perto da meia-noite, o servidor em UTC mostrava o dia errado.
  const hoje = new Date().toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Lisbon",
  });

  return (
    <main className="apex-ecra-claro mx-auto flex w-full max-w-lg flex-col gap-6 px-5 pt-6 pb-8">
      {/* Safe area do topo (notch/Dynamic Island): tratada na própria
          classe .apex-ecra-claro (design.css). A de baixo: a barra de
          navegação inferior (_ui/navegacao), montada no layout.tsx. */}
      {perfil?.role === "atleta" || perfil?.role === "pt" ? (
        <CabecalhoAtleta
          nome={perfil.name}
          naoLidas={naoLidas}
          papel={perfil.role}
          etiqueta={perfil.role === "pt" ? hoje.charAt(0).toUpperCase() + hoje.slice(1) : undefined}
        />
      ) : (
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              APEX
            </p>
            <h1 className="apex-tipo-saudacao" style={{ color: COR.tinta }}>
              Perfil incompleto
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Sino naoLidas={naoLidas} />
            <form action={sair}>
              <button
                type="submit"
                className="apex-tipo-etiqueta border px-3"
                style={{ minHeight: 44, borderColor: COR.linha, color: COR.fraco }}
              >
                Terminar sessão
              </button>
            </form>
          </div>
        </header>
      )}

      {perfil?.role === "pt" ? (
        <SeccaoPt userId={user.id} ptCode={perfil.pt_code ?? null} />
      ) : perfil?.role === "atleta" ? (
        <SeccaoAtleta userId={user.id} />
      ) : (
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          O teu perfil ainda não está completo. Contacta o suporte.
        </p>
      )}
      {/* Termos/privacidade: só no rodapé global (ponto 22) — a secção
          "Definições" que os repetia aqui saiu; as definições a sério
          chegam com o perfil (Fase 3). */}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Atleta — "o que faço agora?" em dois segundos. Fase 1 (referencia/plano-
// execucao-apex.md, pontos 3/4/18): o PDF é UM cartão do plano, nunca o
// ecrã inteiro; treino de hoje é o herói; progresso e atividade resumidos.
// ---------------------------------------------------------------------------

async function SeccaoAtleta({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ sessoes, metricas }, feedbackRecente] = await Promise.all([
    carregarProgresso(supabase, userId),
    contarFeedbackRecente(supabase, userId),
  ]);

  return (
    // A fila de links (Plano · Chat · Vídeos · …) que servia de navegação
    // saiu: a navegação é a barra inferior (_ui/navegacao). Vídeos continua
    // no cartão do PT e na atividade; notificações, no sino; descobrir, no
    // separador Feed.
    <div className="flex flex-col gap-4">
      <CartaoTreinoHoje userId={userId} />
      <BlocoPtDoAtleta userId={userId} />
      <CartaoProgresso metricas={metricas} />
      <CartaoAtividade sessoes={sessoes} feedbackRecente={feedbackRecente} />
    </div>
  );
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
      <section className="apex-cartao">
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          O teu PT
        </h2>
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Ainda não tens um PT ligado.
        </p>
        <div className="flex flex-wrap gap-x-5">
          <Link href="/ligar" className="apex-tipo-secundario apex-link-toque underline underline-offset-4" style={{ color: COR.tinta }}>
            Ligar a um PT
          </Link>
          <Link href="/descobrir" className="apex-tipo-secundario apex-link-toque underline underline-offset-4" style={{ color: COR.tinta }}>
            Descobrir PTs
          </Link>
        </div>
      </section>
    );
  }

  if (ligacao.status === "pendente") {
    return (
      <section className="apex-cartao">
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
            className="apex-tipo-secundario apex-link-toque underline underline-offset-4"
            style={{ color: COR.fraco }}
          >
            Cancelar pedido
          </button>
        </form>
      </section>
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
      "id, status, scope_evolucao, scope_videos, scope_metricas, created_at, aluno:profiles!student_id(id, name, avatar_url)",
    )
    .eq("pt_id", userId)
    .eq("status", "ativo")
    .order("updated_at", { ascending: false })
    .overrideTypes<(Ligacao & { aluno: (PerfilRef & { avatar_url: string | null }) | null })[]>();

  const linkIds = (alunos ?? []).map((a) => a.id);
  const alunoIds = (alunos ?? []).map((a) => a.aluno?.id).filter((x): x is string => !!x);

  let mensagensPorLerRows: { sender_id: string }[] = [];
  let atencaoPorAluno = new Map<string, MotivoAtencao[]>();
  let resumoPorAluno = new Map<string, ResumoAluno>();
  let novosEsteMes = 0;
  let treinosConcluidosSemana = 0;

  if (alunoIds.length) {
    const corte30d = janelaRecente(30);
    // Semana de CALENDÁRIO, não 7 dias rolling — a mesma janela que o
    // sinal de adesão da linha usa (adesao-semanal.ts). As duas já
    // divergiram uma da outra ao vivo (100% no KPI, 33% na linha, para o
    // mesmo aluno, na mesma altura) e isso mina a confiança nos números
    // — nunca duas janelas diferentes para "esta semana".
    const semanaAtualChave = chaveSemanaIso(new Date().toISOString());
    const [{ data: msgs }, atencao, resumos, { data: sessoesJanela }] = await Promise.all([
      supabase
        .from("messages")
        .select("sender_id")
        .in("link_id", linkIds)
        .neq("sender_id", userId)
        .is("read_at", null),
      atencaoDosAlunos(supabase, alunoIds),
      carregarResumoAlunos(
        supabase,
        (alunos ?? [])
          .filter((a) => a.aluno?.id)
          .map((a) => ({ id: a.aluno!.id, nome: a.aluno!.name, avatarUrl: a.aluno!.avatar_url })),
      ),
      // "Esperados" (soma de diasPrevistosSemana dos resumos) só passou a
      // ser fiável desde a migração 019 — antes, um aluno com plano próprio
      // (gerado pelo motor) ficava invisível à RLS de training_plans e
      // contava sistematicamente "0 esperados". Ver apex-training-plans-rls.md.
      // janelaRecente(7) é só o limite do FETCH (cobre a semana ISO atual
      // mesmo no piorcaso, hoje=domingo); o filtro real é chaveSemanaIso.
      supabase.from("workout_sessions").select("user_id, performed_at").in("user_id", alunoIds).gte("performed_at", janelaRecente(7)),
    ]);

    mensagensPorLerRows = msgs ?? [];
    atencaoPorAluno = atencao;
    resumoPorAluno = new Map(resumos.map((r) => [r.id, r]));
    novosEsteMes = (alunos ?? []).filter((a) => a.created_at >= corte30d).length;
    treinosConcluidosSemana = (sessoesJanela ?? []).filter((s) => chaveSemanaIso(s.performed_at) === semanaAtualChave).length;
  }

  // Cabeçalho (data + "Olá, <nome>") é o CabecalhoAtleta partilhado, lá
  // em cima — antes, o PT tinha o NOME COMPLETO a 44px e logo a seguir um
  // segundo "Olá, <nome>" a 44px: dois títulos gigantes seguidos.
  return (
    <div className="flex flex-col gap-8">
      {pedidos && pedidos.length > 0 ? <BlocoPedidosPendentes pedidos={pedidos} /> : null}

      <KpisNegocio
        alunosAtivos={alunoIds.length}
        novosEsteMes={novosEsteMes}
        resumos={[...resumoPorAluno.values()]}
        treinosConcluidosSemana={treinosConcluidosSemana}
        mensagensPorLerRows={mensagensPorLerRows}
      />

      <BlocoAtencao alunos={alunos ?? []} atencaoPorAluno={atencaoPorAluno} />

      <ListaAlunos alunos={alunos ?? []} resumoPorAluno={resumoPorAluno} />

      <div className="flex flex-col gap-2">
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          O teu código
        </h2>
        <CodigoPt codigoInicial={ptCode} />
      </div>
      {/* Feed/descobrir: separador Feed da barra inferior; notificações:
          sino; editar perfil público: menu do avatar no cabeçalho. */}
    </div>
  );
}

function BlocoPedidosPendentes({ pedidos }: { pedidos: Ligacao[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
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
                className="apex-tipo-etiqueta border px-3"
                style={{ minHeight: 44, borderColor: COR.tinta, color: COR.tinta }}
              >
                Aceitar
              </button>
              <button
                name="accao"
                value="recusar"
                className="apex-tipo-etiqueta border px-3"
                style={{ minHeight: 44, borderColor: COR.linha, color: COR.fraco }}
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

// ---------------------------------------------------------------------------
// Resumo do negócio — 4 KPIs, só dados reais; variação só quando dá para
// a calcular com verdade (nunca "+0%" a fingir que sabemos algo que não
// sabemos).
// ---------------------------------------------------------------------------

function KpisNegocio({
  alunosAtivos,
  novosEsteMes,
  resumos,
  treinosConcluidosSemana,
  mensagensPorLerRows,
}: {
  alunosAtivos: number;
  novosEsteMes: number;
  resumos: ResumoAluno[];
  treinosConcluidosSemana: number;
  mensagensPorLerRows: { sender_id: string }[];
}) {
  // Esperados = soma dos dias de treino previstos nos planos ativos de
  // todos os alunos; quem não tem plano ativo conta 0, nunca parte a soma
  // (diasPrevistosSemana é number | null).
  const esperadosSemana = resumos.reduce((s, r) => s + (r.diasPrevistosSemana ?? 0), 0);
  const pctEsperados = esperadosSemana > 0 ? treinosConcluidosSemana / esperadosSemana : null;
  const comAdesao = resumos.filter((r) => r.adesaoMedia != null);
  const adesaoMedia =
    comAdesao.length > 0 ? comAdesao.reduce((s, r) => s + (r.adesaoMedia as number), 0) / comAdesao.length : null;

  const comparaveis = resumos.filter((r) => r.adesaoMedia != null && r.adesaoMediaAnterior != null);
  let variacaoAdesao: number | null = null;
  if (comparaveis.length > 0) {
    const atual = comparaveis.reduce((s, r) => s + (r.adesaoMedia as number), 0) / comparaveis.length;
    const anterior = comparaveis.reduce((s, r) => s + (r.adesaoMediaAnterior as number), 0) / comparaveis.length;
    if (anterior > 0) variacaoAdesao = (atual - anterior) / anterior;
  }

  const mensagensPorLer = mensagensPorLerRows.length;
  const alunosComMensagem = new Set(mensagensPorLerRows.map((m) => m.sender_id)).size;

  return (
    <div className="apex-kpis">
      <Kpi
        numero={String(alunosAtivos)}
        etiqueta="Alunos ativos"
        variacao={novosEsteMes > 0 ? `+${novosEsteMes} este mês` : null}
        positiva
      />
      <Kpi
        numero={`${treinosConcluidosSemana} de ${esperadosSemana}`}
        etiqueta="Treinos esta semana"
        variacao={pctEsperados != null ? `${Math.round(pctEsperados * 100)}%` : null}
        positiva={pctEsperados != null ? (pctEsperados >= 0.75 ? true : pctEsperados < 0.5 ? false : undefined) : undefined}
      />
      <Kpi
        numero={adesaoMedia != null ? `${Math.round(adesaoMedia * 100)}%` : "—"}
        etiqueta="Adesão média"
        variacao={
          variacaoAdesao != null
            ? `${variacaoAdesao >= 0 ? "+" : ""}${Math.round(variacaoAdesao * 100)}% vs. período anterior`
            : null
        }
        positiva={variacaoAdesao != null ? variacaoAdesao >= 0 : undefined}
      />
      <Kpi
        numero={String(mensagensPorLer)}
        etiqueta="Mensagens por ler"
        variacao={
          mensagensPorLer > 0 ? `${alunosComMensagem} aluno${alunosComMensagem === 1 ? "" : "s"}` : "Tudo lido"
        }
      />
    </div>
  );
}

function Kpi({
  numero,
  etiqueta,
  variacao,
  positiva,
}: {
  numero: string;
  etiqueta: string;
  variacao: string | null;
  positiva?: boolean;
}) {
  return (
    <div className="apex-kpi">
      <span className="apex-kpi__numero apex-tabular">{numero}</span>
      <span className="apex-kpi__etiqueta">{etiqueta}</span>
      {variacao ? (
        <span
          className="apex-kpi__variacao apex-tabular"
          style={{ color: positiva === undefined ? COR.fraco : positiva ? "var(--apex-positivo)" : "var(--apex-erro)" }}
        >
          {variacao}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Precisa de atenção — reusa atencaoDosAlunos; "está tudo em dia" quando
// não há ninguém, nunca um alerta inventado.
// ---------------------------------------------------------------------------

function BlocoAtencao({
  alunos,
  atencaoPorAluno,
}: {
  alunos: Ligacao[];
  atencaoPorAluno: Map<string, MotivoAtencao[]>;
}) {
  const comAtencao = alunos.filter((a) => a.aluno?.id && atencaoPorAluno.has(a.aluno.id));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
        Precisa de atenção
      </h2>
      {comAtencao.length === 0 ? (
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Está tudo em dia — nenhum aluno precisa de atenção agora.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {comAtencao.map((a) => {
            const motivos = atencaoPorAluno.get(a.aluno!.id)!;
            const grave = motivos.includes("dor_recorrente") || motivos.includes("inativo");
            return (
              <Link
                key={a.id}
                href={`/pt/aluno/${a.aluno!.id}`}
                className={grave ? "apex-alerta-card apex-alerta-card--erro" : "apex-alerta-card"}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="apex-tipo-nome-exercicio" style={{ color: grave ? "#9b2c1e" : "#8a5410" }}>
                    {a.aluno?.name ?? "Atleta"} · {motivos.map((m) => MOTIVO_LABEL[m]).join(", ")}
                  </span>
                  <span className="apex-tipo-secundario" style={{ color: grave ? "#9b2c1e" : "#8a5410", opacity: 0.85 }}>
                    Vê a ficha para os detalhes.
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Os meus alunos — lista curta com tendência real; "Ver todos" para a
// lista completa (/pt/alunos).
// ---------------------------------------------------------------------------

const MAX_ALUNOS_PREVIEW = 5;

function ListaAlunos({
  alunos,
  resumoPorAluno,
}: {
  alunos: Ligacao[];
  resumoPorAluno: Map<string, ResumoAluno>;
}) {
  if (alunos.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Os meus alunos
        </h2>
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Ainda não tens alunos ligados. Partilha o teu código (abaixo) ou espera que um atleta te encontre em{" "}
          <Link href="/descobrir" className="underline underline-offset-4" style={{ color: COR.tinta }}>
            Descobrir
          </Link>
          .
        </p>
      </section>
    );
  }

  const visiveis = alunos.slice(0, MAX_ALUNOS_PREVIEW);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Os meus alunos
        </h2>
        <Link href="/pt/alunos" className="apex-tipo-secundario apex-link-toque shrink-0 underline underline-offset-4" style={{ color: COR.tinta }}>
          Ver todos
        </Link>
      </div>
      <div className="flex flex-col">
        {visiveis.map((a) => {
          const resumo = a.aluno?.id ? resumoPorAluno.get(a.aluno.id) : undefined;
          return <LinhaAluno key={a.id} id={a.aluno?.id ?? a.id} nome={a.aluno?.name ?? "Atleta"} resumo={resumo} />;
        })}
      </div>
    </section>
  );
}

function LinhaAluno({ id, nome, resumo }: { id: string; nome: string; resumo: ResumoAluno | undefined }) {
  const estado = resumo?.estadoAdesao ?? "sem_dados";
  const pctAtual = resumo?.pctAtual ?? null;
  const corAdesao =
    estado === "sem_dados" ? COR.fraco : estado === "boa" ? "var(--apex-positivo)" : estado === "a_descer" ? "var(--apex-alerta)" : "var(--apex-erro)";
  const meta = [resumo?.planoNome, resumo?.semanaAtual != null ? `Semana ${resumo.semanaAtual}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/pt/aluno/${id}`} className="apex-aluno-linha">
      <div className="apex-avatar">
        {resumo?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resumo.avatarUrl} alt="" />
        ) : (
          <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            {nome.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="apex-tipo-nome-exercicio truncate" style={{ color: COR.tinta }}>
          {nome}
        </p>
        <p className="apex-tipo-etiqueta truncate" style={{ color: COR.fraco }}>
          {meta || "Sem plano ativo"}
        </p>
      </div>
      <Sparkline pontos={resumo?.pontosAdesao ?? []} estado={estado} />
      <div className="apex-aluno-linha__adesao">
        <div className="apex-aluno-linha__adesao-valor apex-tabular" style={{ color: corAdesao }}>
          {pctAtual != null ? `${Math.round(pctAtual * 100)}%` : "—"}
        </div>
        <div className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          adesão
        </div>
      </div>
    </Link>
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
