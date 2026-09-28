import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { sair } from "@/app/actions/auth";
import { revogarAcesso } from "@/app/actions/ligacoes";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { PermissoesPt } from "./permissoes-pt";

export const metadata: Metadata = {
  title: "Definições · APEX",
};

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
} as const;

/**
 * Perfil → Definições (Fase 3, pontos 19/21): tudo o que é "da conta" num
 * sítio só — editar perfil, o PT e o que ele pode ver (antes solto no
 * cartão do PT no painel), terminar sessão (antes só no menu do avatar),
 * termos e privacidade. Mesmas ações e mesma RLS de antes — só mudou de
 * sítio.
 */
export default async function DefinicoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase.from("profiles").select("role, pt_code").eq("id", user.id).single();
  const ehAtleta = perfil?.role === "atleta";

  const { data: ligacao } = ehAtleta
    ? await supabase
        .from("pt_links")
        .select("id, status, scope_evolucao, scope_videos, scope_metricas, pt:profiles!pt_id(name)")
        .eq("student_id", user.id)
        .in("status", ["ativo", "pendente"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .overrideTypes<{
          id: string;
          status: string;
          scope_evolucao: boolean;
          scope_videos: boolean;
          scope_metricas: boolean;
          pt: { name: string | null } | null;
        }>()
    : { data: null };

  return (
    <main className="apex-ecra-claro mx-auto flex w-full max-w-lg flex-col gap-2 px-5 pt-6 pb-8">
      <BotaoVoltar />
      <h1 className="apex-tipo-titulo-ecra" style={{ color: COR.tinta }}>
        Definições
      </h1>

      <Seccao titulo="Conta">
        {ehAtleta ? (
          <>
            <LinhaLink href="/perfil" texto="O meu perfil" />
            <LinhaLink href="/perfil/editar" texto="Editar perfil" detalhe="Foto, nome, objetivo, bio" />
          </>
        ) : (
          <>
            {perfil?.pt_code ? <LinhaLink href={`/pt/${perfil.pt_code}`} texto="O meu perfil público" /> : null}
            <LinhaLink href="/perfil/editar" texto="Editar perfil público" detalhe="Currículo, contactos, foto" />
          </>
        )}
      </Seccao>

      {ehAtleta ? (
        <Seccao titulo="O teu PT e o que ele vê">
          {!ligacao ? (
            <div className="flex flex-col gap-1 py-3">
              <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
                Não tens um PT ligado — ninguém vê os teus dados de treino.
              </p>
              <Link href="/ligar" className="apex-tipo-secundario apex-link-toque self-start underline underline-offset-4" style={{ color: COR.tinta }}>
                Ligar a um PT
              </Link>
            </div>
          ) : ligacao.status === "pendente" ? (
            <div className="flex flex-col gap-1 py-3">
              <p className="apex-tipo-corpo" style={{ color: COR.tinta }}>
                Pedido a {ligacao.pt?.name ?? "PT"} — à espera de resposta.
              </p>
              <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
                Enquanto não aceitar, não vê nada.
              </p>
              <form action={revogarAcesso}>
                <input type="hidden" name="link_id" value={ligacao.id} />
                <button type="submit" className="apex-tipo-secundario apex-link-toque underline underline-offset-4" style={{ color: COR.fraco }}>
                  Cancelar pedido
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-3">
              <p className="apex-tipo-corpo" style={{ color: COR.tinta }}>
                <strong>{ligacao.pt?.name ?? "O teu PT"}</strong> vê os teus treinos e o que autorizares abaixo. Podes
                mudar a qualquer momento.
              </p>
              <PermissoesPt
                linkId={ligacao.id}
                evolucao={ligacao.scope_evolucao}
                videos={ligacao.scope_videos}
                metricas={ligacao.scope_metricas}
              />
            </div>
          )}
        </Seccao>
      ) : null}

      <Seccao titulo="Sessão">
        <form action={sair}>
          <button
            type="submit"
            className="apex-tipo-corpo flex w-full items-center justify-between py-3 text-left"
            style={{ minHeight: 48, color: COR.tinta, fontWeight: 600 }}
          >
            Terminar sessão
          </button>
        </form>
      </Seccao>

      <Seccao titulo="Legal">
        <LinhaLink href="/termos" texto="Termos de Utilização" />
        <LinhaLink href="/privacidade" texto="Política de Privacidade" />
      </Seccao>
    </main>
  );
}

function Seccao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-6 flex flex-col">
      <h2 className="apex-tipo-etiqueta border-b pb-2" style={{ color: COR.fraco, borderColor: COR.linha }}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function LinhaLink({ href, texto, detalhe }: { href: string; texto: string; detalhe?: string }) {
  return (
    <Link href={href} className="apex-linha-exercicio" style={{ textDecoration: "none", minHeight: 52 }}>
      <span className="flex min-w-0 flex-col">
        <span className="apex-tipo-corpo" style={{ color: COR.tinta, fontWeight: 600 }}>
          {texto}
        </span>
        {detalhe ? (
          <span className="apex-tipo-etiqueta" style={{ color: COR.fraco, fontWeight: 500 }}>
            {detalhe}
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" className="apex-tipo-corpo" style={{ color: COR.fraco }}>
        ›
      </span>
    </Link>
  );
}
