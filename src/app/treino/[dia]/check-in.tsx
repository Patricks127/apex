"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { gravarTreino, type EstadoRegisto } from "@/app/actions/treino";

const EFFORTS = [
  { id: "abaixo", label: "Abaixo do esperado" },
  { id: "equilibrado", label: "Equilibrado" },
  { id: "limite", label: "No limite" },
  { id: "passei", label: "Passei-me" },
] as const;

const ZONES = ["ombro", "cotovelo", "pulso", "joelho", "lombar", "anca", "tornozelo", "pescoco"] as const;
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

export function CheckIn({
  titulo,
  weekNumber,
  agg,
  logsJson,
}: {
  titulo: string;
  weekNumber: number;
  agg: { done: number; total: number; volume: number; avgRpe: number | null };
  logsJson: string;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState(gravarTreino, {} as EstadoRegisto);
  const [semDesconforto, setSemDesconforto] = useState(true);

  return (
    <div className="apex-treino flex-1">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 py-8">
        {/* Chega-se aqui por estado do cliente (fase==="checkin"), nunca
            uma navegação própria — router.back() vai para quem levou a
            /treino/[dia] (painel ou plano), o mesmo destino sensato de
            desistir do check-in. Visível, não só o gesto do telemóvel. */}
        <button
          type="button"
          className="apex-treino-botao-lista self-start"
          onClick={() => router.back()}
          aria-label="Voltar"
        >
          ←
        </button>
        <div>
          <p className="apex-tipo-etiqueta" style={{ color: "var(--apex-texto-fraco)" }}>
            Treino feito
          </p>
          <h1 className="apex-tipo-titulo-ecra" style={{ color: "var(--apex-texto-treino)" }}>
            {titulo}
          </h1>
          <p className="apex-tipo-secundario apex-tabular" style={{ color: "var(--apex-texto-fraco)" }}>
            {agg.done}/{agg.total} séries · {agg.volume} kg movimentados
            {agg.avgRpe != null ? ` · RPE médio ${agg.avgRpe.toFixed(1)}` : ""}
          </p>
        </div>

        <form action={acao} className="flex flex-col gap-5">
          <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: "var(--apex-texto-treino)" }}>
            Check-in pós-treino
          </h2>
          {estado.erro ? (
            <p className="apex-tipo-secundario" style={{ color: "var(--apex-erro)" }} role="alert">
              {estado.erro}
            </p>
          ) : null}

          <input type="hidden" name="title" value={titulo} />
          <input type="hidden" name="week_number" value={weekNumber} />
          <input type="hidden" name="sets_done" value={agg.done} />
          <input type="hidden" name="sets_total" value={agg.total} />
          <input type="hidden" name="volume_kg" value={agg.volume} />
          <input type="hidden" name="avg_rpe" value={agg.avgRpe != null ? agg.avgRpe.toFixed(2) : ""} />
          <input type="hidden" name="logs_json" value={logsJson} />

          <ZonasDesconforto semDesconforto={semDesconforto} onMudar={setSemDesconforto} />

          <fieldset className="flex flex-col gap-2">
            <legend className="apex-tipo-secundario" style={{ color: "var(--apex-texto-fraco)" }}>
              Como foi o esforço?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {EFFORTS.map((ef, i) => (
                <label
                  key={ef.id}
                  className="apex-tipo-secundario cursor-pointer border px-3 py-2.5 transition"
                  style={{ borderColor: "var(--apex-linha-treino)", borderRadius: 14, color: "var(--apex-texto-treino)" }}
                >
                  <input type="radio" name="effort" value={ef.id} defaultChecked={i === 1} className="sr-only" />
                  {ef.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="apex-tipo-secundario" style={{ color: "var(--apex-texto-fraco)" }}>
              Nota (opcional)
            </span>
            <textarea
              name="note"
              rows={2}
              maxLength={500}
              placeholder="Algo a registar sobre este treino"
              className="apex-tipo-corpo border px-3 py-2 outline-none"
              style={{ borderColor: "var(--apex-linha-treino)", borderRadius: 14, background: "transparent", color: "var(--apex-texto-treino)" }}
            />
          </label>

          <button type="submit" disabled={pendente} className="apex-botao apex-botao--treino">
            {pendente ? "A gravar…" : "Gravar treino"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ZonasDesconforto({
  semDesconforto,
  onMudar,
}: {
  semDesconforto: boolean;
  onMudar: (v: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="apex-tipo-secundario" style={{ color: "var(--apex-texto-fraco)" }}>
        Sentiste desconforto?
      </legend>
      <label
        className="apex-tipo-secundario flex cursor-pointer items-center gap-2 border px-3 py-2"
        style={{ borderColor: "var(--apex-linha-treino)", borderRadius: 10, color: "var(--apex-texto-treino)" }}
      >
        <input
          type="checkbox"
          checked={semDesconforto}
          onChange={(e) => onMudar(e.currentTarget.checked)}
          className="size-4"
        />
        Nenhum
      </label>
      {!semDesconforto ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ZONES.map((z) => (
            <label
              key={z}
              className="apex-tipo-secundario flex cursor-pointer items-center gap-2 border px-2 py-2"
              style={{ borderColor: "var(--apex-linha-treino)", borderRadius: 10, color: "var(--apex-texto-treino)" }}
            >
              <input type="checkbox" name="discomfort_zones" value={z} className="size-3.5" />
              {ZONE_LABEL[z]}
            </label>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
