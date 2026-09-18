"use client";

/* ============================================================
   Gráficos da ficha do aluno, do lado do PT — SÓ LEITURA (o PT nunca
   regista recordes/métricas por outra pessoa, só o próprio aluno o faz
   em /progresso). Reutiliza os componentes de desenho de
   @/app/_ui/treino/graficos-progresso e a mesma lógica de agrupamento de
   @/lib/treino — só troca os formulários de registo por tabs simples.
   Cada secção só aparece com dados; sem dados, diz isso, nunca um
   gráfico vazio ou inventado.
   ============================================================ */
import { useMemo, useState } from "react";
import { LIFT_LABEL, type Lift } from "@/lib/motor";
import { marcarNovosRecordes } from "@/lib/treino/marcos";
import { agruparVolumePorSemana } from "@/lib/treino/volume-historico";
import { escalarBarras } from "@/lib/treino/grafico";
import { GraficoForca, GraficoMetrica, GraficoVolume } from "@/app/_ui/treino/graficos-progresso";
import { METRICAS, type MetricaId } from "@/lib/treino/metricas";
import { LIMIAR_ADESAO_BAIXA } from "@/lib/treino/atencao";
import type { RecordePessoal, MetricaCorporal, SessaoHistorico } from "@/lib/treino/progresso-dados";
import type { PontoAdesaoSemanal } from "@/lib/treino/adesao-semanal";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  positivo: "var(--apex-positivo)",
  erro: "var(--apex-erro)",
} as const;

const LIFTS = Object.keys(LIFT_LABEL) as Lift[];
const METRICA_IDS = Object.keys(METRICAS) as MetricaId[];

// ---------------------------------------------------------------------------
// Adesão por semana — treinos feitos vs. previstos, janela completa (ver
// adesao-semanal.ts). Cada semana é um ponto real, mesmo a 0.
// ---------------------------------------------------------------------------

export function SeccaoAdesaoSemanal({ pontos }: { pontos: PontoAdesaoSemanal[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Adesão por semana
        </h2>
        <p className="apex-tipo-secundario" style={{ color: COR.fraco, marginTop: 4 }}>
          Treinos feitos vs. dias previstos no plano ativo, por semana de calendário.
        </p>
      </div>
      {pontos.length === 0 ? (
        <div className="apex-grafico__vazio apex-tipo-secundario">
          Sem plano ativo com dias de treino — não há &ldquo;previsto&rdquo; para comparar.
        </div>
      ) : (
        <GraficoAdesaoSemanal pontos={pontos} />
      )}
    </section>
  );
}

function GraficoAdesaoSemanal({ pontos }: { pontos: PontoAdesaoSemanal[] }) {
  const ALTURA = 100;
  const alturas = escalarBarras(
    pontos.map((p) => p.pct),
    ALTURA,
  );

  return (
    <div className="flex flex-col gap-1">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: ALTURA }}>
        {pontos.map((p, i) => (
          <div key={p.semana} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
              {Math.round(p.pct * 100)}%
            </span>
            <div
              title={`${p.feitos} de ${p.previstos} treinos`}
              style={{
                width: "100%",
                height: Math.max(2, alturas[i]),
                // mesmo limiar que "precisa de atenção" (adesão <75%) —
                // nunca dois números diferentes para a mesma ideia.
                background: p.pct >= LIMIAR_ADESAO_BAIXA ? COR.positivo : COR.erro,
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {pontos.map((p, i) => (
          <span key={p.semana} className="apex-tipo-etiqueta apex-tabular" style={{ flex: 1, textAlign: "center", color: COR.fraco }}>
            {i === pontos.length - 1 ? "Atual" : `-${pontos.length - 1 - i}`}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Força — evolução do 1RM por levantamento (só leitura)
// ---------------------------------------------------------------------------

export function SeccaoForcaLeitura({ recordes }: { recordes: RecordePessoal[] }) {
  const liftsComDados = LIFTS.filter((l) => recordes.some((r) => r.lift === l));
  const [lift, setLift] = useState<Lift | null>(liftsComDados[0] ?? null);

  const pontos = useMemo(() => {
    if (!lift) return [];
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
    <section className="flex flex-col gap-3">
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
        Força
      </h2>
      {liftsComDados.length === 0 ? (
        <div className="apex-grafico__vazio apex-tipo-secundario">Ainda sem recordes registados.</div>
      ) : (
        <>
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            Evolução do 1RM. ▪ testado no ginásio · ○ estimado a partir do treino ao vivo.
          </p>
          <div className="apex-abas">
            {liftsComDados.map((l) => (
              <button key={l} type="button" className="apex-aba" data-ativa={l === lift} onClick={() => setLift(l)}>
                {LIFT_LABEL[l]}
              </button>
            ))}
          </div>
          <GraficoForca pontos={pontos} />
          {ultimo ? (
            <p className="apex-tipo-corpo apex-tabular" style={{ color: COR.tinta }}>
              Atual: {ultimo.valueKg} kg
              {ultimo.source === "auto" ? (
                <span className="apex-tipo-secundario" style={{ color: COR.fraco }}>
                  {" "}
                  (estimativa do treino, não testado)
                </span>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Volume — por sessão / por semana (só leitura)
// ---------------------------------------------------------------------------

export function SeccaoVolumeLeitura({ sessoes }: { sessoes: SessaoHistorico[] }) {
  const [vista, setVista] = useState<"semana" | "sessao">("semana");

  const porSemana = useMemo(
    () => agruparVolumePorSemana(sessoes.map((s) => ({ weekNumber: s.weekNumber, volumeKg: s.volumeKg, isDeload: s.isDeload }))),
    [sessoes],
  );
  const ultimasSessoes = useMemo(() => [...sessoes].reverse().slice(-12), [sessoes]);

  const barras =
    vista === "semana"
      ? porSemana.map((s) => ({ chave: `S${s.weekNumber}`, valor: s.volumeKg, marco: s.isDeload }))
      : ultimasSessoes.map((s) => ({
          chave: new Date(s.performedAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short" }),
          valor: s.volumeKg,
          marco: s.isDeload,
        }));

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Volume
        </h2>
        <p className="apex-tipo-secundario" style={{ color: COR.fraco, marginTop: 4 }}>
          Soma da carga × reps × séries. Semanas de descarga a azul.
        </p>
      </div>
      {barras.length === 0 ? (
        <div className="apex-grafico__vazio apex-tipo-secundario">Ainda sem sessões registadas.</div>
      ) : (
        <>
          <div className="apex-abas">
            <button type="button" className="apex-aba" data-ativa={vista === "semana"} onClick={() => setVista("semana")}>
              Por semana
            </button>
            <button type="button" className="apex-aba" data-ativa={vista === "sessao"} onClick={() => setVista("sessao")}>
              Por sessão
            </button>
          </div>
          <GraficoVolume barras={barras} />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Peso e medidas — só leitura, só se o aluno autorizou métricas
// ---------------------------------------------------------------------------

export function SeccaoMetricasLeitura({ metricas }: { metricas: MetricaCorporal[] }) {
  const idsComDados = METRICA_IDS.filter((m) => metricas.some((x) => x.metric === m));
  const [metric, setMetric] = useState<MetricaId | null>(idsComDados[0] ?? null);
  const def = metric ? METRICAS[metric] : null;

  const pontos = useMemo(
    () => (metric ? [...metricas.filter((m) => m.metric === metric)].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)) : []),
    [metricas, metric],
  );
  const ultimo = pontos.at(-1);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
        Peso e medidas
      </h2>
      {idsComDados.length === 0 ? (
        <div className="apex-grafico__vazio apex-tipo-secundario">Ainda sem peso ou medidas registadas.</div>
      ) : (
        <>
          <div className="apex-abas apex-abas--scroll">
            {idsComDados.map((m) => (
              <button key={m} type="button" className="apex-aba" data-ativa={m === metric} onClick={() => setMetric(m)}>
                {METRICAS[m].label}
              </button>
            ))}
          </div>
          <GraficoMetrica pontos={pontos} />
          {ultimo && def ? (
            <p className="apex-tipo-corpo apex-tabular" style={{ color: COR.tinta }}>
              Atual: {ultimo.value} {def.unidade}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
