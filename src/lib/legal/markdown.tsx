import type { ReactNode } from "react";

/* ============================================================
   APEX — Renderizador mínimo de markdown para os documentos legais.

   Não é um parser de markdown genérico — cobre só o subconjunto que
   referencia/legal/*.md usa: #/##/###, **negrito**, [texto](url), listas
   "- item", tabelas "| a | b |" com separador, "---" como divisória, e
   parágrafos simples. Evita trazer uma dependência só para dois documentos
   estáticos e deixa o resultado com o estilo visual da app (zinc/dark).
   ============================================================ */

/** Texto simples → nós React, quebrando por `\n` em <br/>. Usado para o que
 *  sobra entre matches de negrito/link — essas marcas podem atravessar uma
 *  quebra de linha (o .md está word-wrapped a ~80 colunas), por isso quem
 *  chama `renderInline` já não corre linha a linha. */
function comQuebras(texto: string, chave: string): ReactNode[] {
  const linhas = texto.split("\n");
  const out: ReactNode[] = [];
  linhas.forEach((l, j) => {
    if (j > 0) out.push(<br key={`${chave}-br${j}`} />);
    if (l) out.push(l);
  });
  return out;
}

function renderInline(texto: string, chavePrefixo: string): ReactNode[] {
  const partes: ReactNode[] = [];
  // **negrito** ou [texto](url), o que vier primeiro. [\s\S] em vez de "."
  // (com a flag /s far-se-ia o mesmo, mas exige target ES2018+): o conteúdo
  // entre marcas pode atravessar uma quebra de linha dentro do mesmo bloco —
  // sem isto, "**abre\nfecha**" não fecha e os asteriscos aparecem literais.
  const re = /\*\*([\s\S]+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(...comQuebras(texto.slice(ultimo, m.index), `${chavePrefixo}-t${i}`));
    if (m[1] !== undefined) {
      partes.push(
        <strong key={`${chavePrefixo}-b${i}`} className="font-semibold text-zinc-100">
          {comQuebras(m[1], `${chavePrefixo}-bt${i}`)}
        </strong>,
      );
    } else {
      const href = m[3];
      const externo = /^https?:\/\//.test(href);
      partes.push(
        <a
          key={`${chavePrefixo}-a${i}`}
          href={href}
          target={externo ? "_blank" : undefined}
          rel={externo ? "noopener noreferrer" : undefined}
          className="text-zinc-100 underline underline-offset-2 hover:text-white"
        >
          {m[2]}
        </a>,
      );
    }
    ultimo = re.lastIndex;
    i++;
  }
  if (ultimo < texto.length) partes.push(...comQuebras(texto.slice(ultimo), `${chavePrefixo}-tail`));
  return partes;
}

function ehSeparadorTabela(linha: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(linha.trim());
}

function celulasDe(linha: string): string[] {
  return linha
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Divide o markdown em blocos. Normalmente separam-se por linha em branco,
 *  mas um título (#/##/###) ou "---" fecha sempre o bloco anterior e abre já
 *  o seu próprio bloco — MESMO sem linha em branco a separar, como acontece
 *  em várias secções destes documentos (ex.: "### 4.1 Dados de conta" colado
 *  à lista logo a seguir). Sem isto, só a linha do título sobrevivia e o
 *  resto do bloco desaparecia em silêncio — foi o que aconteceu em 4.1, 4.2,
 *  4.4, 4.5 e 6.1–6.4 antes desta correção. */
function blocos(md: string): string[] {
  const out: string[] = [];
  let atual: string[] = [];
  const fecha = () => {
    if (atual.length) out.push(atual.join("\n").trim());
    atual = [];
  };
  for (const linha of md.split("\n")) {
    const t = linha.trim();
    if (t === "") {
      fecha();
      continue;
    }
    if (/^#{1,3}\s/.test(t) || t === "---") {
      fecha();
      out.push(t);
      continue;
    }
    atual.push(linha);
  }
  fecha();
  return out.filter(Boolean);
}

export function DocumentoLegal({ markdown }: { markdown: string }) {
  const partes = blocos(markdown);

  return (
    <div className="flex flex-col gap-5">
      {partes.map((bloco, i) => {
        const linhas = bloco.split("\n");
        const primeira = linhas[0];
        const chave = `b${i}`;

        // divisória "---"
        if (bloco === "---") {
          return <hr key={chave} className="border-zinc-800" />;
        }

        // título
        if (primeira.startsWith("### ")) {
          return (
            <h3 key={chave} className="text-base font-semibold text-zinc-100">
              {renderInline(primeira.slice(4), chave)}
            </h3>
          );
        }
        if (primeira.startsWith("## ")) {
          return (
            <h2 key={chave} className="mt-2 text-lg font-semibold text-zinc-100">
              {renderInline(primeira.slice(3), chave)}
            </h2>
          );
        }
        if (primeira.startsWith("# ")) {
          const titulo = primeira.slice(2);
          // um H1 a meio do documento (ex.: aviso de saúde) é um destaque, não
          // um título de secção — a app já usa amber para avisos importantes.
          const aviso = /^[⚕️⚠️]/u.test(titulo);
          if (aviso) {
            return (
              <div key={chave} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <h2 className="text-base font-semibold text-amber-200">{renderInline(titulo, chave)}</h2>
              </div>
            );
          }
          return (
            <h1 key={chave} className="text-xl font-semibold text-zinc-100">
              {renderInline(titulo, chave)}
            </h1>
          );
        }

        // lista
        if (linhas.every((l) => l.startsWith("- "))) {
          return (
            <ul key={chave} className="flex flex-col gap-1.5 pl-5 text-sm text-zinc-300 [&>li]:list-disc">
              {linhas.map((l, j) => (
                <li key={`${chave}-${j}`}>{renderInline(l.slice(2), `${chave}-${j}`)}</li>
              ))}
            </ul>
          );
        }

        // tabela
        if (linhas.length >= 2 && linhas[0].includes("|") && ehSeparadorTabela(linhas[1])) {
          const cab = celulasDe(linhas[0]);
          const resto = linhas.slice(2).map(celulasDe);
          return (
            <div key={chave} className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {cab.map((c, j) => (
                      <th key={j} className="px-2 py-2 font-semibold text-zinc-200">
                        {renderInline(c, `${chave}-h${j}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resto.map((linha, li) => (
                    <tr key={li} className="border-b border-zinc-900">
                      {linha.map((c, j) => (
                        <td key={j} className="px-2 py-2 align-top text-zinc-400">
                          {renderInline(c, `${chave}-${li}-${j}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // parágrafo simples (pode ter várias linhas seguidas sem separador).
        // Todo o bloco passa DE UMA VEZ por renderInline — não linha a linha
        // — porque um **negrito** pode atravessar a quebra de linha do
        // word-wrap do .md; comQuebras() é quem reinsere os <br/>.
        return (
          <p key={chave} className="text-sm leading-relaxed text-zinc-300">
            {renderInline(bloco, chave)}
          </p>
        );
      })}
    </div>
  );
}
