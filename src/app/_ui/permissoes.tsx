// Painel de permissões partilhado por /ligar e pelo painel do atleta.
// treinos é obrigatório e não desativável; os restantes são escolha do atleta.

const OPCIONAIS = [
  {
    campo: "scope_evolucao",
    titulo: "Evolução",
    descricao: "Fotos e notas de progresso ao longo do tempo.",
  },
  {
    campo: "scope_videos",
    titulo: "Vídeos",
    descricao: "Vídeos de execução que enviares para análise.",
  },
  {
    campo: "scope_metricas",
    titulo: "Métricas",
    descricao: "Peso, medidas e outros valores que registares.",
  },
] as const;

export function PainelPermissoes({
  evolucao = true,
  videos = true,
  metricas = true,
  somenteLeitura = false,
}: {
  evolucao?: boolean;
  videos?: boolean;
  metricas?: boolean;
  somenteLeitura?: boolean;
}) {
  const valores: Record<string, boolean> = {
    scope_evolucao: evolucao,
    scope_videos: videos,
    scope_metricas: metricas,
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 opacity-90">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Treinos</p>
          <p className="text-xs text-zinc-500">
            Planos e sessões que o PT te prescreve. Necessário para o acompanhamento.
          </p>
        </div>
        <span className="mt-0.5 shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
          Sempre ativo
        </span>
      </div>

      {OPCIONAIS.map(({ campo, titulo, descricao }) => (
        <label
          key={campo}
          className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 transition has-[:checked]:border-zinc-600 has-[:disabled]:cursor-default"
        >
          <span>
            <span className="block text-sm font-semibold text-zinc-100">{titulo}</span>
            <span className="block text-xs text-zinc-500">{descricao}</span>
          </span>
          <input
            type="checkbox"
            name={campo}
            value="on"
            defaultChecked={valores[campo]}
            disabled={somenteLeitura}
            className="mt-1 size-4 shrink-0 accent-zinc-100"
          />
        </label>
      ))}

      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Nada disto aparece na rede social — é só entre ti e o teu PT. Podes alterar estas
        permissões ou revogar o acesso a qualquer momento.
      </p>
    </div>
  );
}
