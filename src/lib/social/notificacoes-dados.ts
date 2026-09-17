import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoNotificacao } from "./notificar.ts";

export type Notificacao = {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string | null;
  refId: string | null;
  lida: boolean;
  createdAt: string;
};

export async function carregarNotificacoes(supabase: SupabaseClient, userId: string): Promise<Notificacao[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, tipo, titulo, corpo, ref_id, lida, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((n) => ({
    id: n.id as string,
    tipo: n.tipo as TipoNotificacao,
    titulo: n.titulo as string,
    corpo: n.corpo as string | null,
    refId: n.ref_id as string | null,
    lida: Boolean(n.lida),
    createdAt: n.created_at as string,
  }));
}

export async function contarNaoLidas(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("lida", false);
  return count ?? 0;
}
