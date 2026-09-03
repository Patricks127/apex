import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ESPECIALIDADES, labelEspecialidade } from "@/lib/perfil";

export const metadata: Metadata = {
  title: "Descobrir PTs · APEX",
};

export default async function DescobrirPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").replace(/[(),*{}]/g, " ").trim().slice(0, 60);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  let req = supabase
    .from("profiles")
    .select("id, name, pt_code, avatar_url, headline, city, specialties, is_verified")
    .eq("role", "pt")
    .not("pt_code", "is", null)
    .order("is_verified", { ascending: false })
    .order("name", { ascending: true })
    .limit(40);

  if (query) {
    const espMatch = ESPECIALIDADES.filter(
      (e) =>
        e.label.toLowerCase().includes(query.toLowerCase()) ||
        e.id.includes(query.toLowerCase()),
    ).map((e) => e.id);
    const ors = [
      `name.ilike.*${query}*`,
      `city.ilike.*${query}*`,
      `headline.ilike.*${query}*`,
    ];
    if (espMatch.length) ors.push(`specialties.ov.{${espMatch.join(",")}}`);
    req = req.or(ors.join(","));
  }

  const { data: pts } = await req;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-100">Descobrir PTs</h1>
        <p className="text-sm text-zinc-400">Procura por nome, cidade ou especialidade.</p>
      </header>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="ex.: Lisboa, powerlifting, Rui…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-400"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          Procurar
        </button>
      </form>

      {!pts || pts.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-600">
          {query ? "Nenhum PT encontrado." : "Ainda não há PTs com perfil."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pt/${p.pt_code}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition hover:border-zinc-600"
              >
                <div className="size-12 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {p.name ?? "Personal Trainer"}
                    </span>
                    {p.is_verified ? (
                      <span className="shrink-0 text-[11px] text-sky-400">✓</span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-zinc-400">
                    {p.headline ?? ""}
                  </p>
                  <p className="truncate text-[11px] text-zinc-600">
                    {[
                      p.city,
                      (p.specialties as string[] | null)
                        ?.slice(0, 3)
                        .map(labelEspecialidade)
                        .join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                  {p.pt_code}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
