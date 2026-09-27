"use client";

import { useEffect, useState } from "react";
import { OPCOES_RESERVA } from "@/lib/formato";

/** Sobe de baixo, 280ms (0ms com prefers-reduced-motion, via
 *  --apex-mov-duracao — resolvido em CSS, não precisa de JS aqui).
 *
 *  Pergunta em reps na reserva — a MESMA escala do alvo da série ("RIR
 *  1–3"). Cada botão devolve o RPE equivalente (RIR = 10 − RPE, exato:
 *  4+→6 … 0→10), por isso a autorregulação, o descanso e a progressão
 *  continuam a receber exatamente o que recebiam. */
export function PainelRpe({ onEscolher }: { onEscolher: (rpe: number) => void }) {
  const [aEntrar, setAEntrar] = useState(true);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAEntrar(false));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="apex-rpe-fundo">
      <div className="apex-rpe-painel" data-a-entrar={aEntrar} role="dialog" aria-label="Reps na reserva nesta série">
        <p className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: "var(--apex-texto-treino)" }}>
          Quantas reps ainda conseguias fazer?
        </p>
        <p
          className="apex-tipo-secundario"
          style={{ marginBottom: "var(--apex-space-4)", color: "var(--apex-texto-fraco)" }}
        >
          Reps na reserva — 0 é até à falha.
        </p>
        <div className="apex-rpe-grelha">
          {OPCOES_RESERVA.map((o) => (
            <button
              key={o.rpe}
              type="button"
              className="apex-rpe-botao"
              aria-label={o.descricao}
              onClick={() => onEscolher(o.rpe)}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
