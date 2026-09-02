"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { autoregulate, type DiaGerado } from "@/lib/motor";
import { gravarTreino, type EstadoRegisto } from "@/app/actions/treino";
import { AvisoErro } from "@/app/_ui/campos";

type EstadoSerie = { w: number | null; reps: number; rpe: number | null; done: boolean };
type EstadoEx = { nome: string; bw: boolean; sets: EstadoSerie[] };

function parseRest(s: string): number {
  const t = s.toLowerCase();
  const min = /(\d+)\s*[-–]?\s*\d*\s*min/.exec(t);
  if (min) return parseInt(min[1], 10) * 60;
  const seg = /(\d+)\s*s/.exec(t);
  if (seg) return parseInt(seg[1], 10);
  return 90;
}

const EFFORTS = [
  { id: "abaixo", label: "Abaixo do esperado" },
  { id: "equilibrado", label: "Equilibrado" },
  { id: "limite", label: "No limite" },
  { id: "passei", label: "Passei-me" },
] as const;

const ZONES = [
  "ombro",
  "cotovelo",
  "pulso",
  "joelho",
  "lombar",
  "anca",
  "tornozelo",
  "pescoco",
] as const;
const ZONE_LABEL: Record<string, string> = {
  ombro: "Ombro",
  cotovelo: "Cotovelo",
  pulso: "Pulso",
  joelho: "Joelho",
  lombar: "Lombar",
  anca: "Anca",
  tornozelo: "Tornozelo",
  pescoco: "Pescoço",
};

export function RegistoTreino({
  dia,
  weekNumber,
  deload,
  checkinAtivo,
}: {
  dia: DiaGerado;
  weekNumber: number;
  deload: boolean;
  checkinAtivo: boolean;
}) {
  const [exs, setExs] = useState<EstadoEx[]>(() =>
    dia.exercises!.map((e) => ({
      nome: e.name,
      bw: e.bw,
      sets: e.sets.map((s) => ({ w: s.w, reps: s.reps, rpe: null, done: false })),
    })),
  );
  const [terminar, setTerminar] = useState(false);
  const [semDesconforto, setSemDesconforto] = useState(true);
  const [estado, acao, pendente] = useActionState(gravarTreino, {} as EstadoRegisto);

  // ---- registar uma série + autorregular as seguintes do mesmo exercício ----
  function marcarSerie(exIdx: number, setIdx: number, rpe: number) {
    setExs((prev) => {
      const next = prev.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
      const ex = next[exIdx];
      ex.sets[setIdx].rpe = rpe;
      ex.sets[setIdx].done = true;
      const ref = { w: ex.sets[setIdx].w, reps: ex.sets[setIdx].reps };
      for (let j = setIdx + 1; j < ex.sets.length; j++) {
        if (ex.sets[j].done) continue;
        const adj = autoregulate(ref, rpe);
        if (adj.w !== undefined) ex.sets[j].w = adj.w ?? ex.sets[j].w;
        if (adj.reps !== undefined) ex.sets[j].reps = adj.reps;
      }
      return next;
    });
    startRest(exIdx);
  }

  function ajustarCarga(exIdx: number, setIdx: number, w: number | null) {
    setExs((prev) => {
      const next = prev.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
      next[exIdx].sets[setIdx].w = w;
      return next;
    });
  }

  // ---- temporizador de descanso ----
  const [rest, setRest] = useState<{ total: number; left: number } | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  function startRest(exIdx: number) {
    const secs = parseRest(dia.exercises![exIdx].rest);
    if (restRef.current) clearInterval(restRef.current);
    setRest({ total: secs, left: secs });
    restRef.current = setInterval(() => {
      setRest((r) => {
        if (!r) return r;
        if (r.left <= 1) {
          if (restRef.current) clearInterval(restRef.current);
          return { ...r, left: 0 };
        }
        return { ...r, left: r.left - 1 };
      });
    }, 1000);
  }
  useEffect(() => () => {
    if (restRef.current) clearInterval(restRef.current);
  }, []);

  // ---- agregados p/ gravar ----
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
          if (s.rpe != null) rpes.push(s.rpe);
          volume += (s.w ?? 0) * s.reps;
        }
      }
    }
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    return { done, total, volume: Math.round(volume), avgRpe };
  }, [exs]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-600">
          <span>{dia.dayName}</span>
          <span>· semana {weekNumber}</span>
          {deload ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-300">
              descarga
            </span>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold text-zinc-100">{dia.title}</h1>
        <p className="text-sm text-zinc-400">
          {agg.done}/{agg.total} séries · {agg.volume} kg movimentados
          {agg.avgRpe != null ? ` · RPE médio ${agg.avgRpe.toFixed(1)}` : ""}
        </p>
      </header>

      {checkinAtivo ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Reportaste desconforto no último treino: as cargas dos exercícios ligados a essa
          zona já vêm ~8% mais baixas (&laquo;carga cautelar&raquo;). Vê como reage e ajusta.
        </p>
      ) : null}

      {rest ? (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
          <span className="font-mono text-2xl font-semibold text-zinc-100">
            {String(Math.floor(rest.left / 60)).padStart(1, "0")}:
            {String(rest.left % 60).padStart(2, "0")}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-emerald-400 transition-all duration-1000"
              style={{ width: `${(rest.left / rest.total) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (restRef.current) clearInterval(restRef.current);
              setRest(null);
            }}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Saltar
          </button>
        </div>
      ) : null}

      <ol className="flex flex-col gap-3">
        {exs.map((e, ei) => {
          const info = dia.exercises![ei];
          return (
            <li key={ei} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-100">
                  {ei + 1}. {e.nome}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {info.muscle ?? ""}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                {info.caution ? (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-300">
                    carga cautelar
                  </span>
                ) : null}
                {info.substituted ? (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-300">
                    substituído por lesão
                  </span>
                ) : null}
                {info.focusTag ? (
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-300">
                    foco: {info.focusTag}
                  </span>
                ) : null}
              </div>
              {info.swap ? (
                <p className="mt-1 text-xs text-amber-400/80">{info.swap}</p>
              ) : null}

              <ul className="mt-3 flex flex-col gap-2">
                {e.sets.map((s, si) => (
                  <SerieRow
                    key={si}
                    n={si + 1}
                    serie={s}
                    bw={e.bw}
                    onCarga={(w) => ajustarCarga(ei, si, w)}
                    onFeito={(rpe) => marcarSerie(ei, si, rpe)}
                  />
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      {!terminar ? (
        <button
          type="button"
          onClick={() => setTerminar(true)}
          className="rounded-lg bg-zinc-100 px-4 py-3 font-semibold text-zinc-900 transition hover:bg-white"
        >
          Terminar treino
        </button>
      ) : (
        <form action={acao} className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Check-in pós-treino</h2>
          {estado.erro ? <AvisoErro>{estado.erro}</AvisoErro> : null}

          <input type="hidden" name="title" value={dia.title ?? "Treino"} />
          <input type="hidden" name="week_number" value={weekNumber} />
          <input type="hidden" name="sets_done" value={agg.done} />
          <input type="hidden" name="sets_total" value={agg.total} />
          <input type="hidden" name="volume_kg" value={agg.volume} />
          <input type="hidden" name="avg_rpe" value={agg.avgRpe != null ? agg.avgRpe.toFixed(2) : ""} />

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-zinc-300">Sentiste desconforto?</legend>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 has-[:checked]:border-zinc-300">
              <input
                type="checkbox"
                checked={semDesconforto}
                onChange={(ev) => setSemDesconforto(ev.currentTarget.checked)}
                className="size-4 accent-zinc-100"
              />
              Nenhum
            </label>
            {!semDesconforto ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ZONES.map((z) => (
                  <label
                    key={z}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 has-[:checked]:border-amber-400"
                  >
                    <input
                      type="checkbox"
                      name="discomfort_zones"
                      value={z}
                      className="size-3.5 accent-amber-400"
                    />
                    {ZONE_LABEL[z]}
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-zinc-300">Como foi o esforço?</legend>
            <div className="grid grid-cols-2 gap-2">
              {EFFORTS.map((ef, i) => (
                <label
                  key={ef.id}
                  className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition has-[:checked]:border-zinc-300 has-[:checked]:bg-zinc-800"
                >
                  <input
                    type="radio"
                    name="effort"
                    value={ef.id}
                    defaultChecked={i === 1}
                    className="sr-only"
                  />
                  {ef.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-300">Nota (opcional)</span>
            <textarea
              name="note"
              rows={2}
              maxLength={500}
              placeholder="Algo a registar sobre este treino"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
            />
          </label>

          <button
            type="submit"
            disabled={pendente}
            className="rounded-lg bg-zinc-100 px-4 py-3 font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-60"
          >
            {pendente ? "A gravar…" : "Gravar treino"}
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SerieRow({
  n,
  serie,
  bw,
  onCarga,
  onFeito,
}: {
  n: number;
  serie: EstadoSerie;
  bw: boolean;
  onCarga: (w: number | null) => void;
  onFeito: (rpe: number) => void;
}) {
  const [aRegistar, setARegistar] = useState(false);

  return (
    <li
      className={`rounded-lg border p-2.5 ${
        serie.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800 bg-zinc-950"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 text-center text-xs font-semibold text-zinc-500">
          {n}ª
        </span>

        {bw || serie.w == null ? (
          <span className="flex-1 text-sm text-zinc-300">
            {serie.reps > 0 ? `${serie.reps} reps` : "até à falha"} · peso corporal
          </span>
        ) : (
          <span className="flex flex-1 items-center gap-2 text-sm text-zinc-300">
            <input
              type="number"
              inputMode="decimal"
              step={2.5}
              value={serie.w ?? ""}
              disabled={serie.done}
              onChange={(e) =>
                onCarga(e.currentTarget.value === "" ? null : Number(e.currentTarget.value))
              }
              className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-zinc-100 outline-none focus:border-zinc-400 disabled:opacity-60"
            />
            <span className="text-zinc-500">kg ×</span>
            <span className="font-medium text-zinc-200">{serie.reps}</span>
          </span>
        )}

        {serie.done ? (
          <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
            RPE {serie.rpe}
          </span>
        ) : !aRegistar ? (
          <button
            type="button"
            onClick={() => setARegistar(true)}
            className="shrink-0 rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Feito
          </button>
        ) : null}
      </div>

      {aRegistar && !serie.done ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">RPE</span>
          {[6, 7, 8, 9, 10].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                onFeito(r);
                setARegistar(false);
              }}
              className="h-8 w-8 rounded-md border border-zinc-700 text-sm font-semibold text-zinc-200 hover:border-zinc-400 hover:bg-zinc-800"
            >
              {r}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
