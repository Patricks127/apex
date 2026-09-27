import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaginaAuth } from "@/app/_ui/auth-claro";
import { FormularioEntrada } from "./formulario-entrada";

export const metadata: Metadata = {
  title: "Iniciar sessão · APEX",
};

export default async function EntrarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/painel");

  return (
    <PaginaAuth>
      <FormularioEntrada />
    </PaginaAuth>
  );
}
