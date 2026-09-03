import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormPerfil } from "./form-perfil";

export const metadata: Metadata = {
  title: "Editar perfil · APEX",
};

export default async function EditarPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: p } = await supabase
    .from("profiles")
    .select(
      "role, name, avatar_url, headline, bio, city, experience, specialties, certs, services, price, gym, instagram, contact_phone, contact_email, show_contacts, pt_code, is_verified",
    )
    .eq("id", user.id)
    .single();

  if (p?.role !== "pt") redirect("/painel");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <FormPerfil
        inicial={{
          name: p.name ?? "",
          avatar_url: p.avatar_url ?? "",
          headline: p.headline ?? "",
          bio: p.bio ?? "",
          city: p.city ?? "",
          experience: p.experience ?? "",
          specialties: (p.specialties ?? []) as string[],
          certs: (p.certs ?? []) as string[],
          services: (p.services ?? []) as string[],
          price: p.price != null ? String(p.price) : "",
          gym: p.gym ?? "",
          instagram: p.instagram ?? "",
          contact_phone: p.contact_phone ?? "",
          contact_email: p.contact_email ?? "",
          show_contacts: (p.show_contacts as "alunos" | "todos") ?? "alunos",
        }}
        ptCode={p.pt_code ?? null}
        verificado={!!p.is_verified}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      />
    </main>
  );
}
