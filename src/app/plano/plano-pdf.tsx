import Link from "next/link";
import { formatarData } from "@/lib/fuso";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
} as const;

export type DocumentoPlano = {
  id: string;
  nomeFicheiro: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * O plano é o PDF — não compete com um plano estruturado (o /plano
 * principal já garante isso, escondendo VistaPlano/"Trocar de plano"
 * quando isto aparece). O mais recente em destaque; anteriores (se
 * houver) listados por baixo, mais discretos — nunca escondidos, só não
 * competem pelo destaque.
 *
 * Fase 2: mesma linguagem do cartão do PDF no painel (cartao-treino-hoje)
 * — UM botão principal ("Abrir plano") e o registo como secundário, lado a
 * lado a partir de 380px. Antes eram dois botões pretos a toda a largura a
 * competir, e o principal dizia "Abrir <nome do ficheiro>" — um nome
 * comprido sem espaços saía do botão no iPhone.
 */
export function PlanoDocumentoDestaque({ documentos }: { documentos: DocumentoPlano[] }) {
  const [recente, ...anteriores] = documentos;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Plano do teu PT
        </span>
        <h1 className="apex-tipo-titulo-ecra" style={{ color: COR.tinta }}>
          O teu plano
        </h1>
      </div>

      <section className="apex-cartao apex-cartao--destaque">
        <div className="flex flex-col gap-0.5">
          <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta, overflowWrap: "anywhere" }}>
            {recente.nomeFicheiro}
          </span>
          <span className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
            PDF · {formatarData(recente.createdAt)} · {formatarTamanho(recente.sizeBytes)}
          </span>
        </div>

        <div className="flex flex-col gap-2 min-[380px]:flex-row">
          {recente.url ? (
            <a
              href={recente.url}
              target="_blank"
              rel="noopener noreferrer"
              className="apex-botao apex-botao--claro min-[380px]:flex-1"
            >
              Abrir plano
            </a>
          ) : (
            <span className="apex-tipo-secundario" style={{ color: COR.fraco }}>
              Link indisponível de momento.
            </span>
          )}
          <Link
            href="/treino/registar"
            className="apex-tipo-secundario flex items-center justify-center border bg-white px-4 text-center min-[380px]:flex-1"
            style={{ minHeight: 48, borderColor: COR.linha, color: COR.tinta, fontWeight: 700 }}
          >
            Registar treino de hoje
          </Link>
        </div>

        <p className="apex-tipo-etiqueta" style={{ color: COR.fraco, fontWeight: 500 }}>
          Com um plano em PDF, o treino ao vivo e a progressão automática não estão disponíveis — regista os teus
          treinos manualmente.
        </p>
      </section>

      {anteriores.length > 0 ? (
        <section className="flex flex-col">
          <h2 className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Versões anteriores
          </h2>
          {anteriores.map((d) =>
            d.url ? (
              <a
                key={d.id}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="apex-tipo-secundario flex items-center justify-between gap-3 border-b py-2"
                style={{ minHeight: 44, borderColor: COR.linha, color: COR.tinta }}
              >
                <span className="min-w-0 underline underline-offset-4" style={{ overflowWrap: "anywhere" }}>
                  {d.nomeFicheiro}
                </span>
                <span className="apex-tipo-etiqueta apex-tabular shrink-0" style={{ color: COR.fraco }}>
                  {formatarData(d.createdAt)}
                </span>
              </a>
            ) : null,
          )}
        </section>
      ) : null}
    </div>
  );
}
