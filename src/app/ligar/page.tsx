import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CartaoAuth } from "@/app/_ui/cartao-auth";
import { FluxoLigar } from "./fluxo-ligar";

export const metadata: Metadata = {
  title: "Ligar a um PT · APEX",
};

export default async function LigarPage({
  searchParams,
}: {
  searchParams: Promise<{ pt?: string }>;
}) {
  const { pt } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // O role vem SEMPRE da base de dados, nunca do cliente.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (perfil?.role !== "atleta") redirect("/painel");

  // Já tem PT ativo ou pedido pendente? Então não faz sentido estar aqui.
  const { data: ligacoes } = await supabase
    .from("pt_links")
    .select("status")
    .eq("student_id", user.id)
    .in("status", ["ativo", "pendente"]);

  if (ligacoes && ligacoes.length > 0) {
    return (
      <CartaoAuth>
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-zinc-100">Já tens uma ligação</h1>
          <p className="text-sm text-zinc-400">
            {ligacoes.some((l) => l.status === "ativo")
              ? "Já tens um PT ligado."
              : "Já enviaste um pedido que está à espera de resposta."}{" "}
            Gere isto no teu painel.
          </p>
          <Link
            href="/painel"
            className="mt-2 text-sm font-medium text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
          >
            Ir para o painel
          </Link>
        </div>
      </CartaoAuth>
    );
  }

  return (
    <CartaoAuth>
      <FluxoLigar codigoInicial={pt ?? null} />
    </CartaoAuth>
  );
}
