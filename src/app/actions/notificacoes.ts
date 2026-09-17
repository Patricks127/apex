"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Marca como lidas todas as notificações não lidas do próprio utilizador.
 * Chamado uma vez ao abrir /notificacoes (ver MarcarVisiveisLidas) —
 * plain function call num useEffect, NUNCA via <form action>, para não
 * disparar um refresh da rota a meio da visita (o ecrã já carregado
 * continua a mostrar o fundo azul de "não lida" nesta visita; só a
 * PRÓXIMA navegação, e o contador do sino, refletem o "lida").
 */
export async function marcarTodasComoLidas(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("notifications").update({ lida: true }).eq("user_id", user.id).eq("lida", false);
}
