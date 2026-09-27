import { createClient } from "@/lib/supabase/server";
import { BarraNavegacaoCliente, type Papel } from "./barra-navegacao-cliente";

/**
 * Navegação inferior própria da app (pontos 12/22 do plano de execução) —
 * antes, a navegação era uma fila de links sublinhados no fim do painel, e
 * qualquer outro ecrã só tinha "← Voltar". Montada uma vez no layout raiz;
 * aqui só se decide o PAPEL (atleta e PT têm separadores diferentes). Onde
 * aparece (e onde não — entrar, registar, treino ao vivo, conversa) decide o
 * componente cliente, que sabe o caminho atual.
 *
 * Não é uma decisão de acesso — só escolhe que separadores mostrar. Cada
 * ecrã continua a validar a sessão e o papel por conta própria.
 */
export async function BarraNavegacao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const papel: Papel | null = perfil?.role === "pt" ? "pt" : perfil?.role === "atleta" ? "atleta" : null;
  if (!papel) return null;

  return <BarraNavegacaoCliente papel={papel} />;
}
