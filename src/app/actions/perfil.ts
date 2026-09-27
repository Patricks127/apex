"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ESPECIALIDADES,
  SERVICOS,
  MAX_ESPECIALIDADES,
} from "@/lib/perfil";
import { lerDecimal } from "@/lib/formato";

const BLOQUEIO_RLS =
  "Não foi possível guardar. As políticas de segurança da base de dados podem estar a bloquear esta operação.";

const ESP_IDS = ESPECIALIDADES.map((e) => e.id);
const SRV_IDS = SERVICOS.map((s) => s.id);

export type EstadoPerfil = { erro?: string; ok?: boolean };

// ---------------------------------------------------------------------------
// Guardar o currículo público (só PT)
// ---------------------------------------------------------------------------

export async function guardarPerfil(
  _anterior: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (perfil?.role !== "pt") return { erro: "Só os personal trainers têm perfil público." };

  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const headline = s("headline");
  const bio = s("bio");
  const city = s("city");
  const experienceRaw = s("experience");
  const priceRaw = s("price").replace(",", ".");
  const contact_phone = s("contact_phone");
  const contact_email = s("contact_email");
  const instagram = s("instagram").replace(/^@/, "");
  const gym = s("gym");
  const show_contacts = s("show_contacts");
  const avatar_url = s("avatar_url");

  const specialties = formData
    .getAll("specialties")
    .map(String)
    .filter((v) => ESP_IDS.includes(v))
    .slice(0, MAX_ESPECIALIDADES);
  const services = formData
    .getAll("services")
    .map(String)
    .filter((v) => SRV_IDS.includes(v));
  // certs vem como linhas separadas por \n
  const certs = s("certs")
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 20);

  // validações
  if (headline.length > 120) return { erro: "Título demasiado longo (máx. 120)." };
  if (bio.length > 2000) return { erro: "Apresentação demasiado longa (máx. 2000)." };
  if (city.length > 80) return { erro: "Cidade demasiado longa." };
  if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
    return { erro: "Email de contacto inválido." };
  }
  if (show_contacts && !["alunos", "todos"].includes(show_contacts)) {
    return { erro: "Valor de visibilidade de contactos inválido." };
  }
  if (avatar_url && !avatar_url.includes("/storage/v1/object/public/avatars/")) {
    return { erro: "URL de foto inválido." };
  }

  let experience: string | null = null;
  if (experienceRaw) {
    const n = Number.parseInt(experienceRaw, 10);
    if (!Number.isInteger(n) || n < 0 || n > 70) {
      return { erro: "Anos de experiência inválidos (0–70)." };
    }
    experience = String(n);
  }

  let price: number | null = null;
  if (priceRaw) {
    // "40,5" gravava 40 (parseFloat corta na vírgula) — lerDecimal aceita
    // vírgula e ponto e recusa o resto
    price = lerDecimal(priceRaw);
    if (!isFinite(price) || price < 0 || price > 100000) {
      return { erro: "Preço inválido." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      headline: headline || null,
      bio: bio || null,
      city: city || null,
      experience,
      specialties,
      certs,
      services,
      price,
      contact_phone: contact_phone || null,
      contact_email: contact_email || null,
      instagram: instagram || null,
      gym: gym || null,
      show_contacts: show_contacts || "alunos",
      avatar_url: avatar_url || null,
    })
    .eq("id", user.id);

  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/perfil/editar");
  revalidatePath("/descobrir");
  return { ok: true };
}
