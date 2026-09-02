"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import type { PlanoGerado, DiaGerado, Lift } from "@/lib/motor";
import { regenerarPlano, avancarSemana, type EstadoAvanco } from "@/app/actions/treino";

const LIFT_LABEL: Record<Lift, string> = {
  agachamento: "Agach.",
  terra: "Terra",
  supino: "Supino",
  press: "Press",
};

export function VistaPlano({
  plano,
  nome,
}: {
  plano: PlanoGerado;
  nome: string;
}) {
  const primeiroTreino = plano.days.findIndex((d) => !d.rest);
  const [sel, setSel] = useState(primeiroTreino < 0 ? 0 : primeiroTreino);
  const dia = plano.days[sel];

  const cargas = (Object.keys(plano.meta.maxes.used) as Lift[])
    .map(
      (k) =>
        `${LIFT_LABEL[k]} ${plano.meta.maxes.used[k]} kg${
          plano.meta.maxes.real.includes(k) ? "" : "*"
        }`,
    )
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-600">
          <span>O teu plano</span>
          <span>· semana {plano.meta.week ?? 1}</span>
          {plano.meta.deloadWeek ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-300">
              descarga
            </span>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold text-zinc-100">{nome}</h1>
        <p className="text-sm text-zinc-400">{plano.meta.science}</p>
      </header>

      {/* Tira da semana */}
      <div className="grid grid-cols-7 gap-1.5">
        {plano.days.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSel(i)}
            className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs transition ${
              i === sel
                ? "border-zinc-300 bg-zinc-800 text-zinc-100"
                : d.rest
                  ? "border-zinc-800 bg-zinc-950 text-zinc-600"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            <span className="font-semibold">{d.dayShort}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                d.rest ? "bg-zinc-700" : "bg-emerald-400"
              }`}
            />
          </button>
        ))}
      </div>

      <DiaDetalhe dia={dia} />

      <p className="text-xs text-zinc-600">
        Cargas de referência: {cargas}{" "}
        <span className="text-zinc-500">(* = estimado do nível/sexo; sem * = recorde teu)</span>
      </p>

      <AvancarSemana />

      <form action={regenerarPlano}>
        <button
          type="submit"
          className="w-full rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          Regenerar plano (reinicia a progressão)
        </button>
      </form>
    </div>
  );
}

function AvancarSemana() {
  const [estado, acao, pendente] = useActionState(avancarSemana, {} as EstadoAvanco);

  return (
    <form
      action={acao}
      className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
    >
      <div>
        <p className="text-sm font-semibold text-zinc-200">Fechar a semana</p>
        <p className="text-xs text-zinc-500">
          Junta o RPE e o volume das sessões desta semana e decide a próxima:
          progride, mantém ou descarga.
        </p>
      </div>

      {estado.erro ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {estado.erro}
        </p>
      ) : null}

      {estado.ok ? (
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
          <p className="font-medium text-zinc-100">
            Semana {estado.semana}
            {estado.deload ? " · descarga" : ""}
          </p>
          {estado.reason ? <p className="text-xs text-zinc-400">{estado.reason}</p> : null}
          <table className="mt-1 text-xs">
            <tbody>
              {estado.cargas?.map((c) => (
                <tr key={c.lift} className="text-zinc-400">
                  <td className="py-0.5 pr-3 text-zinc-300">{c.lift}</td>
                  <td className="py-0.5 pr-2 font-mono">{c.antes} kg</td>
                  <td className="py-0.5 pr-2">→</td>
                  <td
                    className={`py-0.5 font-mono ${
                      c.depois > c.antes
                        ? "text-emerald-400"
                        : c.depois < c.antes
                          ? "text-amber-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {c.depois} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pendente}
        className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-60"
      >
        {pendente ? "A calcular…" : "Avançar para a próxima semana"}
      </button>
    </form>
  );
}

function DiaDetalhe({ dia }: { dia: DiaGerado }) {
  if (dia.rest) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center">
        <p className="text-sm font-semibold text-zinc-300">{dia.dayName}</p>
        <p className="mt-1 text-sm text-zinc-500">Descanso. Recuperar faz parte do treino.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-600">{dia.dayName}</p>
          <h2 className="text-lg font-semibold text-zinc-100">{dia.title}</h2>
        </div>
        <Link
          href={`/treino/${dia.dayIndex}`}
          className="shrink-0 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-white"
        >
          Registar treino
        </Link>
      </div>

      {dia.why && dia.why.length > 0 ? (
        <ul className="flex flex-col gap-1 border-l-2 border-zinc-800 pl-3 text-xs text-zinc-500">
          {dia.why.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}

      {dia.warmup && dia.warmup.length > 0 ? (
        <Bloco titulo="Aquecimento" itens={dia.warmup.map((m) => `${m.name} — ${m.dose}`)} />
      ) : null}

      {dia.rehab && dia.rehab.length > 0 ? (
        <Bloco
          titulo="Mobilidade / prevenção"
          itens={dia.rehab.map((m) => `${m.name} — ${m.dose}`)}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Treino
        </p>
        <ol className="flex flex-col gap-2">
          {dia.exercises!.map((e, i) => {
            const s = e.sets[0];
            const carga =
              s.w != null ? `${s.w} kg` : e.bw ? "peso corporal" : "—";
            const reps = s.reps > 0 ? `${e.sets.length}×${s.reps}` : `${e.sets.length} séries`;
            return (
              <li
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-100">
                    {i + 1}. {e.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-zinc-400">
                    {reps} · {carga}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span>RPE {s.rpe}</span>
                  <span>desc. {e.rest}</span>
                  {e.muscle ? <span>{e.muscle}</span> : null}
                  {e.substituted ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-300">
                      substituído por lesão
                    </span>
                  ) : null}
                  {e.focusTag ? (
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-medium text-sky-300">
                      foco: {e.focusTag}
                    </span>
                  ) : null}
                </div>
                {e.swap ? (
                  <p className="mt-1 text-xs text-amber-400/80">{e.swap}</p>
                ) : null}
                {e.detail ? (
                  <p className="mt-1 text-xs text-zinc-500">{e.detail}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {dia.cooldown && dia.cooldown.length > 0 ? (
        <Bloco
          titulo="Retorno à calma"
          itens={dia.cooldown.map((m) => `${m.name} — ${m.dose}`)}
        />
      ) : null}
    </section>
  );
}

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {titulo}
      </p>
      <ul className="flex flex-col gap-0.5 text-xs text-zinc-400">
        {itens.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
