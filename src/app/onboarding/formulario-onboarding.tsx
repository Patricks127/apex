"use client";

import { useActionState, useState } from "react";
import {
  GOALS,
  SEXES,
  LEVELS,
  LOCATIONS,
  INJURIES,
  FOCUS_MUSCLES,
} from "@/lib/motor";
import { guardarOnboarding, type EstadoOnboarding } from "@/app/actions/treino";
import { AvisoErro } from "@/app/_ui/campos";

const ESTADO_INICIAL: EstadoOnboarding = {};

export function FormularioOnboarding({
  inicial,
}: {
  inicial: {
    goal: string | null;
    sex: string | null;
    level: string | null;
    days_per_week: number | null;
    location: string | null;
    location_note: string | null;
    injuries: string[];
    injury_note: string | null;
    focus_muscles: string[];
    split_format: string | null;
  };
}) {
  const [estado, acao, pendente] = useActionState(guardarOnboarding, ESTADO_INICIAL);
  const [goal, setGoal] = useState(inicial.goal ?? "");
  const [location, setLocation] = useState(inicial.location ?? "");
  const [temLesao, setTemLesao] = useState(inicial.injuries.length > 0);

  return (
    <form action={acao} className="flex flex-col gap-7" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-100">Vamos montar o teu plano</h1>
        <p className="text-sm text-zinc-400">
          Seis perguntas. O motor gera a semana a seguir.
        </p>
      </div>

      {estado.mensagem ? <AvisoErro>{estado.mensagem}</AvisoErro> : null}

      <Seccao titulo="Qual é o objetivo?" erro={estado.erros?.goal}>
        <div className="grid gap-2">
          {GOALS.map((g) => (
            <Opcao
              key={g.id}
              name="goal"
              value={g.id}
              titulo={g.label}
              checkedPorDefeito={goal === g.id}
              onChange={() => setGoal(g.id)}
            />
          ))}
        </div>
      </Seccao>

      <Seccao titulo="Sexo" erro={estado.erros?.sex} nota="Usado só para estimar cargas de partida.">
        <div className="grid grid-cols-2 gap-2">
          {SEXES.map((s) => (
            <Opcao
              key={s.id}
              name="sex"
              value={s.id}
              titulo={s.label}
              checkedPorDefeito={inicial.sex === s.id}
            />
          ))}
        </div>
      </Seccao>

      <Seccao titulo="Nível de treino" erro={estado.erros?.level}>
        <div className="grid gap-2">
          {LEVELS.map((l) => (
            <Opcao
              key={l.id}
              name="level"
              value={l.id}
              titulo={l.label}
              checkedPorDefeito={inicial.level === l.id}
            />
          ))}
        </div>
      </Seccao>

      <Seccao titulo="Dias por semana" erro={estado.erros?.days_per_week}>
        <div className="grid grid-cols-4 gap-2">
          {[3, 4, 5, 6].map((n) => (
            <Opcao
              key={n}
              name="days_per_week"
              value={String(n)}
              titulo={String(n)}
              centro
              checkedPorDefeito={inicial.days_per_week === n}
            />
          ))}
        </div>
      </Seccao>

      <Seccao titulo="Onde treinas?" erro={estado.erros?.location}>
        <div className="grid gap-2">
          {LOCATIONS.map((l) => (
            <Opcao
              key={l.id}
              name="location"
              value={l.id}
              titulo={l.label}
              checkedPorDefeito={location === l.id}
              onChange={() => setLocation(l.id)}
            />
          ))}
        </div>
        {location === "outro" ? (
          <input
            name="location_note"
            type="text"
            defaultValue={inicial.location_note ?? ""}
            placeholder="Descreve o local (ex.: garagem com halteres e barra)"
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-400"
          />
        ) : null}
        {estado.erros?.location_note ? (
          <span className="text-xs text-red-400">{estado.erros.location_note}</span>
        ) : null}
      </Seccao>

      <Seccao
        titulo="Lesões ou zonas a poupar"
        nota="Opcional. O motor substitui exercícios de risco e junta mobilidade."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INJURIES.map((i) => (
            <Check
              key={i.id}
              name="injuries"
              value={i.id}
              titulo={i.label}
              defaultChecked={inicial.injuries.includes(i.id)}
              onChange={(checked) => {
                if (checked) setTemLesao(true);
              }}
            />
          ))}
        </div>
        {temLesao ? (
          <input
            name="injury_note"
            type="text"
            defaultValue={inicial.injury_note ?? ""}
            placeholder="Detalhe (opcional): ex. dor no ombro direito a puxar"
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-400"
          />
        ) : null}
      </Seccao>

      {goal === "hipertrofia" ? (
        <Seccao
          titulo="Formato do split"
          nota="Como queres dividir a semana."
        >
          <div className="grid gap-2">
            <OpcaoDetalhe
              name="split_format"
              value="frequencia"
              titulo="Superior / Inferior"
              descricao="Cada músculo 2×/semana. Reparte o volume em sessões mais curtas e de melhor qualidade."
              checkedPorDefeito={inicial.split_format !== "muscular"}
            />
            <OpcaoDetalhe
              name="split_format"
              value="muscular"
              titulo="Por grupo muscular"
              descricao="Peito+Tríceps, Costas+Bíceps, Pernas, Ombros… Cada músculo 1×/semana. É o formato clássico de ginásio."
              checkedPorDefeito={inicial.split_format === "muscular"}
            />
          </div>
        </Seccao>
      ) : null}

      {goal === "hipertrofia" ? (
        <Seccao titulo="Algum grupo a reforçar?" nota="Opcional. Acrescenta trabalho extra no dia certo.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FOCUS_MUSCLES.map((f) => (
              <Check
                key={f.id}
                name="focus_muscles"
                value={f.id}
                titulo={f.label}
                defaultChecked={inicial.focus_muscles.includes(f.id)}
              />
            ))}
          </div>
        </Seccao>
      ) : null}

      <button
        type="submit"
        disabled={pendente}
        className="mt-1 rounded-lg bg-zinc-100 px-4 py-3 font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-60"
      >
        {pendente ? "A gerar o plano…" : "Gerar o meu plano"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Seccao({
  titulo,
  nota,
  erro,
  children,
}: {
  titulo: string;
  nota?: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-zinc-200">{titulo}</legend>
      {nota ? <p className="-mt-1 text-xs text-zinc-500">{nota}</p> : null}
      {children}
      {erro ? <span className="text-xs text-red-400">{erro}</span> : null}
    </fieldset>
  );
}

function Opcao({
  name,
  value,
  titulo,
  checkedPorDefeito,
  onChange,
  centro,
}: {
  name: string;
  value: string;
  titulo: string;
  checkedPorDefeito?: boolean;
  onChange?: () => void;
  centro?: boolean;
}) {
  return (
    <label
      className={`cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 transition has-[:checked]:border-zinc-300 has-[:checked]:bg-zinc-800 ${
        centro ? "text-center font-semibold" : ""
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={checkedPorDefeito}
        onChange={onChange}
        className="sr-only"
      />
      {titulo}
    </label>
  );
}

function OpcaoDetalhe({
  name,
  value,
  titulo,
  descricao,
  checkedPorDefeito,
}: {
  name: string;
  value: string;
  titulo: string;
  descricao: string;
  checkedPorDefeito?: boolean;
}) {
  return (
    <label className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 transition has-[:checked]:border-zinc-300 has-[:checked]:bg-zinc-800">
      <input type="radio" name={name} value={value} defaultChecked={checkedPorDefeito} className="sr-only" />
      <span className="block text-sm font-semibold text-zinc-100">{titulo}</span>
      <span className="mt-0.5 block text-xs text-zinc-400">{descricao}</span>
    </label>
  );
}

function Check({
  name,
  value,
  titulo,
  defaultChecked,
  onChange,
}: {
  name: string;
  value: string;
  titulo: string;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition has-[:checked]:border-zinc-300 has-[:checked]:bg-zinc-800">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
        className="size-4 accent-zinc-100"
      />
      {titulo}
    </label>
  );
}
