import Link from "next/link";

export function Rodape() {
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-lg flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-6 text-xs text-zinc-600">
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
