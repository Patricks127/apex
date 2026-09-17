import Link from "next/link";

/**
 * Sino de notificações — contador vem de dados reais (count de lida=false
 * do próprio utilizador, calculado pela página que o usa). Sem realtime:
 * atualiza ao navegar (ver notas em actions/notificacoes.ts e no pedido
 * do utilizador — não vale a pena construir realtime novo só para isto).
 */
export function Sino({ naoLidas }: { naoLidas: number }) {
  return (
    <Link
      href="/notificacoes"
      className="apex-sino"
      aria-label={naoLidas > 0 ? `${naoLidas} notificações por ler` : "Notificações"}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {naoLidas > 0 ? (
        <span className="apex-sino__contador apex-tabular">{naoLidas > 99 ? "99+" : naoLidas}</span>
      ) : null}
    </Link>
  );
}
