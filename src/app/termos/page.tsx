import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DocumentoLegal } from "@/lib/legal/markdown";

export const metadata: Metadata = {
  title: "Termos de Utilização · APEX",
  description: "As regras de uso da APEX, incluindo o aviso de saúde e o que fazemos e não fazemos.",
};

// Página pública — sem verificação de sessão, de propósito.
export default function TermosPage() {
  const markdown = readFileSync(
    path.join(process.cwd(), "referencia/legal/termos-utilizacao.md"),
    "utf8",
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="self-start text-xs font-medium text-zinc-500 underline underline-offset-4 hover:text-zinc-300">
        ← APEX
      </Link>
      <DocumentoLegal markdown={markdown} />
    </main>
  );
}
