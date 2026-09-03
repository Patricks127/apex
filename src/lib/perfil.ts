// Listas e helpers do perfil público do PT.

export const ESPECIALIDADES: { id: string; label: string }[] = [
  { id: "forca", label: "Força" },
  { id: "hipertrofia", label: "Hipertrofia" },
  { id: "powerlifting", label: "Powerlifting" },
  { id: "emagrecimento", label: "Emagrecimento" },
  { id: "mobilidade", label: "Mobilidade" },
  { id: "corrida", label: "Corrida / endurance" },
  { id: "hyrox", label: "Hyrox / híbrido" },
  { id: "calistenia", label: "Calistenia" },
  { id: "reabilitacao", label: "Reabilitação / pós-lesão" },
  { id: "condicao-fisica", label: "Condição física geral" },
  { id: "preparacao-competicao", label: "Preparação para competição" },
  { id: "nutricao", label: "Acompanhamento nutricional" },
];
export const MAX_ESPECIALIDADES = 5;

export const SERVICOS: { id: string; label: string }[] = [
  { id: "presencial", label: "Presencial" },
  { id: "online", label: "Online" },
];

export const SHOW_CONTACTS: { id: "alunos" | "todos"; label: string }[] = [
  { id: "alunos", label: "Só os meus alunos" },
  { id: "todos", label: "Qualquer pessoa" },
];

export const labelEspecialidade = (id: string) =>
  ESPECIALIDADES.find((e) => e.id === id)?.label ?? id;
export const labelServico = (id: string) =>
  SERVICOS.find((s) => s.id === id)?.label ?? id;

export type PerfilPublico = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  experience: string | null;
  specialties: string[];
  certs: string[];
  services: string[];
  price: string | number | null;
  gym: string | null;
  instagram: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  show_contacts: "alunos" | "todos";
  pt_code: string | null;
  is_verified: boolean;
};

/**
 * Medidor de completude (0–100) + o que falta.
 * Recebe o perfil (ou o estado do formulário).
 */
export function completude(p: {
  avatar_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  city?: string | null;
  experience?: string | null;
  specialties?: string[];
  certs?: string[];
  services?: string[];
  price?: string | number | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}): { pct: number; falta: string[] } {
  const temTexto = (s?: string | null, min = 1) => !!s && s.trim().length >= min;
  const itens: { ok: boolean; label: string }[] = [
    { ok: temTexto(p.avatar_url), label: "Foto de perfil" },
    { ok: temTexto(p.headline, 3), label: "Título profissional" },
    { ok: temTexto(p.bio, 40), label: "Apresentação (≥ 40 caracteres)" },
    { ok: temTexto(p.city), label: "Cidade" },
    { ok: temTexto(p.experience), label: "Anos de experiência" },
    { ok: (p.specialties?.length ?? 0) >= 1, label: "Pelo menos 1 especialidade" },
    { ok: (p.certs?.length ?? 0) >= 1, label: "Pelo menos 1 certificação" },
    { ok: (p.services?.length ?? 0) >= 1, label: "Presencial e/ou online" },
    { ok: p.price != null && String(p.price).trim() !== "", label: "Preço indicativo" },
    {
      ok: temTexto(p.contact_phone) || temTexto(p.contact_email),
      label: "Um contacto (telefone ou email)",
    },
  ];
  const feitos = itens.filter((i) => i.ok).length;
  return {
    pct: Math.round((feitos / itens.length) * 100),
    falta: itens.filter((i) => !i.ok).map((i) => i.label),
  };
}
