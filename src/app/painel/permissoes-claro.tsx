// Variante clara de src/app/_ui/permissoes.tsx, só para o painel do atleta
// (já em modo claro). O original fica como está — é partilhado com /ligar,
// que continua em modo escuro por agora.

const OPCIONAIS = [
  { campo: "scope_evolucao", titulo: "Evolução", descricao: "Fotos e notas de progresso ao longo do tempo." },
  { campo: "scope_videos", titulo: "Vídeos", descricao: "Vídeos de execução que enviares para análise." },
  { campo: "scope_metricas", titulo: "Métricas", descricao: "Peso, medidas e outros valores que registares." },
] as const;

export function PermissoesClaro({
  evolucao = true,
  videos = true,
  metricas = true,
}: {
  evolucao?: boolean;
  videos?: boolean;
  metricas?: boolean;
}) {
  const valores: Record<string, boolean> = {
    scope_evolucao: evolucao,
    scope_videos: videos,
    scope_metricas: metricas,
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b py-3" style={{ borderColor: "var(--apex-cinza-linha)" }}>
        <div>
          <p className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>Treinos</p>
          <p className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>
            Planos e sessões que o PT te prescreve. Necessário para o acompanhamento.
          </p>
        </div>
        <span className="apex-tipo-etiqueta shrink-0" style={{ color: "var(--apex-cinza-texto)" }}>
          Sempre ativo
        </span>
      </div>

      {OPCIONAIS.map(({ campo, titulo, descricao }) => (
        <label
          key={campo}
          className="flex cursor-pointer items-start justify-between gap-3 border-b py-3"
          style={{ borderColor: "var(--apex-cinza-linha)" }}
        >
          <span>
            <span className="apex-tipo-nome-exercicio block" style={{ color: "var(--apex-tinta)" }}>{titulo}</span>
            <span className="apex-tipo-etiqueta block" style={{ color: "var(--apex-cinza-texto)" }}>{descricao}</span>
          </span>
          <input
            type="checkbox"
            name={campo}
            value="on"
            defaultChecked={valores[campo]}
            className="mt-1 size-4 shrink-0"
            style={{ accentColor: "var(--apex-tinta)" }}
          />
        </label>
      ))}

      <p className="apex-tipo-etiqueta mt-2" style={{ color: "var(--apex-cinza-texto)" }}>
        Nada disto aparece na rede social — é só entre ti e o teu PT. Podes alterar estas
        permissões ou revogar o acesso a qualquer momento.
      </p>
    </div>
  );
}
