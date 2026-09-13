"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usa-reduced-motion";

const RAIO = 88;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

function formatarTempo(seg: number): string {
  const mm = String(Math.floor(seg / 60)).padStart(1, "0");
  const ss = String(seg % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Ecrã cheio, o anel a esvaziar é informação (quanto falta), não
 *  decoração — por isso com prefers-reduced-motion não fica "um anel
 *  estático", desaparece de vez e mostra só o número. */
export function EcraDescanso({
  duracaoSeg,
  proximoNome,
  proximoValor,
  onFim,
  onSaltar,
}: {
  duracaoSeg: number;
  proximoNome: string;
  proximoValor: string;
  onFim: () => void;
  onSaltar: () => void;
}) {
  const [restante, setRestante] = useState(duracaoSeg);
  const reduzido = usePrefersReducedMotion();
  const idRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chamouFimRef = useRef(false);

  useEffect(() => {
    idRef.current = setInterval(() => {
      setRestante((r) => {
        if (r <= 1) {
          if (idRef.current) clearInterval(idRef.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (idRef.current) clearInterval(idRef.current);
    };
  }, []);

  useEffect(() => {
    if (restante === 0 && !chamouFimRef.current) {
      chamouFimRef.current = true;
      onFim();
    }
  }, [restante, onFim]);

  const fracao = duracaoSeg > 0 ? restante / duracaoSeg : 0;

  return (
    <div className="apex-descanso" role="status" aria-live="polite">
      <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-texto-fraco)" }}>
        Descanso
      </span>

      {reduzido ? (
        <span className="apex-tipo-carga-treino apex-tabular" style={{ color: "var(--apex-texto-treino)" }}>
          {formatarTempo(restante)}
        </span>
      ) : (
        <div style={{ position: "relative", width: 200, height: 200 }}>
          <svg className="apex-descanso-anel" width="200" height="200">
            <circle className="apex-descanso-anel__fundo" cx="100" cy="100" r={RAIO} />
            <circle
              className="apex-descanso-anel__progresso"
              cx="100"
              cy="100"
              r={RAIO}
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - fracao)}
            />
          </svg>
          <span
            className="apex-tipo-carga-treino apex-tabular"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              color: "var(--apex-texto-treino)",
            }}
          >
            {formatarTempo(restante)}
          </span>
        </div>
      )}

      <div className="flex flex-col items-center gap-1">
        <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-texto-fraco)" }}>
          A seguir
        </span>
        <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-texto-treino)" }}>
          {proximoNome}
        </span>
        <span className="apex-tabular" style={{ color: "var(--apex-texto-fraco)" }}>
          {proximoValor}
        </span>
      </div>

      <button
        type="button"
        className="apex-botao apex-botao--treino"
        style={{ maxWidth: 280 }}
        onClick={onSaltar}
      >
        Saltar descanso
      </button>
    </div>
  );
}
