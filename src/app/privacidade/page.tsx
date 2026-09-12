import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DocumentoLegal } from "@/lib/legal/markdown";

export const metadata: Metadata = {
  title: "Política de Privacidade · APEX",
  description: "Que dados a APEX recolhe, para quê, e os teus direitos.",
};

// Página pública — sem verificação de sessão, de propósito.
export default function PrivacidadePage() {
  const markdown = readFileSync(
    path.join(process.cwd(), "referencia/legal/politica-privacidade.md"),
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
