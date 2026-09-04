/* ============================================================
   APEX — Motor de Programação v2 · Passo 4
   Validador com pontuação (spec §4 e §4.1).

   Pontuação 0–100 sobre 8 critérios com pesos fixos.
   - >= 85  → aprovado
   - 75–84  → aprovado com reservas (precisaRever)
   - < 75   → rejeitado (regenerar, máx. 3 tentativas)
   As verificações duras da §4.1 falham o plano independentemente da soma.

   Nota de desenho: os critérios são avaliados contra o que é ALCANÇÁVEL com as
   lesões e o equipamento do utilizador, não contra um ideal sem restrições. Um
   plano que é o melhor possível para um utilizador com o ombro lesionado e só
   halteres em casa não deve ser penalizado por não ter press vertical pesado.
   ============================================================ */

import { EXERCICIOS } from "./exercicios.ts";
import {
  MUSCULOS_GRANDES,
  ordemNivel,
  type Exercicio,
  type Musculo,
  type Padrao,
} from "./tipos.ts";
import { calcularVolume } from "./volume.ts";
import {
  selecionarSemana,
  semanaParaEntradaVolume,
  type DiaSelecionado,
  type PerfilSelecao,
  type SemanaSelecionada,
} from "./seletor.ts";

// ---------------------------------------------------------------------------

export type CriterioNome =
  | "cobertura_padroes"
  | "qualidade_selecao"
  | "complementaridade"
  | "gestao_fadiga"
  | "distribuicao_semanal"
  | "adequacao_objetivo"
  | "progressao"
  | "eficiencia_tempo";

export type Criterio = {
  nome: CriterioNome;
  peso: number;
  fracao: number; // 0..1
  pontos: number; // fracao * peso, arredondado a 0.1
  notas: string[];
};

export type ResultadoValidacao = {
  pontuacao: number; // 0..100
  aprovado: boolean; // >= 85 e sem falhas duras
  precisaRever: boolean; // 75..84
  rejeitado: boolean; // < 75 ou falha dura da §4.1
  criterios: Criterio[];
  falhasDuras: string[]; // §4.1
  avisos: string[];
};

const PESOS: Record<CriterioNome, number> = {
  cobertura_padroes: 15,
  qualidade_selecao: 20,
  complementaridade: 15,
  gestao_fadiga: 15,
  distribuicao_semanal: 15,
  adequacao_objetivo: 10,
  progressao: 5,
  eficiencia_tempo: 5,
};

// Padrões que uma semana de hipertrofia deve cobrir (quando possível).
const PADROES_ESSENCIAIS: Padrao[] = [
  "agachar",
  "dobrar_anca",
  "empurrar_horizontal",
  "empurrar_vertical",
  "puxar_horizontal",
  "puxar_vertical",
];
const PADROES_DESEJAVEIS: Padrao[] = [
  "unilateral_inferior",
  "flexao_joelho",
  "extensao_anca",
  "flexao_plantar",
  "abducao_ombro",
  "rotacao_externa",
  "flexao_cotovelo",
  "extensao_cotovelo",
];

const LESOES_MEMBRO_SUPERIOR = ["ombro", "cotovelo", "pulso"] as const;

// Estimativa de duração de uma sessão (min): aquecimento + Σ séries·(trabalho+
// descanso, por fadiga sistémica) + transição/setup por exercício.
const MIN_POR_SERIE: Record<number, number> = { 1: 1.9, 2: 2.4, 3: 3.1 };
export function estimarMinutosDia(d: DiaSelecionado): number {
  let m = 8;
  for (const e of d.exercicios) m += e.series * (MIN_POR_SERIE[e.exercicio.fadigaSistemica] ?? 2.4) + 1;
  return Math.round(m);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Grupos grandes efetivamente treinados como primário num dia. */
function gruposGrandesDoDia(d: DiaSelecionado): Set<Musculo> {
  const s = new Set<Musculo>();
  for (const e of d.exercicios)
    for (const p of e.exercicio.primarios) if (MUSCULOS_GRANDES.includes(p.musculo)) s.add(p.musculo);
  return s;
}

// ---------------------------------------------------------------------------
// Viabilidade — o que é sequer possível montar com as lesões/equipamento/nível
// ---------------------------------------------------------------------------

type Viabilidade = {
  ex: (e: Exercicio) => boolean;
  poolMusculoPrim: (m: Musculo) => number; // exercícios primários viáveis
  poolMusculoPesado: (m: Musculo) => number; // Tier ≤ 2 primários viáveis
  poolPadrao: (p: Padrao) => number;
  padroesEssenciaisPossiveis: Padrao[];
};

function viabilidade(perfil: PerfilSelecao): Viabilidade {
  const disp = new Set(perfil.equipamento);
  const ok = (e: Exercicio) =>
    ordemNivel[e.nivelMinimo] <= ordemNivel[perfil.nivel] &&
    !e.contraindicacoes.some((z) => perfil.lesoes.includes(z)) &&
    e.equipamento.some((q) => disp.has(q));
  const viaveis = EXERCICIOS.filter(ok);
  const poolMusculoPrim = (m: Musculo) => viaveis.filter((e) => e.primarios.some((p) => p.musculo === m)).length;
  const poolMusculoPesado = (m: Musculo) =>
    viaveis.filter((e) => e.tier <= 2 && e.primarios.some((p) => p.musculo === m)).length;
  const poolPadrao = (p: Padrao) => viaveis.filter((e) => e.padrao === p).length;
  return {
    ex: ok,
    poolMusculoPrim,
    poolMusculoPesado,
    poolPadrao,
    padroesEssenciaisPossiveis: PADROES_ESSENCIAIS.filter((p) => poolPadrao(p) > 0),
  };
}

// Músculos "alvo do objetivo" para a §4.1 (mínimo de 8 séries): grupos grandes
// + foco. (Os outros objetivos entram no passo 6.)
function musculosAlvoObjetivo(perfil: PerfilSelecao): Musculo[] {
  return [...new Set<Musculo>([...MUSCULOS_GRANDES, ...(perfil.foco ?? [])])];
}

// ---------------------------------------------------------------------------

export function validarSemana(semana: SemanaSelecionada): ResultadoValidacao {
  const perfil = semana.perfil;
  const dias = semana.dias;
  const minutosSessao = Math.max(30, Math.round(perfil.minutosSessao ?? 75));
  const rel = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
  const vm = (m: Musculo) => rel.porMusculo.find((x) => x.musculo === m);
  const via = viabilidade(perfil);

  const temFull = dias.some((d) => d.tipo === "full");
  const alvoObjetivo = musculosAlvoObjetivo(perfil);

  const criterios: Criterio[] = [];
  const avisos: string[] = [...semana.avisos];
  const falhasDuras: string[] = [];

  // ===== §4.1 — verificações duras =========================================

  // 1. músculo alvo do objetivo abaixo de 8 séries.
  //    Se as lesões/equipamento deixam < 3 exercícios primários viáveis, o
  //    volume está estruturalmente limitado — fica aviso, não falha.
  for (const m of alvoObjetivo) {
    const v = vm(m);
    if (!v || v.direto >= 8) continue;
    const pool = via.poolMusculoPrim(m);
    if (pool < 3)
      avisos.push(
        `${m}: ${v.direto} séries/semana (abaixo de 8) — só ${pool} exercício(s) viável(is) com as lesões/equipamento.`,
      );
    else falhasDuras.push(`${m}: ${v.direto} séries/semana — abaixo do mínimo de 8 (alvo do objetivo).`);
  }

  // 2. acima do teto do nível.
  //    Excesso só de fração de secundário (primário ≤ teto) num split de alta
  //    frequência / músculo conectivo → aviso. Excesso de trabalho DIRETO
  //    primário → falha (o seletor tem de cortar).
  const MUSC_CONECTIVOS: Musculo[] = [
    "gluteo", "core", "lombar", "trapezio_medio", "trapezio_superior", "antebraco", "gemeos",
  ];
  for (const v of rel.porMusculo) {
    if (v.estado !== "acima_teto") continue;
    const conectivo = MUSC_CONECTIVOS.includes(v.musculo);
    // fração de secundário sobre o teto: tolerável num split de alta frequência
    // ou num músculo conectivo. Trabalho DIRETO primário sobre o teto: falha —
    // exceto o glúteo num full-body, onde ~2 séries a mais são fisiológicas.
    const soSecundario = v.primario <= v.teto;
    // o glúteo é co-primário em quase todo o trabalho de perna (agachar, dobrar
    // anca, unilateral): ~3 séries acima do teto são inevitáveis e fisiológicas.
    const glut = v.musculo === "gluteo" && v.primario <= v.teto + 3;
    if ((soSecundario && (temFull || conectivo)) || glut) {
      avisos.push(`${v.musculo} ${v.direto} > teto ${v.teto} (primário ${v.primario}) — tolerável neste split.`);
      continue;
    }
    falhasDuras.push(
      `${v.musculo}: ${v.direto} séries/semana (primário ${v.primario}) — acima do teto (${v.teto}) para ${perfil.nivel}.`,
    );
  }

  // 3. duas famílias iguais no mesmo dia
  for (const d of dias) {
    const fam = d.exercicios.map((e) => e.exercicio.familia);
    const dup = fam.find((f, i) => fam.indexOf(f) !== i);
    if (dup) falhasDuras.push(`${d.nome}: família repetida no mesmo dia (${dup}).`);
  }

  // 4. três ou mais compostos pesados (fadigaSistemica 3) consecutivos
  for (const d of dias) {
    const seq = d.exercicios.map((e) => e.exercicio.fadigaSistemica);
    for (let i = 0; i + 2 < seq.length; i++)
      if (seq[i] === 3 && seq[i + 1] === 3 && seq[i + 2] === 3)
        falhasDuras.push(`${d.nome}: 3 compostos pesados consecutivos (posição ${i + 1}).`);
  }

  // 5. mesmo grupo grande PLANEADO em dias consecutivos.
  //    Compara os alvos do dia (o que o split pretende treinar), não músculos
  //    que aparecem de raspão como primário secundário de um composto. Não se
  //    aplica a full-body (dias de treino com descanso entre si por definição).
  for (let i = 1; i < dias.length; i++) {
    if (dias[i - 1].tipo === "full" || dias[i].tipo === "full") continue;
    const a = new Set(dias[i - 1].musculosAlvo.filter((m) => MUSCULOS_GRANDES.includes(m)));
    const comum = dias[i].musculosAlvo.filter((m) => MUSCULOS_GRANDES.includes(m) && a.has(m));
    if (comum.length)
      falhasDuras.push(`${dias[i - 1].nome} → ${dias[i].nome}: ${comum.join(", ")} em dias consecutivos (<48h).`);
  }

  // 6. rácio empurrar:puxar fora de 1:1 ± 30%.
  //    Lesão do membro superior limita legitimamente o lado de empurrar → aviso.
  if (!rel.racioEmpurrarPuxar.equilibrado) {
    const r = rel.racioEmpurrarPuxar.racio;
    const lesaoMS = perfil.lesoes.some((z) => (LESOES_MEMBRO_SUPERIOR as readonly string[]).includes(z));
    // num full-body cada sessão repete todos os padrões — o rácio por famílias é
    // mais ruidoso; tolera-se uma janela mais larga antes de falhar.
    const foraDeVez = temFull ? r > 1.5 || r < 0.58 : true;
    if (lesaoMS && (r < 0.7 || !Number.isFinite(r)))
      avisos.push(`Rácio empurrar:puxar = ${r}:1 — desequilíbrio esperado com lesão do membro superior.`);
    else if (foraDeVez) falhasDuras.push(`Rácio empurrar:puxar = ${r}:1 — fora de 1:1 ± 30%.`);
    else avisos.push(`Rácio empurrar:puxar = ${r}:1 — ligeiramente fora de 1:1 ± 30% (full-body).`);
  }

  // 7. sessão estimada acima do tempo disponível (tolerância de 8%).
  const minutosDia = dias.map((d) => ({ nome: d.nome, min: estimarMinutosDia(d) }));
  for (const { nome, min } of minutosDia)
    if (min > minutosSessao * 1.08)
      falhasDuras.push(`${nome}: ~${min} min estimados > ${minutosSessao} min disponíveis.`);

  // ===== critérios pontuados =============================================

  const todosEx = dias.flatMap((d) => d.exercicios);

  // --- 1. cobertura de padrões (15) — só conta os padrões possíveis ---
  {
    const presentes = new Set<Padrao>();
    for (const e of todosEx) presentes.add(e.exercicio.padrao);
    const essAlvo = via.padroesEssenciaisPossiveis;
    const essOK = essAlvo.filter((p) => presentes.has(p));
    const desAlvo = PADROES_DESEJAVEIS.filter((p) => via.poolPadrao(p) > 0);
    const desOK = desAlvo.filter((p) => presentes.has(p));
    const fracao = clamp01(
      0.8 * (essAlvo.length ? essOK.length / essAlvo.length : 1) +
        0.2 * (desAlvo.length ? desOK.length / desAlvo.length : 1),
    );
    const faltam = essAlvo.filter((p) => !presentes.has(p));
    const inviaveis = PADROES_ESSENCIAIS.filter((p) => via.poolPadrao(p) === 0);
    criterios.push({
      nome: "cobertura_padroes",
      peso: PESOS.cobertura_padroes,
      fracao,
      pontos: r1(fracao * PESOS.cobertura_padroes),
      notas: [
        faltam.length ? `padrões essenciais em falta: ${faltam.join(", ")}` : "todos os padrões essenciais possíveis cobertos",
        ...(inviaveis.length ? [`inviáveis com as lesões/equipamento: ${inviaveis.join(", ")}`] : []),
      ],
    });
  }

  // --- 2. qualidade da seleção (20): tier apropriado + progressão possível ---
  {
    let ancoraOK = 0;
    let ancoraTotal = 0;
    let slotsComposto = 0;
    let slotsCompostoTotal = 0;
    for (const d of dias) {
      for (const m of gruposGrandesDoDia(d)) {
        // só se espera âncora composta se ela é sequer viável
        if (via.poolMusculoPesado(m) === 0) continue;
        ancoraTotal++;
        if (d.exercicios.some((e) => e.exercicio.tier <= 2 && e.exercicio.primarios.some((p) => p.musculo === m)))
          ancoraOK++;
      }
      d.exercicios.slice(0, 2).forEach((e) => {
        slotsCompostoTotal++;
        if (e.exercicio.tier <= 2) slotsComposto++;
      });
    }
    const progBaixa = todosEx.filter((e) => e.exercicio.progressao === "baixa" && e.exercicio.tier <= 2).length;
    const fracao = clamp01(
      0.55 * (ancoraTotal ? ancoraOK / ancoraTotal : 1) +
        0.3 * (slotsCompostoTotal ? slotsComposto / slotsCompostoTotal : 1) +
        0.15 * (1 - Math.min(1, progBaixa / Math.max(1, todosEx.length / 4))),
    );
    criterios.push({
      nome: "qualidade_selecao",
      peso: PESOS.qualidade_selecao,
      fracao,
      pontos: r1(fracao * PESOS.qualidade_selecao),
      notas: [
        `âncora composta para ${ancoraOK}/${ancoraTotal} estímulos de grupo grande viáveis`,
        `${slotsComposto}/${slotsCompostoTotal} primeiros slots são compostos`,
      ],
    });
  }

  // --- 3. complementaridade (15): somam ou repetem-se? ---
  {
    const contaPadrao = new Map<Padrao, number>();
    const contaFamilia = new Map<string, number>();
    for (const e of todosEx) {
      contaPadrao.set(e.exercicio.padrao, (contaPadrao.get(e.exercicio.padrao) ?? 0) + 1);
      contaFamilia.set(e.exercicio.familia, (contaFamilia.get(e.exercicio.familia) ?? 0) + 1);
    }
    // tolera mais repetição quanto mais dias tem o plano
    const limRep = 3 + dias.length;
    const padroesExcesso = [...contaPadrao.values()].filter((n) => n > limRep).length;
    const familiasExcesso = [...contaFamilia.values()].filter((n) => n > limRep).length;

    const perfilPorMusc = new Map<Musculo, Set<string>>();
    for (const e of todosEx) {
      const pm = e.exercicio.primarios[0].musculo;
      const set = perfilPorMusc.get(pm) ?? new Set<string>();
      set.add(e.exercicio.perfilResistencia);
      perfilPorMusc.set(pm, set);
    }
    // músculos de volume primário alto para quem ≥2 perfis é exigível E possível
    const altoVolume = rel.porMusculo
      .filter((v) => v.primario >= 10)
      .map((v) => v.musculo)
      .filter((m) => {
        const perfis = new Set(
          EXERCICIOS.filter((e) => via.ex(e) && e.primarios[0]?.musculo === m).map((e) => e.perfilResistencia),
        );
        return perfis.size >= 2;
      });
    const comDoisPerfis = altoVolume.filter((m) => (perfilPorMusc.get(m)?.size ?? 0) >= 2).length;
    const fracPerfis = altoVolume.length ? comDoisPerfis / altoVolume.length : 1;

    const fracao = clamp01(1 - 0.2 * padroesExcesso - 0.2 * familiasExcesso - 0.35 * (1 - fracPerfis));
    criterios.push({
      nome: "complementaridade",
      peso: PESOS.complementaridade,
      fracao,
      pontos: r1(fracao * PESOS.complementaridade),
      notas: [
        `${comDoisPerfis}/${altoVolume.length} músculos de volume alto com ≥2 perfis de resistência`,
        ...(padroesExcesso ? [`${padroesExcesso} padrão(ões) coberto(s) >4×`] : []),
        ...(familiasExcesso ? [`${familiasExcesso} família(s) repetida(s) >4×`] : []),
      ],
    });
  }

  // --- 4. gestão de fadiga (15): ordem + secundários não sabotados ---
  {
    let diasOrdemOK = 0;
    let sabotagem = 0;
    let sabotagemTotal = 0;
    for (const d of dias) {
      const tiers = d.exercicios.map((e) => e.exercicio.tier);
      let ok = true;
      for (let i = 0; i < tiers.length; i++)
        for (let j = i + 1; j < tiers.length; j++) if (tiers[i] === 3 && tiers[j] !== 3) ok = false;
      if (ok) diasOrdemOK++;

      const fadSec = new Map<Musculo, number>();
      for (const e of d.exercicios) {
        for (const p of e.exercicio.primarios) {
          sabotagemTotal++;
          if ((fadSec.get(p.musculo) ?? 0) >= 7) sabotagem++;
        }
        for (const sN of e.exercicio.secundarios)
          fadSec.set(sN.musculo, (fadSec.get(sN.musculo) ?? 0) + e.exercicio.fadigaLocal);
      }
    }
    const fracao = clamp01(
      0.7 * (diasOrdemOK / dias.length) + 0.3 * (1 - (sabotagemTotal ? sabotagem / sabotagemTotal : 0)),
    );
    criterios.push({
      nome: "gestao_fadiga",
      peso: PESOS.gestao_fadiga,
      fracao,
      pontos: r1(fracao * PESOS.gestao_fadiga),
      notas: [
        `${diasOrdemOK}/${dias.length} dias sem isolamento antes de composto`,
        ...(sabotagem ? [`${sabotagem} primário(s) potencialmente pré-exausto(s)`] : []),
      ],
    });
  }

  // --- 5. distribuição semanal (15): volume no intervalo + ≥48h ---
  {
    // músculos monitorizados: os alvo do objetivo + os que o plano treina como
    // primário de forma significativa (≥6). Exclui os que nem viáveis são.
    const mon = new Set<Musculo>();
    for (const m of alvoObjetivo) if (via.poolMusculoPrim(m) >= 3) mon.add(m);
    for (const v of rel.porMusculo) if (v.primario >= 6) mon.add(v.musculo);
    const lista = [...mon];
    // crédito parcial: um músculo treinado mas abaixo do intervalo ideal (≥8
    // séries) não é o mesmo que um músculo negligenciado.
    const creditos: number[] = lista.map((m) => {
      const v = vm(m);
      if (!v) return 0;
      if (v.estado === "dentro" || v.estado === "acima_alvo") return 1;
      if (v.estado === "acima_teto") return 0.3;
      return v.direto >= 8 ? 0.6 : 0; // "abaixo"
    });
    const noIntervalo = lista.filter((m) => {
      const v = vm(m);
      return v && (v.estado === "dentro" || v.estado === "acima_alvo");
    }).length;
    const fracVolume = lista.length ? creditos.reduce((a, b) => a + b, 0) / lista.length : 1;

    let paresConsecutivos = 0;
    for (let i = 1; i < dias.length; i++) {
      if (dias[i - 1].tipo === "full" || dias[i].tipo === "full") continue;
      const a = new Set(dias[i - 1].musculosAlvo.filter((m) => MUSCULOS_GRANDES.includes(m)));
      if (dias[i].musculosAlvo.some((m) => MUSCULOS_GRANDES.includes(m) && a.has(m))) paresConsecutivos++;
    }
    const fracEspaco = dias.length > 1 ? 1 - paresConsecutivos / (dias.length - 1) : 1;

    const fracao = clamp01(0.75 * fracVolume + 0.25 * fracEspaco);
    criterios.push({
      nome: "distribuicao_semanal",
      peso: PESOS.distribuicao_semanal,
      fracao,
      pontos: r1(fracao * PESOS.distribuicao_semanal),
      notas: [
        `${noIntervalo}/${lista.length} músculos monitorizados dentro do intervalo`,
        `${paresConsecutivos} par(es) de dias consecutivos com o mesmo grupo grande`,
      ],
    });
  }

  // --- 6. adequação ao objetivo (10) ---
  {
    const tiposValidos = ["upper", "lower", "push", "pull", "legs", "full"];
    const splitOK = dias.every((d) => tiposValidos.includes(d.tipo));
    const freq = new Map<Musculo, number>();
    for (const d of dias) for (const m of gruposGrandesDoDia(d)) freq.set(m, (freq.get(m) ?? 0) + 1);
    const grandesTreinados = [...freq.keys()];
    const com2x = grandesTreinados.filter((m) => (freq.get(m) ?? 0) >= 2).length;
    const fracFreq = grandesTreinados.length ? com2x / grandesTreinados.length : 1;
    const fracao = clamp01((splitOK ? 0.4 : 0) + 0.6 * fracFreq);
    if (perfil.objetivo !== "hipertrofia")
      avisos.push(`objetivo '${perfil.objetivo}': plano gerado com lógica de hipertrofia (passo 6).`);
    criterios.push({
      nome: "adequacao_objetivo",
      peso: PESOS.adequacao_objetivo,
      fracao,
      pontos: r1(fracao * PESOS.adequacao_objetivo),
      notas: [`${com2x}/${grandesTreinados.length} grupos grandes treinados ≥2×/semana`],
    });
  }

  // --- 7. progressão (5) ---
  {
    // "permite medir evolução?": carga em máquina/cabo (media) é perfeitamente
    // mensurável; peso corporal/banda (baixa) mede-se por reps. Nenhuma é 0.
    let progPts = 0;
    let ancoraAlta = 0;
    let ancoraTotal = 0;
    for (const d of dias)
      d.exercicios.forEach((e, i) => {
        progPts += e.exercicio.progressao === "alta" ? 1 : e.exercicio.progressao === "media" ? 0.7 : 0.3;
        if (i < 2 && e.exercicio.tier <= 2) {
          ancoraTotal++;
          if (e.exercicio.progressao !== "baixa") ancoraAlta++;
        }
      });
    const total = todosEx.length || 1;
    // piso: mesmo um plano forçado a isolamento por lesão/equipamento permite
    // medir evolução (carga em máquina, reps a peso corporal).
    const fracao = clamp01(0.3 + 0.3 * (ancoraTotal ? ancoraAlta / ancoraTotal : 1) + 0.4 * (progPts / total));
    criterios.push({
      nome: "progressao",
      peso: PESOS.progressao,
      fracao,
      pontos: r1(fracao * PESOS.progressao),
      notas: [`${ancoraAlta}/${ancoraTotal} âncoras com progressão mensurável`],
    });
  }

  // --- 8. eficiência / tempo (5) ---
  {
    const excessos = minutosDia.map(({ min }) => Math.max(0, min - minutosSessao) / minutosSessao);
    const fracao = clamp01(1 - 1.5 * excessos.reduce((a, b) => a + b, 0));
    criterios.push({
      nome: "eficiencia_tempo",
      peso: PESOS.eficiencia_tempo,
      fracao,
      pontos: r1(fracao * PESOS.eficiencia_tempo),
      notas: [`dias: ${minutosDia.map((x) => `${x.nome} ~${x.min}min`).join(" · ")} (disponível ${minutosSessao})`],
    });
  }

  // ===== soma e veredicto ================================================
  let pontuacao = r1(criterios.reduce((a, c) => a + c.pontos, 0));
  if (falhasDuras.length) pontuacao = Math.min(pontuacao, 60);

  const aprovado = falhasDuras.length === 0 && pontuacao >= 85;
  const rejeitado = falhasDuras.length > 0 || pontuacao < 75;
  const precisaRever = !aprovado && !rejeitado;

  return { pontuacao, aprovado, precisaRever, rejeitado, criterios, falhasDuras, avisos };
}

// ---------------------------------------------------------------------------

export type PlanoValidado = {
  semana: SemanaSelecionada;
  validacao: ResultadoValidacao;
  tentativas: number;
};

/**
 * Gera um plano e valida-o. Se não passar (§3.3 passo 5), regenera com uma
 * variação da seleção, até `maxTentativas`. Devolve o melhor que encontrou.
 */
export function gerarPlanoValidado(perfil: PerfilSelecao, maxTentativas = 3): PlanoValidado {
  let melhor: PlanoValidado | null = null;
  for (let t = 0; t < Math.max(1, maxTentativas); t++) {
    const semana = selecionarSemana(perfil, t);
    const validacao = validarSemana(semana);
    const cand: PlanoValidado = { semana, validacao, tentativas: t + 1 };
    if (!melhor || validacao.pontuacao > melhor.validacao.pontuacao) melhor = cand;
    if (validacao.aprovado) return cand;
  }
  return melhor as PlanoValidado;
}
