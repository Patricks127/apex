import type { ReactNode } from "react";

// Moldura centrada e escura para os ecrãs de autenticação.
export function CartaoAuth({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-bold tracking-widest text-zinc-100">
          APEX
        </p>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl shadow-black/40">
          {children}
        </div>
      </div>
    </main>
  );
}
