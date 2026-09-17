"use client";

import { useEffect, useRef } from "react";
import { marcarTodasComoLidas } from "@/app/actions/notificacoes";

/**
 * Dispara marcarTodasComoLidas() uma vez ao montar — não usa <form
 * action>, para não refrescar a rota a meio da visita (o utilizador
 * continua a ver o fundo azul das que eram não lidas até sair e voltar).
 */
export function MarcarVisiveisLidas() {
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    marcarTodasComoLidas();
  }, []);

  return null;
}
