"use client";

import { useActionState, useMemo, useState } from "react";
import { atribuirPlanoPt, type EstadoAtribuirPlano } from "@/app/actions/treino";

export type ExercicioPicker = { id: string; nome: string; familia: string; musculo: string; equipamento: string[] };
export type ExercicioEditorInicial = {
  exercicioId: string;
  nome: string;
  tipo: string;
  series: number;
  reps: number;
  carga: number | null;
  durationMin: number | null;
  distanceKm: number | null;
  nota: string;
};
export type DiaEditorInicial = { nome: string; exercicios: ExercicioEditorInicial[] };

type ExercicioState = {
  chave: string;
  exercicioId: string;
  nome: string;
  tipo: string;
  series: string;
  reps: string;
  carga: string;
  durationMin: string;
  distanceKm: string;
  nota: string;
};
type DiaState = { chave: string; nome: string; exercicios: ExercicioState[] };

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
  fundo: "var(--apex-cinza-fundo)",
  erro: "var(--apex-erro)",
} as const;

const EXERCISE_TYPES = [
  { id: "strength", label: "Força" },
  { id: "cardio", label: "Cardio" },
  { id: "running", label: "Corrida" },
  { id: "mobility", label: "Mobilidade" },
] as const;

let seq = 0;
const novaChave = () => `k${++seq}`;
const diaVazio = (): DiaState => ({ chave: novaChave(), nome: "", exercicios: [] });

const ESTADO_INICIAL: EstadoAtribuirPlano = {};
const MAX_DIAS = 6;

export function EditorPlanoPt({
  alunoId,
  exercicios,
  nomeInicial,
  diasIniciais,
}: {
  alunoId: string;
  exercicios: ExercicioPicker[];
  nomeInicial: string;
  diasIniciais?: DiaEditorInicial[];
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [dias, setDias] = useState<DiaState[]>(() =>
    diasIniciais && diasIniciais.length > 0
      ? diasIniciais.map((d) => ({
          chave: novaChave(),
          nome: d.nome,
          exercicios: d.exercicios.map((e) => ({
            chave: novaChave(),
            exercicioId: e.exercicioId,
            nome: e.nome,
            tipo: e.tipo || "strength",
            series: String(e.series),
            reps: String(e.reps),
            carga: e.carga != null ? String(e.carga) : "",
            durationMin: e.durationMin != null ? String(e.durationMin) : "",
            distanceKm: e.distanceKm != null ? String(e.distanceKm) : "",
            nota: e.nota,
          })),
        }))
      : [diaVazio()],
  );
  const [estado, acao, pendente] = useActionState(atribuirPlanoPt, ESTADO_INICIAL);

  const planoJson = useMemo(
    () =>
      JSON.stringify(
        dias.map((d) => ({
          nome: d.nome,
          exercicios: d.exercicios.map((e) => ({
            exercicioId: e.exercicioId,
            tipo: e.tipo || "strength",
            series: Number(e.series) || 0,
            reps: Number(e.reps) || 0,
            carga: e.carga.trim() === "" ? null : e.carga.trim(),
            durationMin: e.durationMin.trim() === "" ? null : Number(e.durationMin) || null,
            distanceKm: e.distanceKm.trim() === "" ? null : Number(e.distanceKm) || null,
            nota: e.nota,
          })),
        })),
      ),
    [dias],
  );

  const atualizarDia = (chave: string, patch: Partial<DiaState>) =>
    setDias((prev) => prev.map((d) => (d.chave === chave ? { ...d, ...patch } : d)));
  const removerDia = (chave: string) => setDias((prev) => prev.filter((d) => d.chave !== chave));
  const adicionarDia = () => setDias((prev) => (prev.length >= MAX_DIAS ? prev : [...prev, diaVazio()]));
  const adicionarExercicio = (diaChave: string, ex: ExercicioPicker) =>
    setDias((prev) =>
      prev.map((d) =>
        d.chave === diaChave
          ? {
              ...d,
              exercicios: [
                ...d.exercicios,
                {
                  chave: novaChave(),
                  exercicioId: ex.id,
                  nome: ex.nome,
                  tipo: "strength",
                  series: "3",
                  reps: "10",
                  carga: "",
                  durationMin: "",
                  distanceKm: "",
                  nota: "",
                },
              ],
            }
          : d,
      ),
    );
  const atualizarExercicio = (diaChave: string, exChave: string, patch: Partial<ExercicioState>) =>
    setDias((prev) =>
      prev.map((d) =>
        d.chave !== diaChave
          ? d
          : { ...d, exercicios: d.exercicios.map((e) => (e.chave === exChave ? { ...e, ...patch } : e)) },
      ),
    );
  const removerExercicio = (diaChave: string, exChave: string) =>
    setDias((prev) =>
      prev.map((d) => (d.chave !== diaChave ? d : { ...d, exercicios: d.exercicios.filter((e) => e.chave !== exChave) })),
    );
  const moverExercicio = (diaChave: string, exChave: string, direcao: "cima" | "baixo") =>
    setDias((prev) =>
      prev.map((d) => {
        if (d.chave !== diaChave) return d;
        const idx = d.exercicios.findIndex((e) => e.chave === exChave);
        if (idx === -1) return d;
        const novoIdx = direcao === "cima" ? idx - 1 : idx + 1;
        if (novoIdx < 0 || novoIdx >= d.exercicios.length) return d;
        const lista = [...d.exercicios];
        [lista[idx], lista[novoIdx]] = [lista[novoIdx], lista[idx]];
        return { ...d, exercicios: lista };
      }),
    );

  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="aluno_id" value={alunoId} />
      <input type="hidden" name="plano_json" value={planoJson} />

      {estado.erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }} role="alert">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p className="apex-tipo-secundario" style={{ color: COR.tinta }}>
          Plano gravado e ativado — o aluno já pode segui-lo.
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="apex-tipo-secundario" style={{ color: COR.fraco }}>
          Nome do plano
        </span>
        <input
          name="nome"
          value={nome}
          onChange={(e) => setNome(e.currentTarget.value)}
          placeholder="ex.: Hipertrofia · 4 dias"
          maxLength={80}
          required
          className="apex-tipo-corpo border px-3 py-2.5 outline-none"
          style={{ borderColor: COR.linha, borderRadius: 2, background: "transparent", color: COR.tinta }}
        />
      </label>

      <div className="flex flex-col gap-4">
        {dias.map((d, i) => (
          <DiaCard
            key={d.chave}
            indice={i}
            dia={d}
            exerciciosBase={exercicios}
            onNome={(nomeD) => atualizarDia(d.chave, { nome: nomeD })}
            onRemover={() => removerDia(d.chave)}
            onAdicionarExercicio={(ex) => adicionarExercicio(d.chave, ex)}
            onAtualizarExercicio={(exChave, patch) => atualizarExercicio(d.chave, exChave, patch)}
            onRemoverExercicio={(exChave) => removerExercicio(d.chave, exChave)}
            onMoverExercicio={(exChave, dir) => moverExercicio(d.chave, exChave, dir)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={adicionarDia}
        disabled={dias.length >= MAX_DIAS}
        className="apex-tipo-secundario border px-4 py-2.5 disabled:opacity-40"
        style={{ borderColor: COR.linha, borderStyle: "dashed", color: COR.fraco }}
      >
        + Adicionar dia de treino
      </button>

      <button type="submit" disabled={pendente} className="apex-botao apex-botao--claro">
        {pendente ? "A gravar…" : "Gravar plano"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------

function DiaCard({
  indice,
  dia,
  exerciciosBase,
  onNome,
  onRemover,
  onAdicionarExercicio,
  onAtualizarExercicio,
  onRemoverExercicio,
  onMoverExercicio,
}: {
  indice: number;
  dia: DiaState;
  exerciciosBase: ExercicioPicker[];
  onNome: (nome: string) => void;
  onRemover: () => void;
  onAdicionarExercicio: (ex: ExercicioPicker) => void;
  onAtualizarExercicio: (exChave: string, patch: Partial<ExercicioState>) => void;
  onRemoverExercicio: (exChave: string) => void;
  onMoverExercicio: (exChave: string, direcao: "cima" | "baixo") => void;
}) {
  const [aPesquisar, setAPesquisar] = useState(false);

  return (
    <div className="flex flex-col gap-3 border p-4" style={{ borderColor: COR.linha, background: COR.fundo }}>
      <div className="flex items-center gap-2">
        <span className="apex-tipo-etiqueta shrink-0" style={{ color: COR.fraco }}>
          Dia {indice + 1}
        </span>
        <input
          value={dia.nome}
          onChange={(e) => onNome(e.currentTarget.value)}
          placeholder="ex.: Peito e Tríceps"
          maxLength={60}
          className="apex-tipo-corpo flex-1 border px-3 py-2 outline-none"
          style={{ borderColor: COR.linha, borderRadius: 2, background: "var(--apex-branco)", color: COR.tinta }}
        />
        <button
          type="button"
          onClick={onRemover}
          className="apex-tipo-etiqueta shrink-0 border px-2 py-1.5"
          style={{ borderColor: COR.linha, color: COR.fraco }}
        >
          Remover dia
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {dia.exercicios.map((e, idx) => (
          <li key={e.chave} className="border p-3" style={{ borderColor: COR.linha, background: "var(--apex-branco)" }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
                {e.nome}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onMoverExercicio(e.chave, "cima")}
                  disabled={idx === 0}
                  className="apex-tipo-etiqueta disabled:opacity-30"
                  style={{ color: COR.fraco }}
                  aria-label="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoverExercicio(e.chave, "baixo")}
                  disabled={idx === dia.exercicios.length - 1}
                  className="apex-tipo-etiqueta disabled:opacity-30"
                  style={{ color: COR.fraco }}
                  aria-label="Mover para baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemoverExercicio(e.chave)}
                  className="apex-tipo-etiqueta"
                  style={{ color: COR.fraco }}
                >
                  remover
                </button>
              </div>
            </div>

            {/* Tipo de exercício */}
            <div className="mt-2 flex gap-1 flex-wrap">
              {EXERCISE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onAtualizarExercicio(e.chave, { tipo: t.id })}
                  className="apex-tipo-etiqueta border px-2 py-0.5"
                  style={{
                    borderColor: e.tipo === t.id ? COR.tinta : COR.linha,
                    color: e.tipo === t.id ? COR.tinta : COR.fraco,
                    fontWeight: e.tipo === t.id ? 600 : undefined,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Campos condicionais por tipo */}
            {(e.tipo === "strength" || !e.tipo) ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <NumField label="séries" value={e.series} onChange={(v) => onAtualizarExercicio(e.chave, { series: v })} />
                <NumField label="reps" value={e.reps} onChange={(v) => onAtualizarExercicio(e.chave, { reps: v })} />
                <NumField
                  label="carga (kg)"
                  decimal
                  value={e.carga}
                  onChange={(v) => onAtualizarExercicio(e.chave, { carga: v })}
                  opcional
                />
              </div>
            ) : e.tipo === "mobility" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NumField label="reps / séries" value={e.reps} onChange={(v) => onAtualizarExercicio(e.chave, { reps: v })} />
                <NumField label="séries" value={e.series} onChange={(v) => onAtualizarExercicio(e.chave, { series: v })} opcional />
              </div>
            ) : (
              /* cardio ou running */
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NumField
                  label="duração (min)"
                  value={e.durationMin}
                  onChange={(v) => onAtualizarExercicio(e.chave, { durationMin: v })}
                />
                {e.tipo === "running" ? (
                  <NumField
                    label="distância (km)"
                    decimal
                    value={e.distanceKm}
                    onChange={(v) => onAtualizarExercicio(e.chave, { distanceKm: v })}
                    opcional
                  />
                ) : (
                  <NumField
                    label="séries"
                    value={e.series}
                    onChange={(v) => onAtualizarExercicio(e.chave, { series: v })}
                    opcional
                  />
                )}
              </div>
            )}

            <input
              value={e.nota}
              onChange={(ev) => onAtualizarExercicio(e.chave, { nota: ev.currentTarget.value })}
              placeholder="Observação (opcional) — ex.: cadência lenta na descida"
              maxLength={200}
              className="apex-tipo-secundario mt-2 w-full border px-2.5 py-1.5 outline-none"
              style={{ borderColor: COR.linha, borderRadius: 2, background: "transparent", color: COR.tinta }}
            />
          </li>
        ))}
        {dia.exercicios.length === 0 ? (
          <li className="apex-tipo-etiqueta border px-3 py-2" style={{ borderColor: COR.linha, borderStyle: "dashed", color: COR.fraco }}>
            Ainda sem exercícios.
          </li>
        ) : null}
      </ul>

      {aPesquisar ? (
        <SeletorExercicio
          exercicios={exerciciosBase}
          onEscolher={(ex) => {
            onAdicionarExercicio(ex);
            setAPesquisar(false);
          }}
          onFechar={() => setAPesquisar(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAPesquisar(true)}
          className="apex-tipo-etiqueta self-start border px-3 py-1.5"
          style={{ borderColor: COR.linha, color: COR.tinta, background: "var(--apex-branco)" }}
        >
          + Adicionar exercício
        </button>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  opcional,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcional?: boolean;
  /** carga (kg) aceita "72,5"; séries/reps são inteiros */
  decimal?: boolean;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
        {label}
        {opcional ? " (opc.)" : ""}
      </span>
      <input
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="apex-tipo-secundario apex-tabular border px-2 py-1.5 outline-none"
        style={{ borderColor: COR.linha, borderRadius: 2, background: "transparent", color: COR.tinta }}
      />
    </label>
  );
}

function SeletorExercicio({
  exercicios,
  onEscolher,
  onFechar,
}: {
  exercicios: ExercicioPicker[];
  onEscolher: (ex: ExercicioPicker) => void;
  onFechar: () => void;
}) {
  const [q, setQ] = useState("");
  const termo = q.trim().toLowerCase();
  const resultados = termo
    ? exercicios
        .filter(
          (e) =>
            e.nome.toLowerCase().includes(termo) ||
            e.musculo.toLowerCase().includes(termo) ||
            e.familia.toLowerCase().includes(termo),
        )
        .slice(0, 25)
    : exercicios.slice(0, 12);

  return (
    <div className="flex flex-col gap-2 border p-3" style={{ borderColor: COR.linha, background: "var(--apex-branco)" }}>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Pesquisar por nome ou músculo (ex.: supino, dorsais)"
          className="apex-tipo-corpo flex-1 border px-2.5 py-1.5 outline-none"
          style={{ borderColor: COR.linha, borderRadius: 2, background: "transparent", color: COR.tinta }}
        />
        <button type="button" onClick={onFechar} className="apex-tipo-etiqueta shrink-0" style={{ color: COR.fraco }}>
          fechar
        </button>
      </div>
      <ul className="flex max-h-64 flex-col overflow-y-auto">
        {resultados.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              onClick={() => onEscolher(ex)}
              className="apex-tipo-corpo flex w-full items-center justify-between gap-2 border-b py-2 text-left"
              style={{ borderColor: COR.linha, color: COR.tinta }}
            >
              <span>{ex.nome}</span>
              <span className="apex-tipo-etiqueta shrink-0" style={{ color: COR.fraco }}>
                {ex.musculo}
              </span>
            </button>
          </li>
        ))}
        {resultados.length === 0 ? (
          <li className="apex-tipo-etiqueta px-2 py-1.5" style={{ color: COR.fraco }}>
            Sem resultados.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
