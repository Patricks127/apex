/**
 * Pilha lógica de ecrãs visitados dentro da app instalada (Android,
 * standalone) — decide o que o botão de SISTEMA do Android deve fazer.
 *
 * Problema real: em modo standalone (app instalada, sem barra do browser),
 * o histórico nativo nem sempre chega para o botão de recuar do Android
 * andar para trás DENTRO da app — em vez disso, fecha a app inteira. Os
 * links "← Voltar" já existentes dentro da app (router.back()/Link) não têm
 * este problema, porque disparam sempre a partir de navegação já feita
 * nesta sessão. O botão do SISTEMA é o caso à parte.
 *
 * Esta pilha é mantida à parte do histórico nativo do browser, em
 * sessionStorage (ver gestor-historico-android.tsx) — puramente funcional
 * aqui, sem tocar em window/history, para as regras (sem ciclos, raiz sai
 * da app) poderem ser testadas sem precisar de um browser a sério.
 */

export const RAIZES = ["/painel", "/entrar"] as const;

// Amortece só um caso patológico (ex.: algum ecrã a redirecionar para si
// próprio em ciclo) — bem acima de qualquer navegação humana real.
const PROFUNDIDADE_MAXIMA = 50;

/**
 * Aplica a chegada a `path` à pilha atual.
 *
 * Empilha sempre (nunca "poupa" um nível por já termos visitado este ecrã
 * antes) — de propósito: o histórico NATIVO do browser também não faz
 * deduplicação nenhuma (A→B→A→B por LINK cria sempre 4 entradas nativas
 * distintas, nunca 2), e o botão de sistema só pode corrigir a app UM nível
 * de cada vez por cada popstate. Se a nossa pilha "poupasse" níveis que o
 * histórico nativo não poupa, um único popstate teria de saltar vários
 * níveis nativos de uma vez só — e foi exatamente isso, testado ao vivo,
 * que causava a app "ressuscitar" um ecrã antigo (router.replace perdia a
 * corrida contra a reconciliação de rota que o próprio Next também faz a
 * reagir ao mesmo popstate). Sem "poupar" nada, pilha própria e histórico
 * nativo andam sempre a par, e cada recuo só precisa de corrigir um nível.
 */
export function avancar(
  pilhaAtual: readonly string[],
  path: string,
  raizes: readonly string[] = RAIZES
): string[] {
  // mesma rota que já estávamos (ex.: refresh, ou re-render sem navegação
  // real) — nada muda.
  if (pilhaAtual[pilhaAtual.length - 1] === path) return [...pilhaAtual];

  // uma raiz (painel/entrar) reinicia a pilha — é "casa", o resto do
  // histórico anterior deixa de fazer sentido como "recuar" a partir daqui.
  if (raizes.includes(path)) return [path];

  const pilha = [...pilhaAtual, path];
  // nunca cresce sem limite de verdade — corta as camadas mais antigas,
  // mantendo sempre a raiz no fundo (índice 0) e os níveis mais recentes.
  if (pilha.length > PROFUNDIDADE_MAXIMA) {
    return [pilha[0], ...pilha.slice(pilha.length - PROFUNDIDADE_MAXIMA + 1)];
  }
  return pilha;
}

/**
 * Decide o que fazer quando o botão de sistema do Android dispara um
 * "recuar" (popstate). `null` quando já estamos numa raiz (pilha com 1 só
 * nível, ou vazia) — nesse caso o chamador não deve mexer em mais nada,
 * deixa o Android tratar do "recuar" à maneira dele (sair da app).
 */
export function recuar(
  pilhaAtual: readonly string[]
): { pilha: string[]; anterior: string } | null {
  if (pilhaAtual.length <= 1) return null;
  const pilha = pilhaAtual.slice(0, -1);
  const anterior = pilha[pilha.length - 1];
  return { pilha, anterior };
}
