import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoNotificacao =
  | "plano_atribuido"
  | "mensagem"
  | "comentario"
  | "gosto"
  | "recorde"
  | "treino_concluido";

/**
 * Cria uma notificação. NUNCA uma Server Action exportada — um helper
 * simples, chamado de dentro de outras ações (atribuirPlanoPt,
 * enviarMensagem, comentar, alternarGosto, registarRecorde,
 * gravarTreino) depois de a ação principal já ter tido sucesso. O
 * cliente não tem forma nenhuma de chamar isto isoladamente.
 *
 * Best-effort: nunca lança. A ação principal já teve sucesso quando
 * isto é chamado — uma falha aqui (ex.: RLS a rejeitar um caso que a
 * regra de confiança não cobre) não pode desfazer nem bloquear isso.
 *
 * NUNCA pede `Prefer: return=representation` (insert "cego", via
 * .insert() sem .select()) — quando o destinatário é outra pessoa
 * (todos os tipos exceto 'recorde'/'treino_concluido'), quem insere não
 * tem SELECT sobre a linha (a RLS de notifications só deixa o dono ler).
 * Pedir a linha de volta faz o Postgres recusar o insert com "new row
 * violates row-level security policy" mesmo sendo um insert legítimo —
 * apanhado ao escrever scripts/social-notif-test.ts.
 */
export async function notificar(
  supabase: SupabaseClient,
  input: {
    userId: string;
    tipo: TipoNotificacao;
    titulo: string;
    corpo?: string | null;
    refId?: string | null;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: input.userId,
      tipo: input.tipo,
      titulo: input.titulo,
      corpo: input.corpo ?? null,
      ref_id: input.refId ?? null,
    });
    if (error) console.error(`notificar (${input.tipo}): falha ao gravar (best-effort)`, error);
  } catch (e) {
    console.error(`notificar (${input.tipo}): exceção (best-effort)`, e);
  }
}
