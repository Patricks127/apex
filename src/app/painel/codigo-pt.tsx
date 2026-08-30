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
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-sm font-medium text-zinc-400">O teu código de PT</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Partilha-o com os teus atletas para eles te enviarem um pedido de ligação.
      </p>

      {erro ? (
        <p className="mt-3 text-sm text-red-400">{erro}</p>
      ) : codigo ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-semibold tracking-wider text-zinc-100">
              {codigo}
            </span>
            <button
              type="button"
              onClick={() => copiar(codigo, "codigo")}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              {copiado === "codigo" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="font-mono">apex.fit/pt/{codigo}</span>
            <button
              type="button"
              onClick={() => copiar(`apex.fit/pt/${codigo}`, "link")}
              className="rounded-md border border-zinc-800 px-2 py-0.5 font-medium text-zinc-400 transition hover:bg-zinc-800"
            >
              {copiado === "link" ? "Copiado" : "Copiar link"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          {pendente ? "A gerar o teu código…" : "…"}
        </p>
      )}
    </section>
  );
}
