import Link from "next/link";
import type { SessaoHistorico } from "@/lib/treino/progresso-dados";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
} as const;

const MAX_SESSOES = 3;

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });

/**
 * Atividade recente — últimos treinos registados e feedback do PT, de
 * dados reais (`sessoes` já vem ordenada da mais recente, ver
 * carregarProgresso). Sem atividade nenhuma: um estado vazio claro, nunca
 * um espaço em branco.
 */
export function CartaoAtividade({
  sessoes,
  feedbackRecente,
}: {
  sessoes: SessaoHistorico[];
  feedbackRecente: number;
}) {
  const recentes = sessoes.slice(0, MAX_SESSOES);
  const semNada = recentes.length === 0 && feedbackRecente === 0;

  return (
    <section className="apex-cartao">
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
        Atividade recente
      </h2>

      {semNada ? (
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Ainda sem atividade registada. Regista o teu primeiro treino para começares a ver o histórico aqui.
        </p>
      ) : (
        <div className="flex flex-col">
          {feedbackRecente > 0 ? (
            <Link
              href="/videos"
              className="flex items-center justify-between gap-3 border-b py-2.5"
              style={{ minHeight: 44, borderColor: COR.linha }}
            >
              <span className="apex-tipo-secundario" style={{ color: COR.tinta }}>
                {feedbackRecente} comentário{feedbackRecente > 1 ? "s" : ""} novo{feedbackRecente > 1 ? "s" : ""} do teu
                PT
              </span>
              <span className="apex-tipo-etiqueta underline underline-offset-4" style={{ color: COR.tinta }}>
                Ver
              </span>
            </Link>
          ) : null}

          {recentes.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 py-2.5"
              style={i < recentes.length - 1 ? { borderBottom: `1px solid ${COR.linha}` } : undefined}
            >
              <div className="min-w-0">
                <p className="apex-tipo-secundario truncate" style={{ color: COR.tinta }}>
                  {s.title}
                </p>
                <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
                  {dataCurta(s.performedAt)}
                </p>
              </div>
              <span className="apex-tipo-etiqueta apex-tabular shrink-0" style={{ color: COR.fraco }}>
                {s.nSets} séries
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
