type ItemListaSerie = { done: boolean };
type ItemListaExercicio = { nome: string; muscle: string | null; sets: ItemListaSerie[] };

/** Acesso à lista completa a um gesto — não está no caminho principal (uma
 *  série de cada vez), mas fica sempre a um toque. Também é a saída de
 *  emergência: "Terminar treino agora" sem ter de acabar todas as séries. */
export function ListaTreino({
  exs,
  cursorAtual,
  onFechar,
  onIrPara,
  onTerminarAgora,
}: {
  exs: ItemListaExercicio[];
  cursorAtual: { ex: number; set: number } | null;
  onFechar: () => void;
  onIrPara: (ex: number, set: number) => void;
  onTerminarAgora: () => void;
}) {
  return (
    <div className="apex-treino-lista">
      <div className="apex-treino-cabecalho" style={{ padding: 0, marginBottom: "var(--apex-space-5)" }}>
        <span className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: "var(--apex-texto-treino)" }}>
          Treino completo
        </span>
        <button type="button" className="apex-treino-botao-lista" onClick={onFechar} aria-label="Fechar lista">
          ✕
        </button>
      </div>

      <div className="flex flex-col">
        {exs.map((e, ei) => (
          <div
            key={ei}
            className="apex-treino-lista-item"
            style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--apex-space-2)" }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-texto-treino)" }}>
                {ei + 1}. {e.nome}
              </span>
              <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-texto-fraco)" }}>
                {e.muscle ?? ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {e.sets.map((s, si) => {
                const atual = cursorAtual?.ex === ei && cursorAtual?.set === si;
                return (
                  <button
                    key={si}
                    type="button"
                    onClick={() => onIrPara(ei, si)}
                    className="apex-tipo-secundario apex-tabular"
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      borderRadius: 10,
                      border: `1px solid ${atual ? "var(--apex-texto-treino)" : "var(--apex-linha-treino)"}`,
                      background: s.done ? "var(--apex-verde)" : "transparent",
                      color: s.done ? "var(--apex-fundo-treino)" : "var(--apex-texto-fraco)",
                    }}
                  >
                    {si + 1}ª
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onTerminarAgora}
        className="apex-tipo-secundario mt-6 w-full border py-3"
        style={{ borderColor: "var(--apex-linha-treino)", color: "var(--apex-texto-fraco)" }}
      >
        Terminar treino agora
      </button>
    </div>
  );
}
