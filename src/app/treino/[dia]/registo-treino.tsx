"use client";

import { useMemo, useState } from "react";
import { autoregulate, type DiaGerado } from "@/lib/motor";
import { decidirDescanso, type InfoMotorExercicio } from "@/lib/treino/descanso";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { SerieAtual, formatarNumero } from "./serie-atual";
import { PainelRpe } from "./painel-rpe";
import { EcraDescanso } from "./ecra-descanso";
import { ListaTreino } from "./lista-treino";
import { CheckIn } from "./check-in";

type EstadoSerie = {
  w: number | null;
  reps: number;
  /** Texto do plano (ex.: "RIR 1-3") — alvo, nunca muda. */
  rpeAlvo: string;
  /** RPE que o atleta reportou (6–10) — só depois de done=true. */
  rpeReportado: number | null;
  done: boolean;
};
type EstadoEx = InfoMotorExercicio & {
  nome: string;
  muscle: string | null;
  bw: boolean;
  rest: string;
  exercicioId?: string;
  caution?: boolean;
  substituted: boolean;
  focusTag?: string;
  swap: string | null;
  sets: EstadoSerie[];
};

type Cursor = { ex: number; set: number };

function parseRest(s: string): number {
  const t = s.toLowerCase();
  const min = /(\d+)\s*[-–]?\s*\d*\s*min/.exec(t);
  if (min) return parseInt(min[1], 10) * 60;
  const seg = /(\d+)\s*s/.exec(t);
  if (seg) return parseInt(seg[1], 10);
  return 90;
}

/** Primeira série não feita a partir de (apartirEx, apartirSet), avançando
 *  por exercícios — a "fila" da sessão inteira é isto, nunca uma lista à
 *  parte que possa dessincronizar do estado real. */
function proximoNaoFeito(exs: EstadoEx[], apartirEx: number, apartirSet: number): Cursor | null {
  for (let ei = apartirEx; ei < exs.length; ei++) {
    const inicioSi = ei === apartirEx ? apartirSet : 0;
    for (let si = inicioSi; si < exs[ei].sets.length; si++) {
      if (!exs[ei].sets[si].done) return { ex: ei, set: si };
    }
  }
  return null;
}

export function RegistoTreino({
  dia,
  infoMotorPorExercicio,
  weekNumber,
  deload,
  checkinAtivo,
}: {
  dia: DiaGerado;
  infoMotorPorExercicio: InfoMotorExercicio[];
  weekNumber: number;
  deload: boolean;
  checkinAtivo: boolean;
}) {
  const [exs, setExs] = useState<EstadoEx[]>(() =>
    dia.exercises!.map((e, i) => ({
      nome: e.name,
      muscle: e.muscle,
      bw: e.bw,
      rest: e.rest,
      ...(infoMotorPorExercicio[i] ?? { usaBarra: false, incrementoKg: 2.5, tipoDescanso: "normal" as const }),
      exercicioId: e.exercicioId,
      caution: e.caution,
      substituted: e.substituted,
      focusTag: e.focusTag,
      swap: e.swap,
      sets: e.sets.map((s) => ({ w: s.w, reps: s.reps, rpeAlvo: s.rpe, rpeReportado: null, done: false })),
    })),
  );

  const [cursor, setCursor] = useState<Cursor | null>(() => proximoNaoFeito(exs, 0, 0));
  const [fase, setFase] = useState<"serie" | "rpe" | "descanso" | "checkin">(cursor ? "serie" : "checkin");
  const [descansoInfo, setDescansoInfo] = useState<{ duracaoSeg: number; motivo: string | null; proximo: Cursor } | null>(
    null,
  );
  const [listaAberta, setListaAberta] = useState(false);

  const agg = useMemo(() => {
    let done = 0;
    let total = 0;
    let volume = 0;
    const rpes: number[] = [];
    for (const e of exs) {
      for (const s of e.sets) {
        total++;
        if (s.done) {
          done++;
          if (s.rpeReportado != null) rpes.push(s.rpeReportado);
          volume += (s.w ?? 0) * s.reps;
        }
      }
    }
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    return { done, total, volume: Math.round(volume), avgRpe };
  }, [exs]);

  const logsJson = useMemo(
    () =>
      JSON.stringify(
        exs
          .filter((e) => e.exercicioId)
          .map((e, i) => {
            const feitas = e.sets.filter((s) => s.done);
            const ultima = feitas[feitas.length - 1];
            return {
              exercicioId: e.exercicioId,
              ordem: i + 1,
              skipped: feitas.length === 0,
              setsDone: feitas.length,
              loadKg: ultima?.w ?? null,
              reps: ultima?.reps ?? null,
              rpe: ultima?.rpeReportado ?? null,
            };
          }),
      ),
    [exs],
  );

  function ajustarCarga(delta: number) {
    if (!cursor) return;
    setExs((prev) => {
      const next = prev.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
      const ex = next[cursor.ex];
      const s = ex.sets[cursor.set];
      if (!ex.bw && s.w != null) {
        s.w = Math.max(0, Math.round((s.w + delta) * 100) / 100);
      } else {
        s.reps = Math.max(1, s.reps + delta);
      }
      return next;
    });
  }

  function definirCarga(valor: number) {
    if (!cursor) return;
    setExs((prev) => {
      const next = prev.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
      const ex = next[cursor.ex];
      const s = ex.sets[cursor.set];
      if (!ex.bw && s.w != null) {
        s.w = Math.max(0, valor);
      } else {
        s.reps = Math.max(1, Math.round(valor));
      }
      return next;
    });
  }

  function registarRpe(rpe: number) {
    if (!cursor) return;
    const next = exs.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
    const ex = next[cursor.ex];
    ex.sets[cursor.set].rpeReportado = rpe;
    ex.sets[cursor.set].done = true;

    // autorregulação: as séries seguintes DESTE exercício ajustam-se ao RPE
    // reportado — mesma lógica de sempre (src/lib/motor.ts::autoregulate).
    const ref = { w: ex.sets[cursor.set].w, reps: ex.sets[cursor.set].reps };
    for (let j = cursor.set + 1; j < ex.sets.length; j++) {
      if (ex.sets[j].done) continue;
      const adj = autoregulate(ref, rpe);
      if (adj.w !== undefined) ex.sets[j].w = adj.w ?? ex.sets[j].w;
      if (adj.reps !== undefined) ex.sets[j].reps = adj.reps;
    }
    setExs(next);

    const proximo = proximoNaoFeito(next, cursor.ex, cursor.set + 1);
    if (proximo == null) {
      setFase("checkin");
      return;
    }
    // descanso responde ao esforço: base do exercício + o RPE que acabou de
    // ser reportado, com limites por tipo (ver src/lib/treino/descanso.ts —
    // verificado contra a literatura antes de implementar).
    const { seg, motivo } = decidirDescanso(parseRest(next[cursor.ex].rest), rpe, next[cursor.ex].tipoDescanso);
    setDescansoInfo({ duracaoSeg: seg, motivo, proximo });
    setFase("descanso");
  }

  function avancarDoDescanso() {
    if (descansoInfo) setCursor(descansoInfo.proximo);
    setDescansoInfo(null);
    setFase("serie");
  }

  function irPara(ei: number, si: number) {
    if (exs[ei].sets[si].done) return; // não reescreve uma série já registada
    setCursor({ ex: ei, set: si });
    setFase("serie");
    setListaAberta(false);
  }

  if (fase === "checkin") {
    return <CheckIn titulo={dia.title ?? "Treino"} weekNumber={weekNumber} agg={agg} logsJson={logsJson} />;
  }

  if (!cursor) return null; // nunca acontece (fase seria "checkin"), guarda de tipo

  const exAtual = exs[cursor.ex];
  const serieAtual = exAtual.sets[cursor.set];
  const percurso = agg.total > 0 ? Math.round((agg.done / agg.total) * 100) : 0;

  return (
    <div className="apex-treino">
      <div className="apex-treino-progresso">
        <div className="apex-treino-progresso__preenchido" style={{ width: `${percurso}%` }} />
      </div>

      <div className="apex-treino-cabecalho">
        <div className="flex items-center gap-3">
          {/* Mesmo componente de /treino/registar, /u/[id] e /pt/[codigo]
              (o único padrão confirmado a funcionar no iPhone/Safari da
              Daniela) — não um botão à parte com um glifo "←" sozinho
              dentro de uma caixa: essa versão passava em todas as
              verificações de CSS/DOM que consigo fazer (Chromium), mas
              não aparecia no Safari a sério. Cor ajustada ao fundo escuro
              do modo treino. */}
          <BotaoVoltar cor="var(--apex-texto-fraco)" />
          <div className="flex flex-col">
            <span className="apex-tipo-etiqueta apex-tabular" style={{ color: "var(--apex-texto-fraco)" }}>
              {dia.dayName} · semana {weekNumber}
              {deload ? " · descarga" : ""}
            </span>
            <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-texto-treino)" }}>
              {dia.title}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="apex-treino-botao-lista"
          onClick={() => setListaAberta(true)}
          aria-label="Ver treino completo"
        >
          ☰
        </button>
      </div>

      {checkinAtivo ? (
        <p
          className="apex-tipo-etiqueta"
          style={{ padding: "0 var(--apex-space-5)", color: "var(--apex-texto-fraco)" }}
        >
          Cargas ajustadas onde reportaste desconforto no último check-in.
        </p>
      ) : null}

      {fase === "serie" || fase === "rpe" ? (
        <SerieAtual
          nomeExercicio={exAtual.nome}
          muscle={exAtual.muscle}
          numero={cursor.set + 1}
          total={exAtual.sets.length}
          bw={exAtual.bw}
          w={serieAtual.w}
          repsAlvo={serieAtual.reps}
          rpeAlvoTexto={serieAtual.rpeAlvo}
          usaBarra={exAtual.usaBarra}
          incrementoKg={exAtual.incrementoKg}
          caution={exAtual.caution}
          substituted={exAtual.substituted}
          focusTag={exAtual.focusTag}
          swap={exAtual.swap}
          onAjustar={ajustarCarga}
          onDefinir={definirCarga}
          onFeito={() => setFase("rpe")}
        />
      ) : null}

      {fase === "rpe" ? <PainelRpe onEscolher={registarRpe} /> : null}

      {fase === "descanso" && descansoInfo ? (
        <EcraDescanso
          duracaoSeg={descansoInfo.duracaoSeg}
          motivo={descansoInfo.motivo}
          proximoNome={exs[descansoInfo.proximo.ex].nome}
          proximoValor={valorAlvo(exs[descansoInfo.proximo.ex], exs[descansoInfo.proximo.ex].sets[descansoInfo.proximo.set])}
          onFim={avancarDoDescanso}
          onSaltar={avancarDoDescanso}
        />
      ) : null}

      {listaAberta ? (
        <ListaTreino
          exs={exs}
          cursorAtual={fase === "serie" ? cursor : null}
          onFechar={() => setListaAberta(false)}
          onIrPara={irPara}
          onTerminarAgora={() => {
            setListaAberta(false);
            setFase("checkin");
          }}
        />
      ) : null}
    </div>
  );
}

function valorAlvo(ex: EstadoEx, s: EstadoSerie): string {
  if (!ex.bw && s.w != null) return `${formatarNumero(s.w)} kg × ${s.reps}`;
  return `${s.reps} reps`;
}
