"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscrever(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function lerAgora(): boolean {
  return window.matchMedia(QUERY).matches;
}

function lerNoServidor(): boolean {
  return false; // SSR não sabe a preferência do browser — assume movimento normal
}

/** Só é preciso onde JS decide RENDERIZAR ou não algo animado (o anel de
 *  descanso — "sem anel animado, só o número"). Transições simples (o
 *  painel de RPE a subir) já ficam a 0ms via --apex-mov-duracao, resolvido
 *  em CSS puro, sem precisar disto. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscrever, lerAgora, lerNoServidor);
}
