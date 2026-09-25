"use client";

/**
 * Ponto de entrada do perfil no cabeçalho do atleta — um avatar que abre um
 * menu curto. O perfil completo (foto, stats, publicações) é da Fase 3;
 * por agora o menu só tem o que já existe e precisava de sair do topo do
 * ecrã: terminar sessão (ponto 19 do plano — não fica um botão gigante a
 * competir com o treino de hoje).
 */
import { useEffect, useRef, useState } from "react";
import { sair } from "@/app/actions/auth";

const COR = {
  tinta: "var(--apex-tinta)",
  branco: "var(--apex-branco)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
} as const;

export function MenuPerfil({ nome }: { nome: string | null }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inicial = (nome ?? "?").trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    function aoEscapar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoEscapar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoEscapar);
    };
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Perfil e definições"
        onClick={() => setAberto((v) => !v)}
        className="apex-avatar apex-avatar--pequeno"
        style={{ border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          {inicial}
        </span>
      </button>

      {aberto ? (
        <div
          role="menu"
          className="absolute right-0 z-10 flex flex-col"
          style={{
            top: "calc(100% + 8px)",
            minWidth: 180,
            background: COR.branco,
            border: `1px solid ${COR.linha}`,
          }}
        >
          <form action={sair}>
            <button
              type="submit"
              role="menuitem"
              className="apex-tipo-secundario w-full text-left"
              style={{ padding: "var(--apex-space-3) var(--apex-space-4)", color: COR.tinta, background: "none", border: "none", cursor: "pointer" }}
            >
              Terminar sessão
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
