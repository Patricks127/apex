"use client";

import { useMemo, useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CabecalhoEcra } from "@/app/_ui/design/cabecalho-ecra";
import { LIFT_LABEL, INJURIES, type Lift } from "@/lib/motor";
import { marcarNovosRecordes } from "@/lib/treino/marcos";
import { agruparVolumePorSemana } from "@/lib/treino/volume-historico";
import { GraficoForca, GraficoMetrica, GraficoVolume } from "@/app/_ui/treino/graficos-progresso";
import { registarRecorde, registarMetrica, type EstadoProgresso } from "@/app/actions/progresso";
import { METRICAS, type MetricaId } from "@/lib/treino/metricas";
import { BlocoImc } from "@/app/_ui/treino/bloco-imc";
import type { RecordePessoal, MetricaCorporal, SessaoHistorico } from "@/lib/treino/progresso-dados";

import { FUSO } from "@/lib/fuso";
import { formatarKg, formatarNumero, formatarReservaMedia } from "@/lib/formato";
import { FraseLeitura } from "@/app/_ui/treino/frase-leitura";
import { SeletorPeriodo, SemDadosNoPeriodo } from "@/app/_ui/treino/seletor-periodo";
import {
  PERIODO_OMISSAO,
  filtrarPeriodo,
  inicioPeriodo,
  minDiasTendencia,
  periodo,
  type PeriodoId,
} from "@/lib/treino/periodos";
import { leituraForca, leituraMetrica, leituraVolume } from "@/lib/treino/leituras";
const COR = {
  tinta: "var(--apex-tinta)",
  branco: "var(--apex-branco)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
  fundo: "var(--apex-cinza-fundo)",
  azul: "var(--apex-azul)",
  erro: "var(--apex-erro)",
} as const;

const LIFTS = Object.keys(LIFT_LABEL) as Lift[];
const METRICA_IDS = Object.keys(METRICAS) as MetricaId[];
const ZONE_LABEL = Object.fromEntries(INJURIES.map((z) => [z.id, z.label])) as Record<string, string>;
const EFFORT_LABEL: Record<string, string> = {
  abaixo: "Abaixo do esperado",
  equilibrado: "Equilibrado",
  limite: "No limite",
  passei: "Passei-me",
};

// Fuso FIXO — sem timeZone explícito, esta data (histórico de sessões,
// visível logo no primeiro render) divergia entre o servidor (Vercel, UTC)
// e o telemóvel de quem usa a app (Portugal) perto da meia-noite, e o
// React acusava isso como erro de hidratação (#418).
// FUSO: fonte única em src/lib/fuso.ts

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short", timeZone: FUSO });

export function ProgressoView({
  recordes,
  metricas,
  sessoes,
}: {
  recordes: RecordePessoal[];
  metricas: MetricaCorporal[];
  sessoes: SessaoHistorico[];
}) {
  const router = useRouter();
  const aoGravado = () => router.refresh();
  // UM período para todos os gráficos e frases da página
  const [periodoId, setPeriodoId] = useState<PeriodoId>(PERIODO_OMISSAO);

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoEcra marca="APEX" direita="progresso" />
      {/* flex-wrap: num SE de 320px o link desce para baixo do título em vez
          de o apertar (o título tem overflow-wrap: anywhere — partia a palavra). */}
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          Progresso
        </h1>
        {/* Único acesso garantido a /videos para quem NÃO tem PT (o cartão
            do PT no painel só existe com PT ligado; a atividade só mostra o
            link com feedback novo). O separador Progresso já fica ativo em
            /videos. */}
        <Link href="/videos" className="apex-tipo-secundario apex-link-toque shrink-0 underline underline-offset-4" style={{ color: COR.tinta }}>
          Vídeos de treino
        </Link>
      </div>

      <SeletorPeriodo valor={periodoId} aoMudar={setPeriodoId} />

      <SeccaoForca recordes={recordes} aoGravado={aoGravado} periodoId={periodoId} />
      <SeccaoMetricas metricas={metricas} aoGravado={aoGravado} periodoId={periodoId} />
      <SeccaoVolume sessoes={sessoes} periodoId={periodoId} />
      <SeccaoHistorico sessoes={sessoes} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Força — evolução dos recordes pessoais (1RM)
// ---------------------------------------------------------------------------

function SeccaoForca({
  recordes,
  aoGravado,
  periodoId,
}: {
  recordes: RecordePessoal[];
  aoGravado: () => void;
  periodoId: PeriodoId;
}) {
  const [lift, setLift] = useState<Lift>("agachamento");

  // "novo recorde" decide-se contra TODO o histórico; só depois se recorta
  // o período (um ponto não passa a "recorde" por os anteriores ficarem
  // fora da janela).
  const todos = useMemo(() => {
    const desteLevantamento = recordes.filter((r) => r.lift === lift);
    return marcarNovosRecordes(
      desteLevantamento,
      (r) => r.lift,
      (r) => r.valueKg,
      (r) => r.recordedAt,
    );
  }, [recordes, lift]);
  const pontos = useMemo(() => filtrarPeriodo(todos, (r) => r.recordedAt, periodoId), [todos, periodoId]);

  const ultimo = todos.at(-1);

  return (
    <section>
      <h2 className="apex-tipo-titulo-seccao" style={{ color: COR.tinta }}>
        Força
      </h2>
      <p className="apex-tipo-secundario" style={{ color: COR.fraco, marginTop: 4 }}>
        Evolução do 1RM. ▪ testado no ginásio · ○ estimado a partir do treino ao vivo.
      </p>

      {/* desliza: 4 levantamentos ("Levantamento terra", "Press militar")
          não cabem em divisões iguais num iPhone SE — saíam do ecrã */}
      <div className="apex-abas apex-abas--scroll mt-3">
        {LIFTS.map((l) => (
          <button
            key={l}
            type="button"
            className="apex-aba"
            data-ativa={l === lift}
            onClick={() => setLift(l)}
          >
            {LIFT_LABEL[l]}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {todos.length === 0 ? (
          <div className="apex-grafico__vazio apex-tipo-secundario">
            Ainda sem recordes registados para {LIFT_LABEL[lift].toLowerCase()}.
          </div>
        ) : pontos.length === 0 ? (
          <SemDadosNoPeriodo oque={`de ${LIFT_LABEL[lift].toLowerCase()}`} nomePeriodo={periodo(periodoId).nome} />
        ) : (
          <GraficoForca pontos={pontos} />
        )}
      </div>

      <FraseLeitura
        leitura={leituraForca(LIFT_LABEL[lift], pontos, "atleta", { minDias: minDiasTendencia(periodoId) })}
        temDados={pontos.length > 0}
      />

      {ultimo ? (
        <p className="apex-tipo-corpo apex-tabular mt-2" style={{ color: COR.tinta }}>
          Atual: {formatarKg(ultimo.valueKg)}
          {ultimo.source === "auto" ? (
            <span className="apex-tipo-secundario" style={{ color: COR.fraco }}>
              {" "}
              (estimativa do treino, não testado)
            </span>
          ) : null}
        </p>
      ) : null}

      <FormRecorde liftInicial={lift} aoGravado={aoGravado} />
    </section>
  );
}

function FormRecorde({ liftInicial, aoGravado }: { liftInicial: Lift; aoGravado: () => void }) {
  const [estado, submeter, aEnviar] = useActionState<EstadoProgresso, FormData>(registarRecorde, {});

  return (
    <form
      action={(fd) => {
        submeter(fd);
        aoGravado();
      }}
      className="apex-form-registo mt-3"
    >
      <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
        Registar recorde testado
      </p>
      <div className="apex-form-registo__linha">
        <select name="lift" defaultValue={liftInicial}>
          {LIFTS.map((l) => (
            <option key={l} value={l}>
              {LIFT_LABEL[l]}
            </option>
          ))}
        </select>
        {/* texto + teclado decimal, não type="number": com vírgula ("142,5"), o
            Safari pode dar o campo como vazio. O servidor lê vírgula ou ponto. */}
        <input name="value_kg" type="text" inputMode="decimal" autoComplete="off" placeholder="kg, ex.: 42,5" aria-label="Carga em kg" required />
      </div>
      {estado.erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
          {estado.erro}
        </p>
      ) : null}
      <button type="submit" disabled={aEnviar} className="apex-botao apex-botao--claro" style={{ width: "auto", padding: "10px 20px" }}>
        {aEnviar ? "A guardar…" : "Guardar recorde"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Peso e medidas corporais
// ---------------------------------------------------------------------------

function SeccaoMetricas({
  metricas,
  aoGravado,
  periodoId,
}: {
  metricas: MetricaCorporal[];
  aoGravado: () => void;
  periodoId: PeriodoId;
}) {
  // UM estado para o separador E para o formulário: escolher "Cintura" em
  // cima regista cintura em baixo (antes o formulário ficava preso no Peso
  // — o defaultValue só contava na primeira vez).
  const [metric, setMetric] = useState<MetricaId>("weight_kg");
  const def = METRICAS[metric];

  const todos = useMemo(
    () =>
      [...metricas.filter((m) => m.metric === metric)].sort((a, b) =>
        a.recordedAt.localeCompare(b.recordedAt),
      ),
    [metricas, metric],
  );
  // gráfico e frase: só o período; "Atual" e o histórico: todos os registos
  const pontos = useMemo(() => filtrarPeriodo(todos, (m) => m.recordedAt, periodoId), [todos, periodoId]);
  const ultimo = todos.at(-1);
  const recentes = todos.slice(-5).reverse();

  return (
    <section>
      <h2 className="apex-tipo-titulo-seccao" style={{ color: COR.tinta }}>
        Peso e medidas
      </h2>

      <BlocoImc metricas={metricas} />

      <div className="apex-abas apex-abas--scroll mt-3">
        {METRICA_IDS.map((m) => (
          <button
            key={m}
            type="button"
            className="apex-aba"
            data-ativa={m === metric}
            onClick={() => setMetric(m)}
          >
            {METRICAS[m].label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {todos.length === 0 ? (
          <div className="apex-grafico__vazio apex-tipo-secundario px-4 text-center">
            Ainda sem registos de {def.label.toLowerCase()}. Regista o primeiro abaixo.
          </div>
        ) : pontos.length === 0 ? (
          <SemDadosNoPeriodo oque={`de ${def.label.toLowerCase()}`} nomePeriodo={periodo(periodoId).nome} />
        ) : pontos.length === 1 ? (
          <div className="apex-grafico__vazio apex-tipo-secundario px-4 text-center">
            Um registo só nos últimos {periodo(periodoId).nome} — o gráfico aparece a partir do segundo.
          </div>
        ) : (
          <GraficoMetrica pontos={pontos} />
        )}
      </div>

      {metric !== "height_cm" ? (
        <FraseLeitura
          leitura={leituraMetrica(metric, pontos, { minDias: minDiasTendencia(periodoId) })}
          temDados={pontos.length > 1}
        />
      ) : null}

      {ultimo ? (
        <p className="apex-tipo-corpo apex-tabular mt-2" style={{ color: COR.tinta }}>
          Atual: {formatarNumero(ultimo.value)} {def.unidade}
        </p>
      ) : null}

      {recentes.length > 0 ? (
        <ul className="mt-2 flex flex-col">
          {recentes.map((r) => (
            <li
              key={r.id}
              className="apex-tipo-secundario apex-tabular flex items-baseline justify-between gap-3 border-b py-2"
              style={{ borderColor: COR.linha }}
            >
              <span style={{ color: COR.fraco }}>{dataCurta(r.recordedAt)}</span>
              <span style={{ color: COR.tinta, fontWeight: 600 }}>
                {formatarNumero(r.value)} {def.unidade}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <FormMetrica metric={metric} aoMudar={setMetric} aoGravado={aoGravado} />
    </section>
  );
}

function FormMetrica({
  metric,
  aoMudar,
  aoGravado,
}: {
  metric: MetricaId;
  aoMudar: (m: MetricaId) => void;
  aoGravado: () => void;
}) {
  const [estado, submeter, aEnviar] = useActionState<EstadoProgresso, FormData>(registarMetrica, {});
  const def = METRICAS[metric];

  return (
    <form
      action={(fd) => {
        submeter(fd);
        aoGravado();
      }}
      className="apex-form-registo mt-3"
    >
      <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
        Registar peso ou medida
      </p>
      <div className="apex-form-registo__linha">
        <select
          name="metric"
          value={metric}
          onChange={(e) => aoMudar(e.currentTarget.value as MetricaId)}
          aria-label="Medida"
        >
          {METRICA_IDS.map((m) => (
            <option key={m} value={m}>
              {METRICAS[m].label} ({METRICAS[m].unidade})
            </option>
          ))}
        </select>
        <input
          key={metric}
          name="value"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={`ex.: ${def.exemplo}`}
          aria-label={`Valor em ${def.unidade}`}
          required
        />
      </div>
      {estado.erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }} role="alert">
          {estado.erro}
        </p>
      ) : estado.ok && !aEnviar ? (
        <p className="apex-tipo-secundario" style={{ color: COR.tinta }} role="status">
          Guardado.
        </p>
      ) : null}
      <button type="submit" disabled={aEnviar} className="apex-botao apex-botao--claro" style={{ width: "auto" }}>
        {aEnviar ? "A guardar…" : "Guardar"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Volume — por sessão / por semana
// ---------------------------------------------------------------------------

function SeccaoVolume({ sessoes, periodoId }: { sessoes: SessaoHistorico[]; periodoId: PeriodoId }) {
  const [vista, setVista] = useState<"semana" | "sessao">("semana");

  // Semanas de programa com alguma sessão dentro do período (com o volume
  // TODO dessa semana — uma semana cortada a meio pareceria uma queda).
  const porSemana = useMemo(() => {
    const inicio = inicioPeriodo(periodoId);
    return agruparVolumePorSemana(
      sessoes.map((s) => ({ weekNumber: s.weekNumber, volumeKg: s.volumeKg, isDeload: s.isDeload, performedAt: s.performedAt })),
    ).filter((sem) => sem.ultimaSessao != null && Date.parse(sem.ultimaSessao) >= inicio);
  }, [sessoes, periodoId]);
  const ultimasSessoes = useMemo(
    () => filtrarPeriodo([...sessoes].reverse(), (s) => s.performedAt, periodoId).slice(-12),
    [sessoes, periodoId],
  );

  const barras =
    vista === "semana"
      ? porSemana.map((s) => ({ chave: `S${s.weekNumber}`, valor: s.volumeKg, marco: s.isDeload }))
      : ultimasSessoes.map((s) => ({ chave: dataCurta(s.performedAt), valor: s.volumeKg, marco: s.isDeload }));

  return (
    <section>
      <h2 className="apex-tipo-titulo-seccao" style={{ color: COR.tinta }}>
        Volume
      </h2>
      <p className="apex-tipo-secundario" style={{ color: COR.fraco, marginTop: 4 }}>
        Soma da carga × reps × séries. Semanas de descarga a azul — a quebra é intencional.
      </p>

      <div className="apex-abas mt-3">
        <button type="button" className="apex-aba" data-ativa={vista === "semana"} onClick={() => setVista("semana")}>
          Por semana
        </button>
        <button type="button" className="apex-aba" data-ativa={vista === "sessao"} onClick={() => setVista("sessao")}>
          Por sessão
        </button>
      </div>

      <div className="mt-3">
        {sessoes.length === 0 ? (
          <div className="apex-grafico__vazio apex-tipo-secundario">Ainda sem sessões registadas.</div>
        ) : barras.length === 0 ? (
          <SemDadosNoPeriodo oque="de treinos" nomePeriodo={periodo(periodoId).nome} />
        ) : (
          <GraficoVolume barras={barras} />
        )}
      </div>

      {/* a frase é da vista semanal — a tendência é por semana, não por sessão */}
      {vista === "semana" ? <FraseLeitura leitura={leituraVolume(porSemana)} temDados={porSemana.length > 0} /> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Histórico de treinos — completo, navegável
// ---------------------------------------------------------------------------

function SeccaoHistorico({ sessoes }: { sessoes: SessaoHistorico[] }) {
  return (
    <section>
      <h2 className="apex-tipo-titulo-seccao" style={{ color: COR.tinta }}>
        Histórico
      </h2>
      {sessoes.length === 0 ? (
        <p className="apex-tipo-corpo mt-2" style={{ color: COR.fraco }}>
          Ainda não registaste nenhum treino.
        </p>
      ) : (
        <div className="mt-2">
          {sessoes.map((s) => (
            <ItemHistorico key={s.id} sessao={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function ItemHistorico({ sessao }: { sessao: SessaoHistorico }) {
  const [aberto, setAberto] = useState(false);
  const temDetalhe = sessao.checkin != null || sessao.avgRpe != null || sessao.completion != null;

  return (
    <div className="apex-historico-item">
      <button
        type="button"
        className="apex-historico-item__cabecalho"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
      >
        <span>
          <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
            {sessao.title}
          </span>
          {sessao.isDeload ? (
            <span
              className="apex-chip-neutro apex-tipo-etiqueta"
              style={{ marginLeft: 8, color: COR.azul }}
            >
              Descarga
            </span>
          ) : null}
        </span>
        <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
          {dataCurta(sessao.performedAt)}
        </span>
      </button>

      {aberto ? (
        <div className="apex-historico-item__detalhe">
          <p className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
            {sessao.nSets} séries · {formatarKg(Math.round(sessao.volumeKg))} de volume
            {sessao.completion != null ? ` · ${Math.round(sessao.completion * 100)}% completo` : ""}
            {sessao.avgRpe != null ? ` · ${formatarReservaMedia(sessao.avgRpe)}` : ""}
          </p>
          {sessao.checkin?.effort ? (
            <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
              Esforço: {EFFORT_LABEL[sessao.checkin.effort] ?? sessao.checkin.effort}
            </p>
          ) : null}
          {sessao.checkin?.discomfortZones && sessao.checkin.discomfortZones.length > 0 ? (
            <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
              Desconforto: {sessao.checkin.discomfortZones.map((z) => ZONE_LABEL[z] ?? z).join(", ")}
            </p>
          ) : null}
          {sessao.checkin?.note ? (
            <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
              “{sessao.checkin.note}”
            </p>
          ) : null}
          {!temDetalhe ? (
            <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
              Sem detalhe adicional para esta sessão.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
