"use client";

import { useEffect, useState } from "react";

const VALORES = [6, 7, 8, 9, 10];

/** Sobe de baixo, 280ms (0ms com prefers-reduced-motion, via
 *  --apex-mov-duracao — resolvido em CSS, não precisa de JS aqui). */
export function PainelRpe({ onEscolher }: { onEscolher: (rpe: number) => void }) {
  const [aEntrar, setAEntrar] = useState(true);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAEntrar(false));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="apex-rpe-fundo">
      <div className="apex-rpe-painel" data-a-entrar={aEntrar} role="dialog" aria-label="Registar esforço da série">
        <p className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: "var(--apex-texto-treino)" }}>
          Como foi o esforço?
        </p>
        <p
          className="apex-tipo-secundario"
          style={{ marginBottom: "var(--apex-space-4)", color: "var(--apex-texto-fraco)" }}
        >
          RPE — 6 fácil, 10 até à falha.
        </p>
        <div className="apex-rpe-grelha">
          {VALORES.map((v) => (
            <button key={v} type="button" className="apex-rpe-botao" onClick={() => onEscolher(v)}>
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
