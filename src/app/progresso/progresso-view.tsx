"use client";

import { useMemo, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { CabecalhoEcra } from "@/app/_ui/design/cabecalho-ecra";
import { LIFT_LABEL, INJURIES, type Lift } from "@/lib/motor";
import { marcarNovosRecordes } from "@/lib/treino/marcos";
import { agruparVolumePorSemana } from "@/lib/treino/volume-historico";
import { escalarPontos, pathLinha, escalarBarras } from "@/lib/treino/grafico";
import { registarRecorde, registarMetrica, type EstadoProgresso } from "@/app/actions/progresso";
import { METRICAS, type MetricaId } from "@/lib/treino/metricas";
import type { RecordePessoal, MetricaCorporal, SessaoHistorico } from "@/lib/treino/progresso-dados";

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

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });

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

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoEcra marca="APEX" direita="progresso" />
      <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
        Progresso
      </h1>

      <SeccaoForca recordes={recordes} aoGravado={aoGravado} />
      <SeccaoMetricas metricas={metricas} aoGravado={aoGravado} />
      <SeccaoVolume sessoes={sessoes} />
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
}: {
  recordes: RecordePessoal[];
  aoGravado: () => void;
}) {
  const [lift, setLift] = useState<Lift>("agachamento");

  const pontos = useMemo(() => {
    const desteLevantamento = recordes.filter((r) => r.lift === lift);
    return marcarNovosRecordes(
      desteLevantamento,
      (r) => r.lift,
      (r) => r.valueKg,
      (r) => r.recordedAt,
    );
  }, [recordes, lift]);

  const ultimo = pontos.at(-1);

  return (
    <section>
      <h2 className="apex-tipo-titulo-seccao" style={{ color: COR.tinta }}>
        Força
      </h2>
      <p className="apex-tipo-secundario" style={{ color: COR.fraco, marginTop: 4 }}>
        Evolução do 1RM. ▪ testado no ginásio · ○ estimado a partir do treino ao vivo.
      </p>

      <div className="apex-abas mt-3">
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
        {pontos.length === 0 ? (
          <div className="apex-grafico__vazio apex-tipo-secundario">
            Ainda sem recordes registados para {LIFT_LABEL[lift].toLowerCase()}.
          </div>
        ) : (
          <GraficoForca pontos={pontos} />
        )}
      </div>

      {ultimo ? (
        <p className="apex-tipo-corpo apex-tabular mt-2" style={{ color: COR.tinta }}>
          Atual: {ultimo.valueKg} kg
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

function GraficoForca({
  pontos,
}: {
  pontos: (RecordePessoal & { novoRecorde: boolean })[];
}) {
  const LARGURA = 320;
  const ALTURA = 160;
  const coords = escalarPontos(
    pontos.map((p) => p.valueKg),
    LARGURA,
    ALTURA,
    24,
  );
  const path = pathLinha(coords);

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="apex-grafico__svg"
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Gráfico de evolução do 1RM"
    >
      <path d={path} fill="none" stroke={COR.tinta} strokeWidth={1.5} />
      {coords.map((c, i) => {
        const p = pontos[i];
        const marco = p.novoRecorde;
        const cor = marco ? COR.azul : COR.tinta;
        const titulo = `${p.valueKg} kg · ${p.source === "auto" ? "estimativa do treino" : "testado no ginásio"} · ${dataLonga(p.recordedAt)}${marco ? " · novo recorde" : ""}`;
        // aria-label, não <title> aninhado nem o atributo `title` (o SVGProps
        // do React não o tipa) — um <title> dentro de <svg> é tratado pelo
        // React como metadado do documento e sai vazio do lado do servidor,
        // o que desalinha SSR/cliente.
        return p.source === "auto" ? (
          <circle
            key={p.id}
            cx={c.x}
            cy={c.y}
            r={marco ? 5.5 : 4}
            fill={COR.branco}
            stroke={cor}
            strokeWidth={1.5}
            aria-label={titulo}
          />
        ) : (
          <rect
            key={p.id}
            x={c.x - (marco ? 4.5 : 3.5)}
            y={c.y - (marco ? 4.5 : 3.5)}
            width={marco ? 9 : 7}
            height={marco ? 9 : 7}
            fill={cor}
            aria-label={titulo}
          />
        );
      })}
    </svg>
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
        <input name="value_kg" type="number" step="0.5" min={0} max={500} placeholder="kg" required />
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
}: {
  metricas: MetricaCorporal[];
  aoGravado: () => void;
}) {
  const [metric, setMetric] = useState<MetricaId>("weight_kg");
  const def = METRICAS[metric];

  const pontos = useMemo(
    () =>
      [...metricas.filter((m) => m.metric === metric)].sort((a, b) =>
        a.recordedAt.localeCompare(b.recordedAt),
      ),
    [metricas, metric],
  );
  const ultimo = pontos.at(-1);

  return (
    <section>
      <h2 className="apex-tipo-titulo-seccao" style={{ color: COR.tinta }}>
        Peso e medidas
      </h2>

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
        {pontos.length === 0 ? (
          <div className="apex-grafico__vazio apex-tipo-secundario">
            Ainda sem {def.label.toLowerCase()} registado.
          </div>
        ) : (
          <GraficoMetrica pontos={pontos} />
        )}
      </div>

      {ultimo ? (
        <p className="apex-tipo-corpo apex-tabular mt-2" style={{ color: COR.tinta }}>
          Atual: {ultimo.value} {def.unidade}
        </p>
      ) : null}

      <FormMetrica metricInicial={metric} aoGravado={aoGravado} />
    </section>
  );
}

function GraficoMetrica({ pontos }: { pontos: MetricaCorporal[] }) {
  const LARGURA = 320;
  const ALTURA = 140;
  const coords = escalarPontos(
    pontos.map((p) => p.value),
    LARGURA,
    ALTURA,
    20,
  );
  const path = pathLinha(coords);

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Gráfico de evolução da métrica corporal"
    >
      <path d={path} fill="none" stroke={COR.tinta} strokeWidth={1.5} />
      {coords.map((c, i) => (
        <circle
          key={pontos[i].id}
          cx={c.x}
          cy={c.y}
          r={3.5}
          fill={COR.tinta}
          aria-label={`${pontos[i].value} · ${dataLonga(pontos[i].recordedAt)}`}
        />
      ))}
    </svg>
  );
}

function FormMetrica({
  metricInicial,
  aoGravado,
}: {
  metricInicial: MetricaId;
  aoGravado: () => void;
}) {
  const [estado, submeter, aEnviar] = useActionState<EstadoProgresso, FormData>(registarMetrica, {});

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
        <select name="metric" defaultValue={metricInicial}>
          {METRICA_IDS.map((m) => (
            <option key={m} value={m}>
              {METRICAS[m].label} ({METRICAS[m].unidade})
            </option>
          ))}
        </select>
        <input name="value" type="number" step="0.1" min={0} placeholder="valor" required />
      </div>
      {estado.erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
          {estado.erro}
        </p>
      ) : null}
      <button type="submit" disabled={aEnviar} className="apex-botao apex-botao--claro" style={{ width: "auto", padding: "10px 20px" }}>
        {aEnviar ? "A guardar…" : "Guardar"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Volume — por sessão / por semana
// ---------------------------------------------------------------------------

function SeccaoVolume({ sessoes }: { sessoes: SessaoHistorico[] }) {
  const [vista, setVista] = useState<"semana" | "sessao">("semana");

  const porSemana = useMemo(
    () =>
      agruparVolumePorSemana(
        sessoes.map((s) => ({ weekNumber: s.weekNumber, volumeKg: s.volumeKg, isDeload: s.isDeload })),
      ),
    [sessoes],
  );
  const ultimasSessoes = useMemo(() => [...sessoes].reverse().slice(-12), [sessoes]);

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
        {barras.length === 0 ? (
          <div className="apex-grafico__vazio apex-tipo-secundario">Ainda sem sessões registadas.</div>
        ) : (
          <GraficoVolume barras={barras} />
        )}
      </div>
    </section>
  );
}

function GraficoVolume({
  barras,
}: {
  barras: { chave: string; valor: number; marco: boolean }[];
}) {
  const ALTURA = 120;
  const alturas = escalarBarras(
    barras.map((b) => b.valor),
    ALTURA,
  );

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: ALTURA }}>
      {barras.map((b, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            title={`${b.chave}: ${Math.round(b.valor)} kg${b.marco ? " · descarga" : ""}`}
            style={{
              width: "100%",
              height: Math.max(2, alturas[i]),
              background: b.marco ? COR.azul : COR.tinta,
            }}
          />
        </div>
      ))}
    </div>
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
            {sessao.nSets} séries · {Math.round(sessao.volumeKg)} kg de volume
            {sessao.completion != null ? ` · ${Math.round(sessao.completion * 100)}% completo` : ""}
            {sessao.avgRpe != null ? ` · RPE médio ${sessao.avgRpe}` : ""}
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
