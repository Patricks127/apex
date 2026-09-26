import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import { RegistoLivre } from "./registo-livre";

export const metadata: Metadata = {
  title: "Registar treino · APEX",
};

/**
 * Registo de treino LIVRE — para quem segue um plano em PDF (sem
 * exercícios estruturados para o motor acompanhar). Grava em
 * workout_sessions + workout_checkins através do MESMO gravarTreino que
 * o treino ao vivo já usa (actions/treino.ts) — só sem sets/volume/RPE/
 * logs_json, que ficam a null/0/[] pelos valores por omissão da própria
 * ação. Alimenta o sinal de adesão e os alertas de desconforto do painel
 * do PT exatamente como uma sessão estruturada (ver adesao-semanal.ts,
 * atencao.ts — nenhum dos dois olha para exercise_logs).
 */
export default async function RegistarTreinoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  return (
    <main className="apex-ecra-claro mx-auto flex w-full max-w-lg flex-col gap-5 px-5 py-8">
      <div>
        {/* router.back() — alcançável do /plano e do cartão do plano em
            PDF no /painel; um Link fixo estaria errado sempre que a
            origem real fosse a outra. */}
        <BotaoVoltar cor="var(--apex-cinza-texto)" />
        <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 4, color: "var(--apex-tinta)" }}>
          Registar treino de hoje
        </h1>
        <p className="apex-tipo-secundario" style={{ color: "var(--apex-cinza-texto)" }}>
          Sem exercícios estruturados — só o essencial, para o teu PT saber que treinaste.
        </p>
      </div>
      <RegistoLivre />
    </main>
  );
}
