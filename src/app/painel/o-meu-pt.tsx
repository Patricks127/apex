import Link from "next/link";

export function OMeuPt({
  ptNome,
  ptCode,
  mensagensPorLer,
  feedbackRecente,
}: {
  ptNome: string;
  ptCode: string | null;
  mensagensPorLer: number;
  feedbackRecente: number;
}) {
  return (
    // Cartão, como os outros do painel (treino de hoje, progresso,
    // atividade) — antes flutuava sem moldura entre dois cartões.
    <section className="apex-cartao">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="apex-tipo-titulo-seccao min-w-0" style={{ marginTop: 0, color: "var(--apex-tinta)" }}>
          {ptNome}
        </h2>
        {ptCode ? (
          <span className="apex-tipo-etiqueta apex-tabular shrink-0" style={{ color: "var(--apex-cinza-texto)" }}>
            {ptCode}
          </span>
        ) : null}
      </div>

      <Link href="/chat" className="apex-linha-exercicio" style={{ textDecoration: "none" }}>
        <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>Mensagens</span>
        <span className="apex-tipo-secundario apex-tabular text-right" style={{ color: mensagensPorLer > 0 ? "var(--apex-tinta)" : "var(--apex-cinza-texto)" }}>
          {mensagensPorLer > 0 ? `${mensagensPorLer} por ler` : "Tudo lido"}
        </span>
      </Link>

      <Link href="/videos" className="apex-linha-exercicio" style={{ textDecoration: "none" }}>
        <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>Vídeos</span>
        <span className="apex-tipo-secundario apex-tabular text-right" style={{ color: feedbackRecente > 0 ? "var(--apex-tinta)" : "var(--apex-cinza-texto)" }}>
          {feedbackRecente > 0 ? `${feedbackRecente} com feedback recente` : "Sem feedback recente"}
        </span>
      </Link>

      {/* Permissões e revogar: Perfil → Definições (Fase 3). O cartão fica
          só com o que se usa no dia a dia — mensagens e vídeos. */}
      <Link
        href="/perfil/definicoes"
        className="apex-tipo-secundario apex-link-toque self-start underline underline-offset-4"
        style={{ color: "var(--apex-cinza-texto)" }}
      >
        O que o teu PT vê — Definições
      </Link>
    </section>
  );
}
