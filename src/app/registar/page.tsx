import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaginaAuth } from "@/app/_ui/auth-claro";
import { FormularioRegisto } from "./formulario-registo";

export const metadata: Metadata = {
  title: "Criar conta · APEX",
};

export default async function RegistarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/painel");

  return (
    <PaginaAuth>
      <FormularioRegisto />
    </PaginaAuth>
  );
}
