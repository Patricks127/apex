"use client";

import { PERIODOS, type PeriodoId } from "@/lib/treino/periodos";

/** Seletor de período dos gráficos de evolução — UM por página, aplicado a
 *  todos os gráficos e às frases. Rótulos curtos ("7 d", "3 m") para os 5
 *  caberem em divisões iguais num iPhone SE sem deslizar; o nome completo
 *  vai no aria-label. */
export function SeletorPeriodo({ valor, aoMudar }: { valor: PeriodoId; aoMudar: (p: PeriodoId) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>
        Período dos gráficos
      </span>
      <div className="apex-abas" role="radiogroup" aria-label="Período dos gráficos">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === valor}
            aria-label={`Últimos ${p.nome}`}
            className="apex-aba apex-tabular"
            data-ativa={p.id === valor}
            onClick={() => aoMudar(p.id)}
            // sem quebra ("1 ano" partia em duas linhas num SE de 320px)
            style={{ minHeight: 44, paddingInline: 4, whiteSpace: "nowrap" }}
          >
            {p.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "Sem registos de supino nos últimos 7 dias." — quando há histórico, mas
 *  nenhum ponto no período escolhido (nunca um gráfico vazio). */
export function SemDadosNoPeriodo({ oque, nomePeriodo }: { oque: string; nomePeriodo: string }) {
  return (
    <div className="apex-grafico__vazio apex-tipo-secundario px-4 text-center">
      Sem registos {oque} nos últimos {nomePeriodo}. Escolhe um período mais longo.
    </div>
  );
}
