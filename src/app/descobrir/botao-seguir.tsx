"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { seguir, deixarDeSeguir } from "@/app/actions/social";

/** Botão de seguir/deixar de seguir — reutilizado em /descobrir,
 *  /pt/[codigo] e /u/[id]. Estado otimista (muda já no clique), com
 *  router.refresh() a seguir para os contadores (seguidores) ficarem
 *  corretos assim que a acção terminar. */
export function BotaoSeguir({ followingId, aSeguir }: { followingId: string; aSeguir: boolean }) {
  const [otimista, setOtimista] = useState(aSeguir);
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  function alternar() {
    const novoEstado = !otimista;
    setOtimista(novoEstado);
    iniciarTransicao(async () => {
      const fd = new FormData();
      fd.set("following_id", followingId);
      await (novoEstado ? seguir(fd) : deixarDeSeguir(fd));
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className={otimista ? "apex-botao apex-botao--claro" : "apex-botao apex-botao--claro"}
      style={{
        width: "auto",
        padding: "8px 16px",
        background: otimista ? "transparent" : "var(--apex-tinta)",
        color: otimista ? "var(--apex-tinta)" : "var(--apex-branco)",
        border: otimista ? "1px solid var(--apex-tinta)" : "none",
      }}
    >
      {otimista ? "A seguir" : "Seguir"}
    </button>
  );
}
