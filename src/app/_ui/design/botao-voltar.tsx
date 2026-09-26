"use client";

import { useRouter } from "next/navigation";

/**
 * ⚠️ TEMPORÁRIO — DEBUG DE VISIBILIDADE NO IPHONE (reverter depois do teste)
 *
 * A seta só aparece em /treino/registar; nos outros ecrãs que usam este
 * MESMO componente (treino ao vivo, check-in, /u/[id], /pt/[codigo]) o
 * Chromium confirma que o botão está no DOM e visível — mas no iPhone
 * real continua a não aparecer. Hipótese agora: a cor do texto está a
 * calhar igual (ou perto) da cor do fundo em alguns desses ecrãs — no
 * Safari, não no Chromium.
 *
 * Este fundo vermelho vivo + texto branco IGNORA de propósito a prop
 * `cor` (fica só num atributo `title`, para não desligar o aviso do
 * ESLint) — se aparecer um retângulo vermelho no iPhone, o elemento
 * EXISTE e o problema é mesmo contraste. Se não aparecer nada, o
 * problema é outro (layout/condicional específico do WebKit).
 *
 * REVERTER para o estilo normal (ver git log deste ficheiro) assim que
 * o Patrick confirmar qual dos dois casos é.
 */
export function BotaoVoltar({ cor = "var(--apex-tinta)" }: { cor?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      title={`DEBUG — cor normal seria: ${cor}`}
      className="apex-tipo-secundario self-start"
      style={{
        color: "#ffffff",
        background: "#ff0000",
        border: "3px solid #ffff00",
        padding: "10px 18px",
        cursor: "pointer",
        fontWeight: 900,
        fontSize: "16px",
        position: "relative",
        zIndex: 99999,
      }}
    >
      ← Voltar (DEBUG)
    </button>
  );
}
