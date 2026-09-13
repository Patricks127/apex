"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { garantirCodigoPt } from "@/app/actions/ligacoes";

export function CodigoPt({ codigoInicial }: { codigoInicial: string | null }) {
  const [codigo, setCodigo] = useState<string | null>(codigoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<"codigo" | "link" | null>(null);
  const [pendente, startTransition] = useTransition();
  const jaPediu = useRef(false);

  useEffect(() => {
    if (codigo || jaPediu.current) return;
    jaPediu.current = true;
    startTransition(async () => {
      const r = await garantirCodigoPt();
      if ("codigo" in r) setCodigo(r.codigo);
      else setErro(r.erro);
    });
  }, [codigo]);

  async function copiar(texto: string, qual: "codigo" | "link") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* clipboard indisponível — ignora */
    }
  }

  return (
    <div>
      <p className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>
        Partilha o teu código para os atletas te enviarem um pedido de ligação.
      </p>

      {erro ? (
        <p className="apex-tipo-secundario mt-2" style={{ color: "var(--apex-erro)" }}>
          {erro}
        </p>
      ) : codigo ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="apex-tipo-titulo-seccao apex-tabular" style={{ marginTop: 0, color: "var(--apex-tinta)" }}>
              {codigo}
            </span>
            <button
              type="button"
              onClick={() => copiar(codigo, "codigo")}
              className="apex-tipo-etiqueta border px-2.5 py-1"
              style={{ borderColor: "var(--apex-cinza-linha)", color: "var(--apex-tinta)" }}
            >
              {copiado === "codigo" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="apex-tipo-secundario apex-tabular" style={{ color: "var(--apex-cinza-texto)" }}>
              apex.fit/pt/{codigo}
            </span>
            <button
              type="button"
              onClick={() => copiar(`apex.fit/pt/${codigo}`, "link")}
              className="apex-tipo-etiqueta border px-2 py-0.5"
              style={{ borderColor: "var(--apex-cinza-linha)", color: "var(--apex-cinza-texto)" }}
            >
              {copiado === "link" ? "Copiado" : "Copiar link"}
            </button>
          </div>
        </div>
      ) : (
        <p className="apex-tipo-secundario mt-2" style={{ color: "var(--apex-cinza-texto)" }}>
          {pendente ? "A gerar o teu código…" : "…"}
        </p>
      )}
    </div>
  );
}
