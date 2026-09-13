"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MOTIVO_LABEL, type MotivoAtencao } from "@/lib/treino/atencao";

export type AlunoLinha = {
  id: string;
  nome: string;
  motivos: MotivoAtencao[];
  scopes: { evolucao: boolean; videos: boolean; metricas: boolean };
};

const FILTROS: { id: MotivoAtencao | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "dor_recorrente", label: MOTIVO_LABEL.dor_recorrente },
  { id: "adesao_baixa", label: MOTIVO_LABEL.adesao_baixa },
  { id: "esforco_alto", label: MOTIVO_LABEL.esforco_alto },
  { id: "inativo", label: MOTIVO_LABEL.inativo },
];

// A ordem (por urgência) já vem decidida pelo servidor — este componente só
// filtra/pesquisa, nunca reordena.
export function ListaAlunosView({ alunos }: { alunos: AlunoLinha[] }) {
  const [filtro, setFiltro] = useState<MotivoAtencao | "todos">("todos");
  const [q, setQ] = useState("");

  const visiveis = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return alunos.filter((a) => {
      if (filtro !== "todos" && !a.motivos.includes(filtro)) return false;
      if (termo && !a.nome.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [alunos, filtro, q]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/painel" className="apex-tipo-secundario underline underline-offset-4" style={{ color: "var(--apex-cinza-texto)" }}>
          ← Painel
        </Link>
        <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: "var(--apex-tinta)" }}>
          Alunos
        </h1>
        <p className="apex-tipo-secundario apex-tabular" style={{ color: "var(--apex-cinza-texto)" }}>
          {alunos.length} ligado{alunos.length !== 1 ? "s" : ""}
        </p>
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        placeholder="Pesquisar por nome"
        className="apex-tipo-corpo border px-3 py-2 outline-none"
        style={{ borderColor: "var(--apex-cinza-linha)", borderRadius: 2, background: "transparent", color: "var(--apex-tinta)" }}
      />

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className="apex-tipo-etiqueta border px-2.5 py-1"
            style={{
              borderColor: filtro === f.id ? "var(--apex-tinta)" : "var(--apex-cinza-linha)",
              color: filtro === f.id ? "var(--apex-tinta)" : "var(--apex-cinza-texto)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="apex-tipo-corpo" style={{ color: "var(--apex-cinza-texto)" }}>
          {alunos.length === 0 ? "Ainda não tens alunos ligados." : "Nenhum aluno corresponde a isto."}
        </p>
      ) : (
        <div className="flex flex-col">
          {visiveis.map((a) => (
            <Link
              key={a.id}
              href={`/pt/aluno/${a.id}`}
              className="apex-linha-exercicio"
              style={{ textDecoration: "none" }}
            >
              <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>
                {a.nome}
              </span>
              <span className="flex gap-1.5">
                {a.motivos.map((m) => (
                  <span key={m} className="apex-chip-alerta apex-tipo-etiqueta">
                    {MOTIVO_LABEL[m]}
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
