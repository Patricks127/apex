import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormPerfil } from "./form-perfil";
import { FormPerfilAtleta } from "./form-perfil-atleta";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";

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
      "role, name, avatar_url, headline, bio, city, experience, specialties, certs, services, price, gym, instagram, show_contacts, pt_code, is_verified",
    )
    .eq("id", user.id)
    .single();

  // Atleta: o formulário dele (claro, só nome/foto/objetivo/bio/cidade).
  // O PT continua com o currículo completo, abaixo — nada muda para ele.
  if (p?.role === "atleta") {
    return (
      <main className="apex-ecra-claro mx-auto flex w-full max-w-lg flex-col gap-5 px-5 pt-6 pb-8">
        <BotaoVoltar />
        <h1 className="apex-tipo-titulo-ecra" style={{ color: "var(--apex-tinta)" }}>
          Editar perfil
        </h1>
        <FormPerfilAtleta
          inicial={{
            name: p.name ?? "",
            objetivo: p.headline ?? "",
            bio: p.bio ?? "",
            city: p.city ?? "",
            avatar_url: p.avatar_url ?? "",
          }}
          supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
          anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
        />
      </main>
    );
  }
  if (p?.role !== "pt") redirect("/painel");

  // Contactos do PT: tabela contactos_pt (migração 024) — o próprio lê os seus.
  const { data: contactos } = await supabase
    .from("contactos_pt")
    .select("contact_phone, contact_email")
    .eq("id", user.id)
    .maybeSingle();

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
          contact_phone: contactos?.contact_phone ?? "",
          contact_email: contactos?.contact_email ?? "",
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
