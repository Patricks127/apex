"use client";

import { useState, useActionState } from "react";
import { gravarTreino, type EstadoRegisto } from "@/app/actions/treino";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
  erro: "var(--apex-erro)",
} as const;

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

/**
 * Mesmo vocabulário do check-in pós-treino ao vivo (treino/[dia]/check-
 * in.tsx) — zonas e opções de esforço idênticas, para o PT nunca ver dois
 * vocabulários diferentes para a mesma coisa. Estilo em modo CLARO (esta
 * página vive fora do treino ao vivo, que é a única zona escura da app).
 * Sem sets/volume/RPE/exercícios — só title + effort + discomfort_zones +
 * note, os únicos campos que fazem sentido sem um plano estruturado por
 * trás. gravarTreino já trata os campos ausentes com valores neutros
 * (sets=0 → completion null, avg_rpe null, week_number 1, logs_json []).
 */
export function RegistoLivre() {
  const [estado, acao, pendente] = useActionState(gravarTreino, {} as EstadoRegisto);
  const [semDesconforto, setSemDesconforto] = useState(true);

  return (
    <form action={acao} className="flex flex-col gap-5">
      {estado.erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }} role="alert">
          {estado.erro}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="apex-tipo-secundario" style={{ color: COR.fraco }}>
          Nome do treino
        </span>
        <input
          type="text"
          name="title"
          required
          maxLength={80}
          placeholder='Ex.: "Dia 1 — Pernas"'
          className="apex-tipo-corpo border px-3 py-2 outline-none"
          style={{ borderColor: COR.linha, borderRadius: 14, background: "transparent", color: COR.tinta }}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="apex-tipo-secundario" style={{ color: COR.fraco }}>
          Como correu o esforço?
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {EFFORTS.map((ef, i) => (
            <label
              key={ef.id}
              className="apex-tipo-secundario cursor-pointer border px-3 py-2.5 transition"
              style={{ borderColor: COR.linha, borderRadius: 14, color: COR.tinta }}
            >
              <input type="radio" name="effort" value={ef.id} defaultChecked={i === 1} className="sr-only" />
              {ef.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="apex-tipo-secundario" style={{ color: COR.fraco }}>
          Sentiste desconforto?
        </legend>
        <label
          className="apex-tipo-secundario flex cursor-pointer items-center gap-2 border px-3 py-2"
          style={{ borderColor: COR.linha, borderRadius: 10, color: COR.tinta }}
        >
          <input
            type="checkbox"
            checked={semDesconforto}
            onChange={(e) => setSemDesconforto(e.currentTarget.checked)}
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
                style={{ borderColor: COR.linha, borderRadius: 10, color: COR.tinta }}
              >
                <input type="checkbox" name="discomfort_zones" value={z} className="size-3.5" />
                {ZONE_LABEL[z]}
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="apex-tipo-secundario" style={{ color: COR.fraco }}>
          Nota (opcional)
        </span>
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          placeholder="Algo a registar sobre este treino"
          className="apex-tipo-corpo border px-3 py-2 outline-none"
          style={{ borderColor: COR.linha, borderRadius: 14, background: "transparent", color: COR.tinta }}
        />
      </label>

      <button type="submit" disabled={pendente} className="apex-botao apex-botao--claro">
        {pendente ? "A gravar…" : "Gravar treino"}
      </button>
    </form>
  );
}
