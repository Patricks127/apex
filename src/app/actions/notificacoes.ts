"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarLida(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS restringe a só o dono, e só o campo `lida` (trigger) — o filtro
  // aqui é só para um erro previsível, não a proteção em si.
  await supabase.from("notifications").update({ lida: true }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/notificacoes");
}
