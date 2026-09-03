"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createClient } from "@/lib/supabase/client";
import { guardarPerfil, type EstadoPerfil } from "@/app/actions/perfil";
import {
  redimensionarImagem,
  uploadComProgresso,
  idFicheiro,
} from "@/lib/chat/media";
import {
  ESPECIALIDADES,
  MAX_ESPECIALIDADES,
  SERVICOS,
  SHOW_CONTACTS,
  completude,
} from "@/lib/perfil";

type Inicial = {
  name: string;
  avatar_url: string;
  headline: string;
  bio: string;
  city: string;
  experience: string;
  specialties: string[];
  certs: string[];
  services: string[];
  price: string;
  gym: string;
  instagram: string;
  contact_phone: string;
  contact_email: string;
  show_contacts: "alunos" | "todos";
};

export function FormPerfil({
  inicial,
  ptCode,
  verificado,
  supabaseUrl,
  anonKey,
}: {
  inicial: Inicial;
  ptCode: string | null;
  verificado: boolean;
  supabaseUrl: string;
  anonKey: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [estado, acao, pendente] = useActionState(guardarPerfil, {} as EstadoPerfil);

  const [avatarUrl, setAvatarUrl] = useState(inicial.avatar_url);
  const [avatarPct, setAvatarPct] = useState<number | null>(null);
  const [avatarErro, setAvatarErro] = useState<string | null>(null);
  const [headline, setHeadline] = useState(inicial.headline);
  const [bio, setBio] = useState(inicial.bio);
  const [city, setCity] = useState(inicial.city);
  const [experience, setExperience] = useState(inicial.experience);
  const [specialties, setSpecialties] = useState<string[]>(inicial.specialties);
  const [certs, setCerts] = useState<string[]>(inicial.certs);
  const [novaCert, setNovaCert] = useState("");
  const [services, setServices] = useState<string[]>(inicial.services);
  const [price, setPrice] = useState(inicial.price);
  const [phone, setPhone] = useState(inicial.contact_phone);
  const [email, setEmail] = useState(inicial.contact_email);
  const [instagram, setInstagram] = useState(inicial.instagram);
  const [gym, setGym] = useState(inicial.gym);
  const [showContacts, setShowContacts] = useState(inicial.show_contacts);

  const meter = completude({
    avatar_url: avatarUrl,
    headline,
    bio,
    city,
    experience,
    specialties,
    certs,
    services,
    price,
    contact_phone: phone,
    contact_email: email,
  });

  async function subirAvatar(file: File) {
    setAvatarErro(null);
    if (!file.type.startsWith("image/")) {
      setAvatarErro("Escolhe uma imagem.");
      return;
    }
    try {
      const blob = await redimensionarImagem(file, 400, 0.85);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAvatarErro("Sessão expirada.");
        return;
      }
      const path = `${session.user.id}/${idFicheiro()}.jpg`;
      setAvatarPct(0);
      await uploadComProgresso({
        supabaseUrl,
        anonKey,
        token: session.access_token,
        bucket: "avatars",
        path,
        blob,
        contentType: "image/jpeg",
        onProgress: setAvatarPct,
      });
      setAvatarPct(null);
      setAvatarUrl(`${supabaseUrl}/storage/v1/object/public/avatars/${path}`);
    } catch (e) {
      setAvatarPct(null);
      setAvatarErro(e instanceof Error ? e.message : "Falha no upload.");
    }
  }

  function toggleEsp(id: string) {
    setSpecialties((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < MAX_ESPECIALIDADES
          ? [...cur, id]
          : cur,
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">O teu perfil</h1>
          <p className="text-sm text-zinc-400">
            É o que os atletas veem em{" "}
            <span className="font-mono text-zinc-300">apex.fit/pt/{ptCode ?? "…"}</span>
          </p>
        </div>
        {verificado ? (
          <span className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
            Verificado
          </span>
        ) : null}
      </header>

      {/* Medidor de completude */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-zinc-200">Perfil {meter.pct}% completo</p>
          {ptCode ? (
            <Link
              href={`/pt/${ptCode}`}
              className="text-xs text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
            >
              Ver como público
            </Link>
          ) : null}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-all ${meter.pct === 100 ? "bg-emerald-400" : "bg-zinc-300"}`}
            style={{ width: `${meter.pct}%` }}
          />
        </div>
        {meter.falta.length > 0 ? (
          <p className="mt-2 text-xs text-zinc-500">Falta: {meter.falta.join(" · ")}</p>
        ) : (
          <p className="mt-2 text-xs text-emerald-400">Está tudo preenchido.</p>
        )}
      </div>

      {estado.erro ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Guardado.
        </p>
      ) : null}

      {/* Foto */}
      <Campo titulo="Foto">
        <div className="flex items-center gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subirAvatar(f);
              }}
              className="text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-200"
            />
            {avatarPct != null ? (
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-emerald-400" style={{ width: `${avatarPct}%` }} />
              </div>
            ) : null}
            {avatarErro ? <p className="text-xs text-red-400">{avatarErro}</p> : null}
            <p className="text-[11px] text-zinc-600">Redimensionada para 400px.</p>
          </div>
        </div>
        <input type="hidden" name="avatar_url" value={avatarUrl} />
      </Campo>

      <Campo titulo="Título profissional">
        <input
          name="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={120}
          placeholder="ex.: Treinador de força e hipertrofia"
          className={inputCls}
        />
      </Campo>

      <Campo titulo="Apresentação">
        <textarea
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Quem és, como trabalhas, com quem trabalhas melhor…"
          className={`${inputCls} resize-none`}
        />
        <span className="text-[11px] text-zinc-600">{bio.length}/2000</span>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo titulo="Cidade">
          <input name="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className={inputCls} />
        </Campo>
        <Campo titulo="Anos de experiência">
          <input
            name="experience"
            value={experience}
            onChange={(e) => setExperience(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder="ex.: 8"
            className={inputCls}
          />
        </Campo>
      </div>

      <Campo titulo={`Especialidades (${specialties.length}/${MAX_ESPECIALIDADES})`}>
        <div className="grid grid-cols-2 gap-2">
          {ESPECIALIDADES.map((e) => {
            const on = specialties.includes(e.id);
            const bloqueado = !on && specialties.length >= MAX_ESPECIALIDADES;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggleEsp(e.id)}
                disabled={bloqueado}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  on
                    ? "border-zinc-300 bg-zinc-800 text-zinc-100"
                    : bloqueado
                      ? "border-zinc-800 text-zinc-600"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {e.label}
              </button>
            );
          })}
        </div>
        {specialties.map((id) => (
          <input key={id} type="hidden" name="specialties" value={id} />
        ))}
      </Campo>

      <Campo titulo="Certificações">
        <ul className="flex flex-col gap-1.5">
          {certs.map((c, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
            >
              <span>{c}</span>
              <button
                type="button"
                onClick={() => setCerts((cur) => cur.filter((_, j) => j !== i))}
                className="text-zinc-500 hover:text-red-400"
                aria-label="Remover"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            value={novaCert}
            onChange={(e) => setNovaCert(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = novaCert.trim();
                if (v && certs.length < 20) {
                  setCerts((cur) => [...cur, v]);
                  setNovaCert("");
                }
              }
            }}
            placeholder="ex.: NSCA CSCS"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => {
              const v = novaCert.trim();
              if (v && certs.length < 20) {
                setCerts((cur) => [...cur, v]);
                setNovaCert("");
              }
            }}
            className="shrink-0 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Adicionar
          </button>
        </div>
        <input type="hidden" name="certs" value={certs.join("\n")} />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo titulo="Modo">
          <div className="flex flex-col gap-2">
            {SERVICOS.map((sv) => (
              <label
                key={sv.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 has-[:checked]:border-zinc-300"
              >
                <input
                  type="checkbox"
                  name="services"
                  value={sv.id}
                  checked={services.includes(sv.id)}
                  onChange={(e) =>
                    setServices((cur) =>
                      e.target.checked ? [...cur, sv.id] : cur.filter((x) => x !== sv.id),
                    )
                  }
                  className="size-4 accent-zinc-100"
                />
                {sv.label}
              </label>
            ))}
          </div>
        </Campo>
        <Campo titulo="Preço indicativo (€)">
          <input
            name="price"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="ex.: 40"
            className={inputCls}
          />
          <span className="text-[11px] text-zinc-600">Por sessão ou mês — o que fizer sentido.</span>
        </Campo>
      </div>

      <Campo titulo="Contactos">
        <input
          name="contact_phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefone"
          className={inputCls}
        />
        <input
          name="contact_email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          className={inputCls}
        />
        <input
          name="instagram"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="Instagram (sem @)"
          className={inputCls}
        />
        <input
          name="gym"
          value={gym}
          onChange={(e) => setGym(e.target.value)}
          placeholder="Ginásio / box onde treinas"
          className={inputCls}
        />
      </Campo>

      <Campo titulo="Quem pode ver os contactos">
        <div className="grid grid-cols-2 gap-2">
          {SHOW_CONTACTS.map((o) => (
            <label
              key={o.id}
              className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition has-[:checked]:border-zinc-300 has-[:checked]:bg-zinc-800"
            >
              <input
                type="radio"
                name="show_contacts"
                value={o.id}
                checked={showContacts === o.id}
                onChange={() => setShowContacts(o.id)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </Campo>

      <button
        type="submit"
        disabled={pendente}
        className="rounded-lg bg-zinc-100 px-4 py-3 font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-60"
      >
        {pendente ? "A guardar…" : "Guardar perfil"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-400";

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-300">{titulo}</label>
      {children}
    </div>
  );
}
