import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chaveDiaLisboa, formatarData, formatarHora } from "@/lib/fuso";
import { carregarNotificacoes, type Notificacao } from "@/lib/social/notificacoes-dados";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { MarcarVisiveisLidas } from "./marcar-visiveis-lidas";

export const metadata: Metadata = {
  title: "Notificações · APEX",
};

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
} as const;

// Agrupar e rotular pelo dia de LISBOA (era o dia UTC: uma notificação da
// 00:30 caía no grupo de "ontem", e a hora mostrada vinha 1h atrasada no
// verão — o servidor corre em UTC).
const chaveDoDia = (iso: string) => chaveDiaLisboa(iso);

function rotuloDoDia(chave: string): string {
  const hoje = chaveDiaLisboa(new Date());
  const ontem = chaveDiaLisboa(Date.now() - 86_400_000);
  if (chave === hoje) return "HOJE";
  if (chave === ontem) return "ONTEM";
  // meio-dia UTC: nunca muda de dia seja qual for o fuso de quem formata
  return formatarData(`${chave}T12:00:00Z`, { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
}

const hora = (iso: string) => formatarHora(iso);

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const notificacoes = await carregarNotificacoes(supabase, user.id);
  const temNaoLidas = notificacoes.some((n) => !n.lida);

  const grupos = new Map<string, Notificacao[]>();
  for (const n of notificacoes) {
    const chave = chaveDoDia(n.createdAt);
    const lista = grupos.get(chave) ?? [];
    lista.push(n);
    grupos.set(chave, lista);
  }

  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col px-0 py-8">
      {/* Marca as não lidas desta visita como lidas — o ecrã continua a
          mostrar o fundo azul nesta visualização (dados já carregados
          acima); só a próxima visita e o contador do sino refletem "lida". */}
      {temNaoLidas ? <MarcarVisiveisLidas /> : null}

      <div className="px-5">
        <BotaoVoltar />
      </div>

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
  return (
    <div className={notificacao.lida ? "apex-notificacao" : "apex-notificacao apex-notificacao--nao-lida"}>
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
    </div>
  );
}
