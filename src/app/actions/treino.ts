"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarPerfilMotor, carregarPlanoAtivo } from "@/lib/treino/perfil";
import { estimarRecordesDaSessao } from "@/lib/treino/estimativa-1rm";
import { notificar } from "@/lib/social/notificar";
import {
  advanceWeek,
  initProgression,
  referenceLoads,
  LIFT_LABEL,
  DAY_NAMES,
  DAY_SHORT,
  GOALS,
  type DiaGerado,
  type ExercicioGerado,
  type FocusMuscle,
  type Goal,
  type Injury,
  type Level,
  type Lift,
  type Location,
  type PlanoGerado,
  type Sex,
} from "@/lib/motor";
import {
  gerarPlanoV2,
  EQUIP_CASA_IDS,
  EXERCICIOS,
  MUSCULO_LABEL,
  CALENDARIO,
  decidirProgressaoManual,
  type Equipamento,
} from "@/lib/motor2";
import { lerDecimal } from "@/lib/formato";

const EXERCICIO_POR_ID = new Map(EXERCICIOS.map((e) => [e.id, e]));

const GOAL_IDS = GOALS.map((g) => g.id) as Goal[];
const SEXES: Sex[] = ["homem", "mulher"];
const LEVELS: Level[] = ["iniciante", "intermedio", "avancado"];
const LOCATIONS: Location[] = ["ginasio", "casa", "hibrido", "parque", "outro"];
const INJURY_IDS: Injury[] = [
  "ombro",
  "cotovelo",
  "pulso",
  "joelho",
  "lombar",
  "anca",
  "tornozelo",
  "pescoco",
];
const FOCUS_IDS: FocusMuscle[] = ["gluteo", "peito", "costas", "ombros", "bracos", "core"];
const EFFORTS = ["abaixo", "equilibrado", "limite", "passei"] as const;

const BLOQUEIO_RLS =
  "Não foi possível guardar. As políticas de segurança da base de dados podem estar a bloquear esta operação.";

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export type EstadoOnboarding = {
  erros?: Record<string, string>;
  mensagem?: string;
};

export async function guardarOnboarding(
  _anterior: EstadoOnboarding,
  formData: FormData,
): Promise<EstadoOnboarding> {
  const goal = String(formData.get("goal") ?? "");
  const sex = String(formData.get("sex") ?? "");
  const level = String(formData.get("level") ?? "");
  const daysRaw = String(formData.get("days_per_week") ?? "");
  const location = String(formData.get("location") ?? "");
  const locationNote = String(formData.get("location_note") ?? "").trim();
  const injuryNote = String(formData.get("injury_note") ?? "").trim();
  const injuries = formData.getAll("injuries").map(String).filter((v) => INJURY_IDS.includes(v as Injury));
  const focus = formData.getAll("focus_muscles").map(String).filter((v) => FOCUS_IDS.includes(v as FocusMuscle));
  const splitFormatRaw = String(formData.get("split_format") ?? "auto");
  const splitFormat = (["frequencia", "muscular", "auto"] as const).includes(splitFormatRaw as never)
    ? splitFormatRaw
    : "auto";
  const gymDaysRaw = String(formData.get("gym_days_per_week") ?? "");
  const gymDays = Number.parseInt(gymDaysRaw, 10);
  const homeEquipment = formData
    .getAll("home_equipment")
    .map(String)
    .filter((v) => EQUIP_CASA_IDS.includes(v as Equipamento));

  const erros: Record<string, string> = {};
  if (!GOAL_IDS.includes(goal as Goal)) erros.goal = "Escolhe um objetivo.";
  if (!SEXES.includes(sex as Sex)) erros.sex = "Escolhe uma opção.";
  if (!LEVELS.includes(level as Level)) erros.level = "Escolhe o teu nível.";
  const daysPerWeek = Number.parseInt(daysRaw, 10);
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 3 || daysPerWeek > 6) {
    erros.days_per_week = "Escolhe entre 3 e 6 dias.";
  }
  if (!LOCATIONS.includes(location as Location)) erros.location = "Escolhe onde treinas.";
  if (location === "outro" && locationNote.length < 2) {
    erros.location_note = "Descreve o local de treino.";
  }
  if (locationNote.length > 120) erros.location_note = "Máximo 120 caracteres.";
  // Casa + Ginásio: pelo menos um dia de cada lado — senão o local é outro.
  if (location === "hibrido") {
    const maxGinasio = Number.isInteger(daysPerWeek) ? daysPerWeek - 1 : 5;
    if (!Number.isInteger(gymDays) || gymDays < 1 || gymDays > maxGinasio) {
      erros.gym_days_per_week = "Escolhe quantos dias treinas no ginásio (pelo menos um em casa).";
    }
  }
  if (injuryNote.length > 200) erros.injury_note = "Máximo 200 caracteres.";

  if (Object.keys(erros).length > 0) return { erros };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { mensagem: "Sessão inválida. Inicia sessão outra vez." };

  // Dados de onboarding vivem em perfil_privado (migração 023 — só o dono
  // lê/escreve). upsert: a linha existe sempre (migração + registo), mas
  // nunca se perde um onboarding se, por algum motivo, faltar.
  const { error: erroPerfil } = await supabase
    .from("perfil_privado")
    .upsert({
      id: user.id,
      goal,
      sex,
      level,
      days_per_week: daysPerWeek,
      location,
      location_note: location === "outro" ? locationNote : null,
      injuries,
      injury_note: injuries.length ? injuryNote || null : null,
      focus_muscles: goal === "hipertrofia" ? focus : [],
      split_format: goal === "hipertrofia" ? splitFormat : "auto",
      // gym_days_per_week só faz sentido em "hibrido" (o CHECK da 010 compara
      // com days_per_week). home_equipment também serve "casa" sozinho.
      gym_days_per_week: location === "hibrido" ? gymDays : null,
      home_equipment: location === "hibrido" || location === "casa" ? homeEquipment : [],
    });

  if (erroPerfil) return { mensagem: BLOQUEIO_RLS };

  const resultado = await criarPlano(user.id);
  if (resultado.erro) return { mensagem: resultado.erro };

  redirect("/plano");
}

// ---------------------------------------------------------------------------
// (Re)gerar o plano — reinicia a progressão (é relativa a este plano)
// ---------------------------------------------------------------------------

export async function regenerarPlano(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  await criarPlano(user.id);
  revalidatePath("/plano");
}

async function criarPlano(userId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const ctx = await carregarPerfilMotor(supabase, userId);
  if (!ctx) return { erro: "Completa o onboarding primeiro." };

  const progression = initProgression();
  const plano = gerarPlanoV2(ctx.motorProfile, ctx.maxes, { progression });
  const nomeObjetivo = GOALS.find((g) => g.id === ctx.motorProfile.goal)?.short ?? "Plano";

  await supabase
    .from("training_plans")
    .update({ is_active: false })
    .eq("owner_id", userId)
    .eq("is_active", true);

  const { data: novo, error } = await supabase
    .from("training_plans")
    .insert({
      owner_id: userId,
      student_id: userId,
      name: `${nomeObjetivo} · ${ctx.motorProfile.daysPerWeek} dias/semana`,
      split_style: plano.meta.splitStyle,
      days: plano,
      progression,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !novo) return { erro: BLOQUEIO_RLS };

  // Gerar um plano = ficar a segui-lo na hora (comportamento de sempre) — o
  // ponteiro (migração 012) é quem agora decide "qual é o plano ativo".
  await supabase.from("active_plans").upsert(
    { student_id: userId, plan_id: novo.id },
    { onConflict: "student_id" },
  );

  return {};
}

// ---------------------------------------------------------------------------
// Escolher qual plano seguir (o próprio, ou um que o PT atribuiu)
// ---------------------------------------------------------------------------

export async function escolherPlano(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const planId = String(formData.get("plan_id") ?? "");
  if (!planId) redirect("/plano");

  // A RLS (migração 011) já só deixa o aluno LER planos que são para ele —
  // confirmar aqui dá uma falha silenciosa em vez de um upsert a apontar
  // para lado nenhum se o id vier adulterado.
  const { data: plano } = await supabase
    .from("training_plans")
    .select("id, student_id")
    .eq("id", planId)
    .maybeSingle();

  if (!plano || plano.student_id !== user.id) redirect("/plano");

  const { error } = await supabase
    .from("active_plans")
    .upsert({ student_id: user.id, plan_id: planId }, { onConflict: "student_id" });

  if (!error) revalidatePath("/plano");
  redirect("/plano");
}

// ---------------------------------------------------------------------------
// Registar um treino (workout_sessions + workout_checkins)
// ---------------------------------------------------------------------------

export type EstadoRegisto = { erro?: string };

/** Uma linha de `exercise_logs` (migração 008) tal como o treino ao vivo a
 *  monta no fim da sessão (RegistoTreino → logs_json). Sem tipos partilhados
 *  com o cliente de propósito — é só um JSON solto num campo escondido,
 *  validado aqui como qualquer outro FormData; nunca se confia na forma. */
type LogExercicioValidado = {
  exercise_id: string;
  ordem: number;
  skipped: boolean;
  load_kg: number | null;
  reps: number | null;
  rpe: number | null;
  sets_done: number;
};

/** Best-effort: linhas com forma inesperada são ignoradas, nunca rebentam o
 *  registo do treino — exercise_logs é o detalhe por exercício (base do
 *  motor v2 §5, ainda não consumida por nada em produção), não a sessão em
 *  si (workout_sessions/workout_checkins, essas sim têm de ter sucesso). */
function validarLogsExercicio(raw: string): LogExercicioValidado[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: LogExercicioValidado[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.exercicioId !== "string" || !o.exercicioId) continue;
    const setsDone = Number.isInteger(o.setsDone) && (o.setsDone as number) >= 0 ? (o.setsDone as number) : 0;
    const rpe = typeof o.rpe === "number" && o.rpe >= 6 && o.rpe <= 10 ? o.rpe : null;
    out.push({
      exercise_id: o.exercicioId.slice(0, 100),
      ordem: Number.isInteger(o.ordem) ? (o.ordem as number) : 1,
      skipped: o.skipped === true || setsDone === 0,
      load_kg: typeof o.loadKg === "number" && Number.isFinite(o.loadKg) ? o.loadKg : null,
      reps: Number.isInteger(o.reps) ? (o.reps as number) : null,
      rpe,
      sets_done: setsDone,
    });
  }
  return out.slice(0, 30); // defensivo — nenhum dia do motor/PT chega perto disto
}

export async function gravarTreino(
  _anterior: EstadoRegisto,
  formData: FormData,
): Promise<EstadoRegisto> {
  const title = String(formData.get("title") ?? "").trim();
  const setsDone = Number.parseInt(String(formData.get("sets_done") ?? "0"), 10);
  const setsTotal = Number.parseInt(String(formData.get("sets_total") ?? "0"), 10);
  const volumeKg = Number.parseFloat(String(formData.get("volume_kg") ?? "0"));
  const avgRpeRaw = String(formData.get("avg_rpe") ?? "").trim();
  const weekNumber = Number.parseInt(String(formData.get("week_number") ?? "1"), 10);
  const effort = String(formData.get("effort") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const zones = formData
    .getAll("discomfort_zones")
    .map(String)
    .filter((z) => INJURY_IDS.includes(z as Injury));

  if (!title) return { erro: "Falta o nome da sessão." };
  if (!Number.isInteger(setsDone) || setsDone < 0) return { erro: "Séries inválidas." };
  if (effort && !EFFORTS.includes(effort as (typeof EFFORTS)[number])) {
    return { erro: "Valor de esforço inválido." };
  }
  if (note.length > 500) return { erro: "Nota demasiado longa (máx. 500)." };

  const avgRpe = avgRpeRaw ? Number.parseFloat(avgRpeRaw) : null;
  if (avgRpe != null && (!isFinite(avgRpe) || avgRpe < 6 || avgRpe > 10)) {
    return { erro: "Esforço médio inválido — volta a registar as séries." };
  }
  const completion =
    Number.isInteger(setsTotal) && setsTotal > 0
      ? Math.min(1, Math.max(0, setsDone / setsTotal))
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  // Semana de descarga da progressão ATIVA neste momento — para o gráfico
  // de volume (/progresso) poder distinguir mais tarde uma quebra
  // intencional de um treino saltado. Best-effort: se a leitura falhar,
  // grava-se como false (limitação honesta) em vez de bloquear a sessão.
  const planoAtivoAgora = await carregarPlanoAtivo(supabase, user.id).catch(() => null);
  const isDeload = planoAtivoAgora?.progression?.deloadWeek ?? false;

  const { data: sessao, error: erroSessao } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      title,
      n_sets: setsDone,
      volume_kg: Number.isFinite(volumeKg) ? Math.round(volumeKg) : 0,
      avg_rpe: avgRpe,
      completion,
      week_number: Number.isInteger(weekNumber) ? weekNumber : 1,
      is_deload: isDeload,
    })
    .select("id")
    .single();

  if (erroSessao || !sessao) return { erro: BLOQUEIO_RLS };

  const { error: erroCheckin } = await supabase.from("workout_checkins").insert({
    user_id: user.id,
    session_id: sessao.id,
    discomfort_zones: zones,
    effort: effort || null,
    note: note || null,
  });

  if (erroCheckin) return { erro: BLOQUEIO_RLS };

  // Registo por exercício (exercise_logs) — best-effort, ver
  // validarLogsExercicio. Não bloqueia o registo do treino se falhar: a
  // sessão e o check-in (o que já é usado — /plano, avancarSemana) já
  // gravaram com sucesso a esta altura.
  const logs = validarLogsExercicio(String(formData.get("logs_json") ?? "[]"));
  if (logs.length > 0) {
    const { error: erroLogs } = await supabase.from("exercise_logs").insert(
      logs.map((l) => ({
        ...l,
        user_id: user.id,
        session_id: sessao.id,
        week_number: Number.isInteger(weekNumber) ? weekNumber : 1,
      })),
    );
    if (erroLogs) console.error("exercise_logs: falha ao gravar (best-effort)", erroLogs);

    // Estimativa automática de 1RM (migração 016) — best-effort, nunca
    // bloqueia a sessão. Só entra no gráfico de progresso e, nas cargas
    // prescritas, só se não houver nenhum 1RM manual para o mesmo
    // levantamento (regra em maxesFromPRs, src/lib/motor).
    const recordesAuto = estimarRecordesDaSessao(logs);
    if (recordesAuto.length > 0) {
      const { error: erroRecordes } = await supabase.from("personal_records").insert(
        recordesAuto.map((r) => ({
          user_id: user.id,
          lift: r.lift,
          value_kg: r.valueKg,
          source: "auto",
        })),
      );
      if (erroRecordes) console.error("personal_records (auto): falha ao gravar (best-effort)", erroRecordes);
    }
  }

  await notificar(supabase, {
    userId: user.id,
    tipo: "treino_concluido",
    titulo: "Treino concluído",
    corpo: `Treino concluído: ${title}`,
    refId: sessao.id,
  });

  revalidatePath("/plano");
  revalidatePath("/progresso");
  redirect("/plano?treino=gravado");
}

// ---------------------------------------------------------------------------
// Avançar a semana (progressão)
// ---------------------------------------------------------------------------

export type EstadoAvanco = {
  erro?: string;
  ok?: boolean;
  semana?: number;
  deload?: boolean;
  reason?: string;
  cargas?: { lift: string; antes: number; depois: number }[];
};

export async function avancarSemana(
  _anterior: EstadoAvanco,
  _formData: FormData,
): Promise<EstadoAvanco> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const planoAtivo = await carregarPlanoAtivo(supabase, user.id);
  if (!planoAtivo) return { erro: "Não há plano ativo." };
  const prog = planoAtivo.progression ?? initProgression();

  const { data: sessoes } = await supabase
    .from("workout_sessions")
    .select("avg_rpe, completion")
    .eq("user_id", user.id)
    .eq("week_number", prog.week);

  if (!sessoes || sessoes.length === 0) {
    return { erro: "Regista pelo menos um treino desta semana antes de avançar." };
  }

  const rpes = sessoes.map((s) => s.avg_rpe).filter((v): v is number => v != null);
  const comps = sessoes.map((s) => s.completion).filter((v): v is number => v != null);
  const meanRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 8;
  const meanComp = comps.length ? comps.reduce((a, b) => a + b, 0) / comps.length : 1;

  // Plano gerado pelo motor: regenera tudo (comportamento de sempre).
  if (planoAtivo.souDono) {
    const ctx = await carregarPerfilMotor(supabase, user.id);
    if (!ctx) return { erro: "Completa o onboarding primeiro." };

    const antesLoads = referenceLoads(ctx.motorProfile, ctx.maxes, prog);
    const novoProg = advanceWeek(prog, ctx.motorProfile, meanRpe, meanComp);
    const depoisLoads = referenceLoads(ctx.motorProfile, ctx.maxes, novoProg);
    const novoPlano = gerarPlanoV2(ctx.motorProfile, ctx.maxes, { progression: novoProg });

    const { error } = await supabase
      .from("training_plans")
      .update({ progression: novoProg, days: novoPlano })
      .eq("id", planoAtivo.id)
      .eq("owner_id", user.id);

    if (error) return { erro: BLOQUEIO_RLS };

    revalidatePath("/plano");
    return {
      ok: true,
      semana: novoProg.week,
      deload: novoProg.deloadWeek,
      reason: novoProg.reason,
      cargas: (["agachamento", "terra", "supino", "press"] as Lift[]).map((k) => ({
        lift: LIFT_LABEL[k],
        antes: antesLoads[k],
        depois: depoisLoads[k],
      })),
    };
  }

  // Plano atribuído por um PT: os exercícios (`days`) são do PT — nunca se
  // escrevem daqui (migrações 013/014, só o dono os muda). A progressão só
  // grava `progression`; as cargas/reps "de agora" calculam-se em leitura
  // (ver src/lib/motor2/progressao-manual.ts) quando o plano é mostrado.
  const novoProg = decidirProgressaoManual(prog, meanRpe, meanComp);

  const { error } = await supabase
    .from("training_plans")
    .update({ progression: novoProg })
    .eq("id", planoAtivo.id)
    .eq("student_id", user.id);

  if (error) return { erro: BLOQUEIO_RLS };

  revalidatePath("/plano");
  return {
    ok: true,
    semana: novoProg.week,
    deload: novoProg.deloadWeek,
    reason: novoProg.reason,
  };
}

// ---------------------------------------------------------------------------
// PT: criar/editar um plano e atribuí-lo a um aluno
// ---------------------------------------------------------------------------

/** O formato que o editor (client) manda no campo escondido `plano_json`. */
type ExercicioEditorJSON = {
  exercicioId: string;
  series: number;
  reps: number;
  carga: number | null;
  nota: string;
};
type DiaEditorJSON = { nome: string; exercicios: ExercicioEditorJSON[] };

const MAX_DIAS_PT = 6;
const MAX_EXERCICIOS_DIA_PT = 12;

export type EstadoAtribuirPlano = {
  erro?: string;
  ok?: boolean;
};

/** Valida e normaliza o JSON do editor. Nunca confia em nome/músculo vindos
 *  do cliente — só no `exercicioId` (resolvido contra a base do motor2) e
 *  nos números que o PT escreveu (séries/reps/carga/nota). */
function validarPlanoPt(bruto: unknown): { dias: DiaEditorJSON[] } | { erro: string } {
  if (!Array.isArray(bruto) || bruto.length === 0) return { erro: "O plano precisa de pelo menos um dia." };
  if (bruto.length > MAX_DIAS_PT) return { erro: `Máximo ${MAX_DIAS_PT} dias de treino.` };

  const dias: DiaEditorJSON[] = [];
  for (const diaBruto of bruto) {
    if (typeof diaBruto !== "object" || diaBruto === null) return { erro: "Dia inválido." };
    const d = diaBruto as Record<string, unknown>;
    const nome = typeof d.nome === "string" ? d.nome.trim().slice(0, 60) : "";
    if (!nome) return { erro: "Cada dia precisa de um nome (ex.: Peito e Tríceps)." };
    if (!Array.isArray(d.exercicios) || d.exercicios.length === 0) {
      return { erro: `"${nome}": adiciona pelo menos um exercício.` };
    }
    if (d.exercicios.length > MAX_EXERCICIOS_DIA_PT) {
      return { erro: `"${nome}": máximo ${MAX_EXERCICIOS_DIA_PT} exercícios por dia.` };
    }

    const exercicios: ExercicioEditorJSON[] = [];
    for (const exBruto of d.exercicios) {
      if (typeof exBruto !== "object" || exBruto === null) return { erro: `"${nome}": exercício inválido.` };
      const e = exBruto as Record<string, unknown>;
      const exercicioId = typeof e.exercicioId === "string" ? e.exercicioId : "";
      const exercicio = EXERCICIO_POR_ID.get(exercicioId);
      if (!exercicio) return { erro: `"${nome}": exercício desconhecido.` };

      const series = Number(e.series);
      if (!Number.isInteger(series) || series < 1 || series > 10) {
        return { erro: `${exercicio.nome}: séries tem de ser um número entre 1 e 10.` };
      }
      const reps = Number(e.reps);
      if (!Number.isInteger(reps) || reps < 1 || reps > 50) {
        return { erro: `${exercicio.nome}: reps tem de ser um número entre 1 e 50.` };
      }
      let carga: number | null = null;
      if (e.carga !== null && e.carga !== undefined && e.carga !== "") {
        const n = lerDecimal(String(e.carga)); // "72,5" ou "72.5"
        if (!Number.isFinite(n) || n < 0 || n > 500) {
          return { erro: `${exercicio.nome}: carga inválida.` };
        }
        carga = Math.round(n * 4) / 4; // 0.25 kg
      }
      const nota = typeof e.nota === "string" ? e.nota.trim().slice(0, 200) : "";

      exercicios.push({ exercicioId, series, reps, carga, nota });
    }
    dias.push({ nome, exercicios });
  }
  return { dias };
}

function planoPtParaGerado(dias: DiaEditorJSON[], ptNome: string): PlanoGerado {
  const posicoes = CALENDARIO[dias.length] ?? CALENDARIO[Math.min(6, Math.max(1, dias.length))];
  const porPosicao = new Map(dias.map((d, i) => [posicoes[i], d]));

  const diasGerados: DiaGerado[] = [];
  for (let i = 0; i < 7; i++) {
    const d = porPosicao.get(i);
    if (!d) {
      diasGerados.push({ dayIndex: i, dayName: DAY_NAMES[i], dayShort: DAY_SHORT[i], rest: true, title: "Descanso" });
      continue;
    }
    const exercises: ExercicioGerado[] = d.exercicios.map((e) => {
      const ex = EXERCICIO_POR_ID.get(e.exercicioId)!;
      return {
        name: ex.nome,
        swap: null,
        sets: Array.from({ length: e.series }, () => ({ w: e.carga, reps: e.reps, rpe: "—" })),
        rest: "90 s",
        muscle: ex.primarios[0] ? MUSCULO_LABEL[ex.primarios[0].musculo] : null,
        bw: e.carga == null,
        substituted: false,
        nota: e.nota || undefined,
        exercicioId: e.exercicioId,
      };
    });
    diasGerados.push({ dayIndex: i, dayName: DAY_NAMES[i], dayShort: DAY_SHORT[i], rest: false, title: d.nome, exercises });
  }

  return {
    version: 1,
    meta: { origem: "pt", ptNome, week: 1, deloadWeek: false, generatedAt: new Date().toISOString() },
    days: diasGerados,
  };
}

export async function atribuirPlanoPt(
  _anterior: EstadoAtribuirPlano,
  formData: FormData,
): Promise<EstadoAtribuirPlano> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  const alunoId = String(formData.get("aluno_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 80);
  if (!alunoId) return { erro: "Aluno inválido." };
  if (!nome) return { erro: "Dá um nome ao plano." };

  let planoJson: unknown;
  try {
    planoJson = JSON.parse(String(formData.get("plano_json") ?? "[]"));
  } catch {
    return { erro: "Plano inválido — tenta novamente." };
  }
  const validado = validarPlanoPt(planoJson);
  if ("erro" in validado) return { erro: validado.erro };

  // Confirma a ligação aqui para dar um erro claro — a RLS (011) já
  // impediria o INSERT/UPDATE de qualquer forma se isto não se verificar.
  const { data: link } = await supabase
    .from("pt_links")
    .select("id")
    .eq("pt_id", user.id)
    .eq("student_id", alunoId)
    .eq("status", "ativo")
    .eq("scope_treinos", true)
    .maybeSingle();
  if (!link) return { erro: "Não tens ligação ativa (com permissão de treinos) a este aluno." };

  const { data: perfilPt } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  const plano = planoPtParaGerado(validado.dias, perfilPt?.name ?? "O teu PT");

  // Um plano por (PT, aluno) — editar é sempre a linha mais recente.
  const { data: existente } = await supabase
    .from("training_plans")
    .select("id")
    .eq("owner_id", user.id)
    .eq("student_id", alunoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("training_plans")
      .update({ name: nome, days: plano })
      .eq("id", existente.id)
      .eq("owner_id", user.id);
    if (error) return { erro: BLOQUEIO_RLS };
  } else {
    const { error } = await supabase.from("training_plans").insert({
      owner_id: user.id,
      student_id: alunoId,
      name: nome,
      days: plano,
      progression: initProgression(),
      is_active: false, // o aluno é quem escolhe seguir este plano
    });
    if (error) return { erro: BLOQUEIO_RLS };
  }

  await notificar(supabase, {
    userId: alunoId,
    tipo: "plano_atribuido",
    titulo: "Plano atribuído",
    corpo: `${perfilPt?.name ?? "O teu PT"} atribuiu-te um plano novo: ${nome}`,
  });

  revalidatePath(`/pt/aluno/${alunoId}`);
  return { ok: true };
}
