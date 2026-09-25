import Link from "next/link";

export function Rodape() {
  return (
    <footer
      className="mx-auto mt-auto flex w-full max-w-lg flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-6 text-xs text-zinc-600"
      // Último elemento visível de qualquer ecrã — no iPhone instalado como
      // PWA (standalone, sem chrome do Safari), a barra de gestos fica por
      // cima do conteúdo sem isto. Aditivo ao py-6 já existente, nunca o
      // substitui (max() faria o rodapé encolher em ecrãs sem safe area).
      style={{ paddingBottom: "calc(var(--apex-space-6) + env(safe-area-inset-bottom, 0px))" }}
    >
      <Link href="/termos" className="hover:text-zinc-400">
        Termos de Utilização
      </Link>
      <Link href="/privacidade" className="hover:text-zinc-400">
        Política de Privacidade
      </Link>
      <span>© APEX</span>
    </footer>
  );
}
