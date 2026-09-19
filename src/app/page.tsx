import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// A raiz não tem conteúdo próprio — é só um ponto de entrada que encaminha
// para onde o utilizador deve estar: painel com sessão, login sem ela.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/painel" : "/entrar");
}
