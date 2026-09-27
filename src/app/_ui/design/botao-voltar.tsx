"use client";

import { useRouter } from "next/navigation";

/**
 * "Voltar" por HISTÓRICO do browser, não um destino fixo — para ecrãs
 * alcançáveis a partir de vários sítios diferentes (perfis públicos:
 * /descobrir, /feed, a lista de posts de outro perfil...), onde um Link
 * fixo estaria errado sempre que a origem real fosse outra. O resto da
 * app usa Link com destino fixo (← Alunos, ← Painel, ← Plano) porque só
 * tem UMA origem sensata cada — aqui não há essa garantia.
 */
export function BotaoVoltar({ cor = "var(--apex-tinta)" }: { cor?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      // apex-link-toque: alvo de toque de 44px (o texto tinha 20px de altura);
      // a margem negativa devolve o espaço extra, para o layout de cada ecrã
      // que o usa ficar exatamente onde estava.
      className="apex-tipo-secundario apex-link-toque self-start underline underline-offset-4"
      style={{ color: cor, background: "none", border: "none", padding: 0, margin: "-12px 0", cursor: "pointer" }}
    >
      ← Voltar
    </button>
  );
}
