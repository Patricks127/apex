import type { SupabaseClient } from "@supabase/supabase-js";
import { janelaRecente } from "./perfil";
import { avaliarAtencao, JANELA_ATENCAO_DIAS, MIN_SESSOES_PARA_RPE, type MotivoAtencao } from "./atencao";

/** Dias inteiros desde um timestamp ISO até agora. */
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Porta única para "que alunos precisam de atenção, e porquê" — usada por
 * /painel, /pt/alunos e a ficha de um aluno (src/app/pt/aluno/[id]), para
 * os três não divergirem em silêncio sobre o que conta como atenção.
 * Consultas em lote (não N+1): dois SELECTs no total, independentemente
 * de quantos `alunoIds`.
 */
export async function atencaoDosAlunos(
  supabase: SupabaseClient,
  alunoIds: string[],
): Promise<Map<string, MotivoAtencao[]>> {
  const atencaoPorAluno = new Map<string, MotivoAtencao[]>();
  if (alunoIds.length === 0) return atencaoPorAluno;

  // Dor recorrente, adesão e esforço olham todos para a mesma janela (3
  // semanas) — um sinal de atenção tem de expirar, senão um PT com muitos
  // alunos passa a ignorar alertas que nunca desaparecem.
  const corteAtencao = janelaRecente(JANELA_ATENCAO_DIAS);

  const [{ data: checkins }, { data: sessoes }] = await Promise.all([
    supabase
      .from("workout_checkins")
      .select("user_id, discomfort_zones")
      .in("user_id", alunoIds)
      .gte("created_at", corteAtencao),
    // Sem filtro de data aqui — precisamos da sessão mais recente de
    // sempre para "inativo" (a janela filtra-se abaixo, em memória, para
    // adesão/esforço). Limite defensivo (não é paginação a sério, só um
    // travão a crescimento patológico) — nenhum PT real tem isto hoje.
    supabase
      .from("workout_sessions")
      .select("user_id, completion, avg_rpe, created_at")
      .in("user_id", alunoIds)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  for (const alunoId of alunoIds) {
    const checkinsComDor = (checkins ?? []).filter(
      (c) => c.user_id === alunoId && (c.discomfort_zones ?? []).length > 0,
    ).length;
    // `sessoes` já vem ordenado desc — o filter preserva a ordem.
    const sessoesDoAluno = (sessoes ?? []).filter((s) => s.user_id === alunoId);
    const ultima = sessoesDoAluno[0];
    const diasDesdeUltimaSessao = ultima ? diasDesde(ultima.created_at) : null;

    // Só sessões DENTRO da janela de atenção — uma sessão incompleta de
    // há dois meses não pode continuar a pesar na média de hoje.
    const naJanela = sessoesDoAluno.filter((s) => s.created_at >= corteAtencao);

    const completions = naJanela.map((s) => s.completion).filter((c): c is number => c != null);
    const completionMediaNaJanela = completions.length
      ? completions.reduce((a, b) => a + b, 0) / completions.length
      : null;

    const rpes = naJanela.map((s) => s.avg_rpe).filter((r): r is number => r != null);
    const rpeMedioNaJanela = rpes.length >= MIN_SESSOES_PARA_RPE ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

    const motivos = avaliarAtencao({
      diasDesdeUltimaSessao,
      checkinsComDesconfortoNaJanela: checkinsComDor,
      completionMediaNaJanela,
      rpeMedioNaJanela,
    });
    if (motivos.length) atencaoPorAluno.set(alunoId, motivos);
  }

  return atencaoPorAluno;
}
