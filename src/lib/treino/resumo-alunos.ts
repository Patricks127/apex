import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarPlanoAtivo } from "./perfil.ts";
import { JANELA_ATENCAO_DIAS } from "./atencao.ts";
import {
  agruparVolumePorSemanaCalendario,
  direcaoTendencia,
  type Direcao,
  type PontoTendencia,
} from "./tendencia-volume.ts";

export type ResumoAluno = {
  id: string;
  nome: string | null;
  avatarUrl: string | null;
  // Desde a migração 019 (Passo 2.1), o PT vê o plano ativo REAL do aluno
  // — próprio (motor) ou atribuído por qualquer PT, atual ou anterior —
  // sob o mesmo scope_treinos que já protege o resto. null aqui significa
  // mesmo "sem plano ativo", não uma lacuna de RLS (ver
  // apex-training-plans-rls.md / decisions-and-principles.md para o
  // histórico: antes da 019, um plano self-made do aluno era invisível ao
  // PT, daí o texto "Sem plano teu atribuído" que existiu na UI).
  planoNome: string | null;
  semanaAtual: number | null;
  diasPrevistosSemana: number | null; // dias de treino (não-descanso) do plano ativo
  adesaoMedia: number | null; // 0–1, últimos 21 dias; null = sem sessões na janela
  adesaoMediaAnterior: number | null; // 0–1, os 21 dias antes desses — para a variação, só quando os dois existem
  tendencia: PontoTendencia[]; // só semanas com sessão, cronológico
  direcao: Direcao;
};

const DIAS_LOOKBACK_TENDENCIA = 56; // ~8 semanas de calendário — cobre também a janela "anterior" da adesão (21–42 dias)
const MAX_PONTOS_SPARKLINE = 6;

function mediaCompletion(sessoes: { completion: number | null }[]): number | null {
  const valores = sessoes.map((s) => s.completion).filter((c): c is number => c != null);
  return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
}

/**
 * Resumo por aluno para o painel do PT e a lista completa — plano ativo
 * (nome real do plano, nunca um "objetivo" inventado; nem todo o plano
 * tem um `goal` de motor, ex.: planos atribuídos pelo PT), semana atual
 * da progressão, adesão média (mesma janela de 3 semanas que "atenção"
 * já usa, para não inventar uma terceira janela), e a tendência de
 * volume por semana de calendário para o sparkline.
 */
export async function carregarResumoAlunos(
  supabase: SupabaseClient,
  alunos: { id: string; nome: string | null; avatarUrl: string | null }[],
): Promise<ResumoAluno[]> {
  if (alunos.length === 0) return [];
  const alunoIds = alunos.map((a) => a.id);

  const corte = new Date(Date.now() - DIAS_LOOKBACK_TENDENCIA * 86_400_000).toISOString();
  const corteAdesao = new Date(Date.now() - JANELA_ATENCAO_DIAS * 86_400_000).toISOString();
  const corteAdesaoAnterior = new Date(Date.now() - JANELA_ATENCAO_DIAS * 2 * 86_400_000).toISOString();

  const [{ data: sessoes }, planos] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("user_id, performed_at, volume_kg, completion")
      .in("user_id", alunoIds)
      .gte("performed_at", corte),
    Promise.all(alunoIds.map((id) => carregarPlanoAtivo(supabase, id))),
  ]);

  const sessoesPorAluno = new Map<string, { performedAt: string; volumeKg: number; completion: number | null }[]>();
  for (const s of sessoes ?? []) {
    const lista = sessoesPorAluno.get(s.user_id as string) ?? [];
    lista.push({
      performedAt: s.performed_at as string,
      volumeKg: (s.volume_kg as number) ?? 0,
      completion: s.completion as number | null,
    });
    sessoesPorAluno.set(s.user_id as string, lista);
  }

  return alunos.map((aluno, i) => {
    const planoAtivo = planos[i];
    const sessoesDoAluno = sessoesPorAluno.get(aluno.id) ?? [];

    const sessoesNaJanela = sessoesDoAluno.filter((s) => s.performedAt >= corteAdesao);
    const sessoesNaJanelaAnterior = sessoesDoAluno.filter(
      (s) => s.performedAt >= corteAdesaoAnterior && s.performedAt < corteAdesao,
    );
    const adesaoMedia = mediaCompletion(sessoesNaJanela);
    const adesaoMediaAnterior = mediaCompletion(sessoesNaJanelaAnterior);

    const pontosTodos = agruparVolumePorSemanaCalendario(sessoesDoAluno);
    const tendencia = pontosTodos.slice(-MAX_PONTOS_SPARKLINE);

    const diasPrevistosSemana = planoAtivo ? planoAtivo.days.days.filter((d) => !d.rest).length : null;

    return {
      id: aluno.id,
      nome: aluno.nome,
      avatarUrl: aluno.avatarUrl,
      planoNome: planoAtivo?.name ?? null,
      semanaAtual: planoAtivo?.progression?.week ?? null,
      diasPrevistosSemana,
      adesaoMedia,
      adesaoMediaAnterior,
      tendencia,
      direcao: direcaoTendencia(tendencia),
    };
  });
}
