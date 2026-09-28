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
import { pontosAdesaoComFallback, type PontoAdesaoSemanal } from "@/lib/treino/adesao-semanal";

import { FUSO } from "@/lib/fuso";
import { BlocoImc } from "@/app/_ui/treino/bloco-imc";
import { formatarKg, formatarNumero } from "@/lib/formato";
import { FraseLeitura } from "@/app/_ui/treino/frase-leitura";
import { desdePrimeiraSessao, leituraAdesao, leituraForca, leituraMetrica, leituraVolume } from "@/lib/treino/leituras";
import { SeletorPeriodo, SemDadosNoPeriodo } from "@/app/_ui/treino/seletor-periodo";
import {
  PERIODO_OMISSAO,
  filtrarPeriodo,
  inicioPeriodo,
  minDiasTendencia,
  periodo,
  type PeriodoId,
} from "@/lib/treino/periodos";
const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  positivo: "var(--apex-positivo)",
  erro: "var(--apex-erro)",
} as const;

// Fuso FIXO — mesmo raciocínio de chat-view.tsx: sem timeZone explícito,
// esta data (rótulo do gráfico de volume, na ficha do aluno) divergia
// entre o servidor (UTC) e o telemóvel do PT (Portugal) perto da meia-noite.
// FUSO: fonte única em src/lib/fuso.ts

const LIFTS = Object.keys(LIFT_LABEL) as Lift[];
const METRICA_IDS = Object.keys(METRICAS) as MetricaId[];

// ---------------------------------------------------------------------------
// Adesão por semana — treinos feitos vs. previstos, janela completa (ver
// adesao-semanal.ts). Cada semana é um ponto real, mesmo a 0.
// ---------------------------------------------------------------------------

export function SeccaoAdesaoSemanal({ pontos }: { pontos: PontoAdesaoSemanal[] }) {
  // pontos já vêm do período escolhido e sem as semanas anteriores ao 1.º
  // treino de sempre (GraficosAlunoComPeriodo) — gráfico e frase iguais.
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
        <>
          <GraficoAdesaoSemanal pontos={pontos} />
          <FraseLeitura leitura={leituraAdesao(pontos, "pt")} temDados />
        </>
      )}
    </section>
  );
}

function GraficoAdesaoSemanal({ pontos }: { pontos: PontoAdesaoSemanal[] }) {
  const ALTURA = 100;
  // Mais de 8 barras (3 meses ou mais) não cabem com a percentagem por
  // cima de cada uma num iPhone SE — compacto: sem números por barra (a
  // frase por baixo di-los), eixo só com o início e "Atual".
  const compacto = pontos.length > 8;
  const alturas = escalarBarras(
    pontos.map((p) => p.pct),
    ALTURA,
  );

  return (
    <div className="flex flex-col gap-1">
      <div style={{ display: "flex", alignItems: "flex-end", gap: compacto ? 2 : 6, height: ALTURA }}>
        {pontos.map((p, i) => (
          <div key={p.semana} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {compacto ? null : (
              <span className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
                {Math.round(p.pct * 100)}%
              </span>
            )}
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
      {compacto ? (
        <div className="flex justify-between">
          <span className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
            há {pontos.length - 1} semanas
          </span>
          <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Atual
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          {pontos.map((p, i) => (
            <span key={p.semana} className="apex-tipo-etiqueta apex-tabular" style={{ flex: 1, textAlign: "center", color: COR.fraco }}>
              {i === pontos.length - 1 ? "Atual" : `-${pontos.length - 1 - i}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Força — evolução do 1RM por levantamento (só leitura)
// ---------------------------------------------------------------------------

export function SeccaoForcaLeitura({ recordes, periodoId = PERIODO_OMISSAO }: { recordes: RecordePessoal[]; periodoId?: PeriodoId }) {
  const liftsComDados = LIFTS.filter((l) => recordes.some((r) => r.lift === l));
  const [lift, setLift] = useState<Lift | null>(liftsComDados[0] ?? null);

  const todos = useMemo(() => {
    if (!lift) return [];
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
          <div className="apex-abas apex-abas--scroll">
            {liftsComDados.map((l) => (
              <button key={l} type="button" className="apex-aba" data-ativa={l === lift} onClick={() => setLift(l)}>
                {LIFT_LABEL[l]}
              </button>
            ))}
          </div>
          {pontos.length === 0 && lift ? (
            <SemDadosNoPeriodo oque={`de ${LIFT_LABEL[lift].toLowerCase()}`} nomePeriodo={periodo(periodoId).nome} />
          ) : (
            <GraficoForca pontos={pontos} />
          )}
          {lift ? (
            <FraseLeitura
              leitura={leituraForca(LIFT_LABEL[lift], pontos, "pt", { minDias: minDiasTendencia(periodoId) })}
              temDados={pontos.length > 0}
            />
          ) : null}
          {ultimo ? (
            <p className="apex-tipo-corpo apex-tabular" style={{ color: COR.tinta }}>
              Atual: {formatarKg(ultimo.valueKg)}
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

export function SeccaoVolumeLeitura({ sessoes, periodoId = PERIODO_OMISSAO }: { sessoes: SessaoHistorico[]; periodoId?: PeriodoId }) {
  const [vista, setVista] = useState<"semana" | "sessao">("semana");

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
      : ultimasSessoes.map((s) => ({
          chave: new Date(s.performedAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short", timeZone: FUSO }),
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
      {sessoes.length === 0 ? (
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
          {barras.length === 0 ? (
            <SemDadosNoPeriodo oque="de treinos" nomePeriodo={periodo(periodoId).nome} />
          ) : (
            <GraficoVolume barras={barras} />
          )}
          {vista === "semana" ? <FraseLeitura leitura={leituraVolume(porSemana)} temDados={porSemana.length > 0} /> : null}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Peso e medidas — só leitura, só se o aluno autorizou métricas
// ---------------------------------------------------------------------------

export function SeccaoMetricasLeitura({ metricas, periodoId = PERIODO_OMISSAO }: { metricas: MetricaCorporal[]; periodoId?: PeriodoId }) {
  const idsComDados = METRICA_IDS.filter((m) => metricas.some((x) => x.metric === m));
  const [metric, setMetric] = useState<MetricaId | null>(idsComDados[0] ?? null);
  const def = metric ? METRICAS[metric] : null;

  const todos = useMemo(
    () => (metric ? [...metricas.filter((m) => m.metric === metric)].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)) : []),
    [metricas, metric],
  );
  const pontos = useMemo(() => filtrarPeriodo(todos, (m) => m.recordedAt, periodoId), [todos, periodoId]);
  const ultimo = todos.at(-1);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
        Peso e medidas
      </h2>
      <BlocoImc metricas={metricas} perspetiva="pt" />
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
          {pontos.length === 0 && def ? (
            <SemDadosNoPeriodo oque={`de ${def.label.toLowerCase()}`} nomePeriodo={periodo(periodoId).nome} />
          ) : (
            <GraficoMetrica pontos={pontos} />
          )}
          {metric && metric !== "height_cm" ? (
            <FraseLeitura
              leitura={leituraMetrica(metric, pontos, { minDias: minDiasTendencia(periodoId) })}
              temDados={pontos.length > 1}
            />
          ) : null}
          {ultimo && def ? (
            <p className="apex-tipo-corpo apex-tabular" style={{ color: COR.tinta }}>
              Atual: {formatarNumero(ultimo.value)} {def.unidade}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Os 4 gráficos da ficha com UM período (seletor no topo). A adesão é
// calculada aqui para o nº de semanas do período, e sem as semanas antes do
// 1.º treino de sempre do aluno — o mesmo que a frase usa.
// ---------------------------------------------------------------------------

export function GraficosAlunoComPeriodo({
  sessoes,
  recordes,
  metricas,
  diasPrevistosSemana,
}: {
  sessoes: SessaoHistorico[];
  recordes: RecordePessoal[];
  /** null = o aluno não autorizou métricas (nada é enviado ao browser) */
  metricas: MetricaCorporal[] | null;
  diasPrevistosSemana: number | null;
}) {
  const [periodoId, setPeriodoId] = useState<PeriodoId>(PERIODO_OMISSAO);
  const pontosAdesao = useMemo(() => {
    const primeira = sessoes.reduce<string | null>((min, s) => (!min || s.performedAt < min ? s.performedAt : min), null);
    return desdePrimeiraSessao(
      pontosAdesaoComFallback(
        sessoes.map((s) => ({ performedAt: s.performedAt })),
        diasPrevistosSemana,
        periodo(periodoId).semanas,
      ),
      primeira,
    );
  }, [sessoes, diasPrevistosSemana, periodoId]);

  return (
    <>
      <SeletorPeriodo valor={periodoId} aoMudar={setPeriodoId} />
      <SeccaoAdesaoSemanal pontos={pontosAdesao} />
      <SeccaoForcaLeitura recordes={recordes} periodoId={periodoId} />
      <SeccaoVolumeLeitura sessoes={sessoes} periodoId={periodoId} />
      {metricas ? (
        <SeccaoMetricasLeitura metricas={metricas} periodoId={periodoId} />
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
    </>
  );
}
