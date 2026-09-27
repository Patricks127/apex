import Link from "next/link";
import { GraficoMetrica } from "../../_ui/treino/graficos-progresso";
import { METRICAS } from "@/lib/treino/metricas";
import type { MetricaCorporal } from "@/lib/treino/progresso-dados";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
} as const;

const DEF_PESO = METRICAS.weight_kg;

/**
 * Resumo de progresso no dashboard — peso, mini-gráfico se houver dados.
 * A vista completa (todas as métricas, com abas, formulário de registo)
 * continua em /progresso; aqui é só o resumo que dá para ver de relance.
 * Nunca um gráfico vazio nem um erro — um estado vazio claro.
 */
export function CartaoProgresso({ metricas }: { metricas: MetricaCorporal[] }) {
  const pontosPeso = metricas
    .filter((m) => m.metric === "weight_kg")
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const ultimo = pontosPeso.at(-1);

  return (
    <section className="apex-cartao">
      <div className="flex items-center justify-between gap-3">
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Progresso
        </h2>
        <Link href="/progresso" className="apex-tipo-secundario apex-link-toque shrink-0 underline underline-offset-4" style={{ color: COR.tinta }}>
          Ver tudo
        </Link>
      </div>

      {pontosPeso.length === 0 ? (
        <div className="apex-grafico__vazio apex-grafico__vazio--compacto apex-tipo-secundario">
          Sem dados ainda — regista o teu peso em Progresso.
        </div>
      ) : (
        <>
          <GraficoMetrica pontos={pontosPeso} />
          {ultimo ? (
            <p className="apex-tipo-corpo apex-tabular" style={{ color: COR.tinta }}>
              Atual: {ultimo.value} {DEF_PESO.unidade}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
