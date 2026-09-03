import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { labelEspecialidade, labelServico } from "@/lib/perfil";

export const metadata: Metadata = {
  title: "Perfil de PT · APEX",
};

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const code = decodeURIComponent(codigo).toUpperCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: pt } = await supabase
    .from("profiles")
    .select(
      "id, name, avatar_url, headline, bio, city, experience, specialties, certs, services, price, gym, instagram, contact_phone, contact_email, show_contacts, pt_code, is_verified, role",
    )
    .eq("pt_code", code)
    .eq("role", "pt")
    .maybeSingle();

  if (!pt) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-100">PT não encontrado</h1>
        <p className="text-sm text-zinc-400">Não há nenhum personal trainer com o código {code}.</p>
        <Link href="/descobrir" className="text-sm text-zinc-300 underline underline-offset-4">
          Procurar PTs
        </Link>
      </main>
    );
  }

  const meuPerfil = pt.id === user.id;

  const { data: link } = await supabase
    .from("pt_links")
    .select("status")
    .eq("pt_id", pt.id)
    .eq("student_id", user.id)
    .in("status", ["ativo", "pendente"])
    .maybeSingle();

  const { data: meuPerfilRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const souAtleta = meuPerfilRow?.role === "atleta";
  const alunoLigado = link?.status === "ativo";
  const pedidoPendente = link?.status === "pendente";
  const mostrarContactos = meuPerfil || pt.show_contacts === "todos" || alunoLigado;

  const precoFmt =
    pt.price != null && String(pt.price).trim() !== ""
      ? `${Math.round(Number(pt.price))} €`
      : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-8">
      <header className="flex items-center gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
          {pt.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pt.avatar_url} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold text-zinc-100">
              {pt.name ?? "Personal Trainer"}
            </h1>
            {pt.is_verified ? (
              <span className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                Verificado
              </span>
            ) : null}
          </div>
          {pt.headline ? <p className="text-sm text-zinc-300">{pt.headline}</p> : null}
          <p className="mt-0.5 text-xs text-zinc-500">
            {[pt.city, pt.experience ? `${pt.experience} anos de experiência` : null]
              .filter(Boolean)
              .join(" · ") || " "}
          </p>
        </div>
      </header>

      {meuPerfil ? (
        <Link
          href="/perfil/editar"
          className="self-start rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
        >
          Editar o meu perfil
        </Link>
      ) : souAtleta && !alunoLigado && !pedidoPendente ? (
        <Link
          href={`/ligar?pt=${pt.pt_code}`}
          className="self-start rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          Enviar pedido de ligação
        </Link>
      ) : pedidoPendente ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Já enviaste um pedido de ligação a este PT.
        </p>
      ) : alunoLigado ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          Estás ligado a este PT.
        </p>
      ) : null}

      {pt.bio ? (
        <Seccao titulo="Apresentação">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{pt.bio}</p>
        </Seccao>
      ) : null}

      {pt.specialties && pt.specialties.length > 0 ? (
        <Seccao titulo="Especialidades">
          <div className="flex flex-wrap gap-2">
            {(pt.specialties as string[]).map((s) => (
              <span
                key={s}
                className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
              >
                {labelEspecialidade(s)}
              </span>
            ))}
          </div>
        </Seccao>
      ) : null}

      {pt.certs && pt.certs.length > 0 ? (
        <Seccao titulo="Certificações">
          <ul className="flex flex-col gap-1 text-sm text-zinc-300">
            {(pt.certs as string[]).map((c, i) => (
              <li key={i}>• {c}</li>
            ))}
          </ul>
        </Seccao>
      ) : null}

      {(pt.services && pt.services.length > 0) || precoFmt ? (
        <Seccao titulo="Como trabalha">
          <p className="text-sm text-zinc-300">
            {(pt.services as string[]).map(labelServico).join(" · ") || "—"}
            {precoFmt ? ` · desde ${precoFmt}` : ""}
          </p>
          {pt.gym ? <p className="mt-1 text-xs text-zinc-500">Treina em {pt.gym}</p> : null}
        </Seccao>
      ) : null}

      <Seccao titulo="Contactos">
        {mostrarContactos ? (
          <ul className="flex flex-col gap-1 text-sm text-zinc-300">
            {pt.contact_phone ? <li>Telefone: {pt.contact_phone}</li> : null}
            {pt.contact_email ? <li>Email: {pt.contact_email}</li> : null}
            {pt.instagram ? (
              <li>
                Instagram:{" "}
                <a
                  href={`https://instagram.com/${pt.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  @{pt.instagram}
                </a>
              </li>
            ) : null}
            {!pt.contact_phone && !pt.contact_email && !pt.instagram ? (
              <li className="text-zinc-600">Sem contactos preenchidos.</li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            🔒 Este PT só mostra os contactos aos seus alunos. Envia um pedido de ligação.
          </p>
        )}
      </Seccao>
    </main>
  );
}

function Seccao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{titulo}</h2>
      {children}
    </section>
  );
}
