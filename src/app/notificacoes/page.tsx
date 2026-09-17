import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarNotificacoes, type Notificacao } from "@/lib/social/notificacoes-dados";
import { marcarLida } from "@/app/actions/notificacoes";

export const metadata: Metadata = {
  title: "Notificações · APEX",
};

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
} as const;

function chaveDoDia(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function rotuloDoDia(chave: string): string {
  const hoje = chaveDoDia(new Date().toISOString());
  const ontem = chaveDoDia(new Date(Date.now() - 86_400_000).toISOString());
  if (chave === hoje) return "HOJE";
  if (chave === ontem) return "ONTEM";
  return new Date(chave).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const notificacoes = await carregarNotificacoes(supabase, user.id);

  const grupos = new Map<string, Notificacao[]>();
  for (const n of notificacoes) {
    const chave = chaveDoDia(n.createdAt);
    const lista = grupos.get(chave) ?? [];
    lista.push(n);
    grupos.set(chave, lista);
  }

  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col px-0 py-8">
      <h1 className="apex-tipo-titulo-ecra px-5" style={{ marginTop: 0, color: COR.tinta }}>
        Notificações
      </h1>

      {notificacoes.length === 0 ? (
        <p className="apex-tipo-corpo px-5 py-10 text-center" style={{ color: COR.fraco }}>
          Ainda não tens notificações.
        </p>
      ) : (
        <div className="mt-2">
          {[...grupos.entries()].map(([chave, lista]) => (
            <div key={chave}>
              <p className="apex-tipo-etiqueta px-5 py-2" style={{ color: COR.fraco }}>
                {rotuloDoDia(chave)}
              </p>
              {lista.map((n) => (
                <ItemNotificacao key={n.id} notificacao={n} />
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function ItemNotificacao({ notificacao }: { notificacao: Notificacao }) {
  const conteudo = (
    <>
      <div className="min-w-0 flex-1">
        <p className="apex-tipo-corpo" style={{ color: COR.tinta }}>
          {notificacao.titulo}
        </p>
        {notificacao.corpo ? (
          <p className="apex-tipo-secundario" style={{ color: COR.tinta }}>
            {notificacao.corpo}
          </p>
        ) : null}
        <p className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
          {hora(notificacao.createdAt)}
        </p>
      </div>
    </>
  );

  if (notificacao.lida) {
    return <div className="apex-notificacao">{conteudo}</div>;
  }

  return (
    <form action={marcarLida}>
      <input type="hidden" name="id" value={notificacao.id} />
      <button type="submit" className="apex-notificacao apex-notificacao--nao-lida">
        {conteudo}
      </button>
    </form>
  );
}
