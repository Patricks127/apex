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
  FAMILIAS_EMPURRAR,
  FAMILIAS_PUXAR,
  MUSCULOS_GRANDES,
  ordemNivel,
  type Equipamento,
  type Exercicio,
  type Familia,
  type Musculo,
  type Padrao,
} from "./tipos.ts";
import { calcularVolume } from "./volume.ts";
import {
  FAMILIAS_RESISTENCIA,
  selecionarSemana,
  semanaParaEntradaVolume,
  type DiaSelecionado,
  type PerfilSelecao,
  type SemanaSelecionada,
} from "./seletor.ts";
import { CARDIO_DURO, CATEGORIA, EQUIP_CALISTENIA as EQUIP_CALIS_V, POLARIZADO } from "./objetivos.ts";

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
  poolMusculoFamilias: (m: Musculo) => number; // famílias DISTINTAS viáveis (o que conta — só 1 exercício/família cabe num dia)
  poolMusculoPesado: (m: Musculo) => number; // Tier ≤ 2 primários viáveis
  poolPadrao: (p: Padrao) => number;
  padroesEssenciaisPossiveis: Padrao[];
  poolEmpurrar: number; // exercícios viáveis nas famílias de empurrar (rácio §4.1)
  poolPuxar: number; // idem, puxar
};

/**
 * Casa+Ginásio (parte 3): como acima, mas contra um conjunto de equipamento
 * explícito — não o da semana inteira. Um músculo cujo(s) único(s) dia(s)
 * são em casa não pode ser julgado pelo que só é possível no ginásio, só
 * porque ESSE existe noutro dia da semana. `viabilidade()` (a versão sem
 * `disp`) fica só para os critérios que são mesmo da semana inteira —
 * cobertura de padrões (presente OU NÃO em qualquer dia) e o rácio
 * empurrar:puxar (medido sobre o volume da semana toda).
 */
function viabilidadeComEquipamento(perfil: PerfilSelecao, disp: Set<Equipamento>): Viabilidade {
  const ok = (e: Exercicio) =>
    ordemNivel[e.nivelMinimo] <= ordemNivel[perfil.nivel] &&
    !e.contraindicacoes.some((z) => perfil.lesoes.includes(z)) &&
    e.equipamento.some((q) => disp.has(q));
  const viaveis = EXERCICIOS.filter(ok);
  const poolMusculoPrim = (m: Musculo) => viaveis.filter((e) => e.primarios.some((p) => p.musculo === m)).length;
  // só as famílias que o seletor de hipertrofia realmente usa (resistência
  // pura) — senão contava conditioning/cardio/skill/carry, que nunca entram.
  const poolMusculoFamilias = (m: Musculo) =>
    new Set(
      viaveis
        .filter((e) => e.primarios.some((p) => p.musculo === m) && (FAMILIAS_RESISTENCIA as string[]).includes(e.familia))
        .map((e) => e.familia),
    ).size;
  const poolMusculoPesado = (m: Musculo) =>
    viaveis.filter((e) => e.tier <= 2 && e.primarios.some((p) => p.musculo === m)).length;
  const poolPadrao = (p: Padrao) => viaveis.filter((e) => e.padrao === p).length;
  const poolFamilias = (fams: Familia[]) => {
    const set = new Set<string>(fams);
    return viaveis.filter((e) => set.has(e.familia)).length;
  };
  return {
    ex: ok,
    poolMusculoPrim,
    poolMusculoFamilias,
    poolMusculoPesado,
    poolPadrao,
    padroesEssenciaisPossiveis: PADROES_ESSENCIAIS.filter((p) => poolPadrao(p) > 0),
    poolEmpurrar: poolFamilias(FAMILIAS_EMPURRAR),
    poolPuxar: poolFamilias(FAMILIAS_PUXAR),
  };
}

function viabilidade(perfil: PerfilSelecao): Viabilidade {
  return viabilidadeComEquipamento(perfil, new Set(perfil.equipamento));
}

/** União do equipamento dos dias que treinam `m` como alvo — o que está
 *  realmente ao alcance desse músculo, não da semana inteira. */
function equipamentoDoMusculo(dias: DiaSelecionado[], m: Musculo): Set<Equipamento> {
  const doMusculo = dias.filter((d) => d.musculosAlvo.includes(m));
  const eq = new Set<Equipamento>();
  for (const d of doMusculo) for (const q of d.equipamento) eq.add(q);
  // salvaguarda: se por algum motivo nenhum dia declara `m` como alvo (não
  // devia acontecer), cai para a semana inteira em vez de ficar vazio.
  if (eq.size) return eq;
  for (const d of dias) for (const q of d.equipamento) eq.add(q);
  return eq;
}

// Músculos "alvo do objetivo" para a §4.1 (mínimo de 8 séries): grupos grandes
// + foco. (Os outros objetivos entram no passo 6.)
function musculosAlvoObjetivo(perfil: PerfilSelecao): Musculo[] {
  return [...new Set<Musculo>([...MUSCULOS_GRANDES, ...(perfil.foco ?? [])])];
}

// ---------------------------------------------------------------------------

export function validarSemana(semana: SemanaSelecionada): ResultadoValidacao {
  const perfil = semana.perfil;
  if (CATEGORIA[perfil.objetivo] === "endurance") return validarEndurance(semana);
  if (perfil.objetivo !== "hipertrofia") return validarNaoHipertrofia(semana);

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
    // Casa+Ginásio (parte 3): o que conta é o equipamento dos dias que TREINAM
    // este músculo — não o da semana inteira. Um músculo cujo único dia é em
    // casa não pode ser julgado pelo que só é possível no ginásio.
    const viaM = viabilidadeComEquipamento(perfil, equipamentoDoMusculo(dias, m));
    const pool = viaM.poolMusculoPrim(m);
    // no split muscular o músculo só tem UM dia — só cabe 1 exercício por
    // família nesse dia, por isso o que importa é quantas famílias distintas
    // (não quantos exercícios) as lesões/equipamento deixam viáveis.
    // Também pode ser o TEMPO a limitar (dia com vários músculos-alvo e pouco
    // minutosSessao) — o seletor já avisa nesse dia, tratando-se da mesma
    // troca consciente "tempo manda" e não de um plano mal construído.
    const diaDoMusculo = dias.find((d) => d.musculosAlvo.includes(m));
    const limitadoPorTempo =
      perfil.splitFormato === "muscular" &&
      !!diaDoMusculo &&
      avisos.some((a) => a.startsWith(diaDoMusculo.nome) && /não cabem|cortar abaixo do ideal/.test(a));
    const limitado =
      (perfil.splitFormato === "muscular" ? viaM.poolMusculoFamilias(m) * 4 < 8 : pool < 3) || limitadoPorTempo;
    if (limitado)
      avisos.push(
        `${m}: ${v.direto} séries/semana (abaixo de 8) — as lesões/equipamento limitam o que cabe num só dia.`,
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

  // 3. duas famílias iguais no mesmo dia.
  //    Circuitos repetem por desenho. No formato muscular repetir família é
  //    permitido se os perfis de resistência diferirem (§2.4, hipertrofia
  //    regional) — veta-se mesma família E mesmo perfil (peck deck +
  //    aberturas na máquina), 3+ da mesma família, ou 4+ compostos (T1/T2)
  //    do mesmo padrão (supino barra + inclinado + halteres + floor press).
  //    Nos outros formatos a regra continua estrita.
  for (const d of dias) {
    if (d.tipo === "circuito") continue;
    const porFamilia: Record<string, typeof d.exercicios> = {};
    for (const e of d.exercicios) (porFamilia[e.exercicio.familia] ??= []).push(e);
    for (const fam of Object.keys(porFamilia)) {
      const exs = porFamilia[fam];
      if (exs.length < 2) continue;
      if (perfil.splitFormato === "muscular") {
        const perfisDistintos = new Set(exs.map((e) => e.exercicio.perfilResistencia)).size === exs.length;
        if (exs.length > 2 || !perfisDistintos)
          falhasDuras.push(
            `${d.nome}: família repetida no mesmo dia (${fam}) — máx. 2 por família, com perfis de resistência distintos.`,
          );
      } else {
        falhasDuras.push(`${d.nome}: família repetida no mesmo dia (${fam}).`);
      }
    }
    if (perfil.splitFormato === "muscular") {
      const porPadraoComposto: Record<string, number> = {};
      for (const e of d.exercicios)
        if (e.exercicio.tier <= 2) porPadraoComposto[e.exercicio.padrao] = (porPadraoComposto[e.exercicio.padrao] ?? 0) + 1;
      for (const [pad, n] of Object.entries(porPadraoComposto))
        if (n > 3) falhasDuras.push(`${d.nome}: ${n} compostos do padrão "${pad}" no mesmo dia — máx. 3.`);
    }
  }

  // 4. três ou mais compostos pesados (fadigaSistemica 3) consecutivos
  //    (não se aplica a circuitos/cardio — a intensidade encadeada é o objetivo)
  for (const d of dias) {
    if (d.tipo === "circuito" || (CARDIO_DURO as string[]).includes(d.tipo)) continue;
    const seq = d.exercicios.map((e) => e.exercicio.fadigaSistemica);
    for (let i = 0; i + 2 < seq.length; i++)
      if (seq[i] === 3 && seq[i + 1] === 3 && seq[i + 2] === 3)
        falhasDuras.push(`${d.nome}: 3 compostos pesados consecutivos (posição ${i + 1}).`);
  }

  // 5. mesmo grupo grande PLANEADO em dias consecutivos.
  //    Compara os alvos do dia (o que o split pretende treinar), não músculos
  //    que aparecem de raspão como primário secundário de um composto. Não se
  //    aplica a full-body (dias de treino com descanso entre si por definição).
  //    Powerlifting roda os 3 levantamentos por desenho (a fadiga gere-se pela
  //    intensidade: dia pesado vs dia de volume) — aviso, não falha.
  for (let i = 1; i < dias.length; i++) {
    if (dias[i - 1].tipo === "full" || dias[i].tipo === "full") continue;
    const a = new Set(dias[i - 1].musculosAlvo.filter((m) => MUSCULOS_GRANDES.includes(m)));
    const comum = dias[i].musculosAlvo.filter((m) => MUSCULOS_GRANDES.includes(m) && a.has(m));
    if (!comum.length) continue;
    const msg = `${dias[i - 1].nome} → ${dias[i].nome}: ${comum.join(", ")} em dias consecutivos (<48h).`;
    falhasDuras.push(msg);
  }

  // 6. rácio empurrar:puxar fora de 1:1 ± 30%.
  //    Lesão do membro superior limita legitimamente o lado de empurrar → aviso.
  if (!rel.racioEmpurrarPuxar.equilibrado) {
    const r = rel.racioEmpurrarPuxar.racio;
    const lesoesMS = perfil.lesoes.filter((z) => (LESOES_MEMBRO_SUPERIOR as readonly string[]).includes(z));
    const lesaoMS = lesoesMS.length > 0;
    // num full-body cada sessão repete todos os padrões, e num split por grupo
    // muscular há um "dia de costas" e um "dia de peito" — o rácio por famílias
    // é mais ruidoso nos dois; tolera-se uma janela mais larga antes de falhar.
    const ruidoso = temFull || perfil.splitFormato === "muscular";
    const foraDeVez = ruidoso ? r > 1.7 || r < 0.48 : true;
    // o desequilíbrio é ESTRUTURAL (lesão/equipamento, não má seleção) quando
    // o pool viável do lado fraco é escasso em absoluto ou muito menor que o
    // do lado forte — aí regenerar não resolve nada, passa com aviso acionável.
    const faltaPuxar = r > 1.3 || !Number.isFinite(r);
    const poolFraco = faltaPuxar ? via.poolPuxar : via.poolEmpurrar;
    const poolForte = faltaPuxar ? via.poolEmpurrar : via.poolPuxar;
    const limitadoEstrutural = poolFraco < 6 || poolFraco < poolForte * 0.55;
    if (lesaoMS && (r < 0.7 || !Number.isFinite(r))) {
      avisos.push(`Rácio empurrar:puxar = ${r}:1 — desequilíbrio esperado com lesão do membro superior.`);
    } else if (foraDeVez && limitadoEstrutural) {
      const ladoFraco = faltaPuxar ? "puxar" : "empurrar";
      const maisQue = faltaPuxar ? "mais empurrar que puxar" : "mais puxar que empurrar";
      const causa = lesaoMS
        ? `A tua lesão (${lesoesMS.join(", ")}) e o equipamento disponível limitam`
        : "O equipamento disponível limita";
      const quando = lesaoMS
        ? `Se tiveres acesso a cabos ou máquinas, ou quando ${lesoesMS.length === 1 ? `o ${lesoesMS[0]}` : "a lesão"} permitir,`
        : "Se tiveres acesso a cabos ou máquinas,";
      avisos.push(
        `${causa} muito o trabalho de ${ladoFraco}, o que deixa o plano desequilibrado (${maisQue}). ${quando} o plano reequilibra-se.`,
      );
    } else if (foraDeVez) {
      falhasDuras.push(`Rácio empurrar:puxar = ${r}:1 — fora de 1:1 ± 30%.`);
    } else {
      avisos.push(`Rácio empurrar:puxar = ${r}:1 — ligeiramente fora de 1:1 ± 30% (full-body).`);
    }
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
      // Casa+Ginásio (parte 3): a âncora só é exigível se o EQUIPAMENTO DESTE
      // DIA a permite — não o da semana inteira (um dia de casa não é julgado
      // pelo agachamento com barra que só existe no dia de ginásio).
      const viaDia = viabilidadeComEquipamento(perfil, new Set(d.equipamento));
      for (const m of gruposGrandesDoDia(d)) {
        // só se espera âncora composta se ela é sequer viável NESTE dia
        if (viaDia.poolMusculoPesado(m) === 0) continue;
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
    // no split por grupo (1×/semana) o mesmo volume cabe numa só sessão, pelo
    // que "abaixo do intervalo ideal" mas acima de 8 é o esperado — mais crédito.
    const creditoAbaixo = perfil.splitFormato === "muscular" ? 0.85 : 0.6;
    const creditos: number[] = lista.map((m) => {
      const v = vm(m);
      if (!v) return 0;
      if (v.estado === "dentro" || v.estado === "acima_alvo") return 1;
      if (v.estado === "acima_teto") return 0.3;
      return v.direto >= 8 ? creditoAbaixo : v.direto >= 6 ? 0.4 : 0; // "abaixo"
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
  //   O critério de frequência (≥2×) só se aplica ao formato "frequencia".
  //   No "muscular" a escolha informada é 1×/semana — avalia-se a coerência do
  //   split por grupo (dias reconhecíveis, sem grupo grande em dias seguidos).
  {
    const muscular = perfil.splitFormato === "muscular";
    const tiposFreq = ["upper", "lower", "push", "pull", "legs", "full"];
    const tiposMusc = [
      "peito_triceps", "costas_biceps", "pernas_ombros", "pernas", "ombros_bracos",
      "peito_dia", "costas_dia", "ombros_dia", "bracos_dia", "pontos_fracos",
    ];
    let fracao: number;
    let nota: string;
    if (muscular) {
      const splitOK = dias.every((d) => tiposMusc.includes(d.tipo));
      // grupos grandes nunca em dias consecutivos
      let consecutivo = false;
      for (let i = 1; i < dias.length; i++) {
        const a = gruposGrandesDoDia(dias[i - 1]);
        if ([...gruposGrandesDoDia(dias[i])].some((m) => a.has(m))) consecutivo = true;
      }
      fracao = clamp01((splitOK ? 0.7 : 0.2) + (consecutivo ? 0 : 0.3));
      nota = `split por grupo muscular (1×/semana — escolha informada)${consecutivo ? ", mas há grupo grande em dias seguidos" : ""}`;
      avisos.push(
        "Formato por grupo muscular: cada músculo treina 1×/semana. É válido e é o formato clássico de ginásio; a alternativa (Superior/Inferior) reparte o mesmo volume em 2 sessões, o que costuma dar séries de melhor qualidade.",
      );
    } else {
      const splitOK = dias.every((d) => tiposFreq.includes(d.tipo));
      const freq = new Map<Musculo, number>();
      for (const d of dias) for (const m of gruposGrandesDoDia(d)) freq.set(m, (freq.get(m) ?? 0) + 1);
      const grandes = [...freq.keys()];
      const com2x = grandes.filter((m) => (freq.get(m) ?? 0) >= 2).length;
      fracao = clamp01((splitOK ? 0.4 : 0) + 0.6 * (grandes.length ? com2x / grandes.length : 1));
      nota = `${com2x}/${grandes.length} grupos grandes treinados ≥2×/semana`;
    }
    criterios.push({
      nome: "adequacao_objetivo",
      peso: PESOS.adequacao_objetivo,
      fracao,
      pontos: r1(fracao * PESOS.adequacao_objetivo),
      notas: [nota],
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

// ===========================================================================
// PASSO 6 — validação dos objetivos de endurance (corrida)
// ===========================================================================

const clamp01e = (n: number) => Math.max(0, Math.min(1, n));
const r1e = (n: number) => Math.round(n * 10) / 10;

/** Minutos estimados de uma sessão de cardio pelo tipo/nome do dia. */
function minutosCardio(d: DiaSelecionado): number {
  if (d.tipo === "cardio_qualidade") return 42; // aquecimento + blocos + volta à calma
  if (/long/i.test(d.nome)) return 80;
  return 52; // corrida fácil Z2
}

export function validarEndurance(semana: SemanaSelecionada): ResultadoValidacao {
  const perfil = semana.perfil;
  const dias = semana.dias;
  const iniciante = perfil.nivel === "iniciante";
  const criterios: Criterio[] = [];
  const avisos: string[] = [...semana.avisos];
  const falhasDuras: string[] = [];

  const z2 = dias.filter((d) => d.tipo === "cardio_z2");
  const qualidade = dias.filter((d) => d.tipo === "cardio_qualidade");
  const forca = dias.filter((d) => d.tipo === "forca" || d.tipo === "forca_principal");
  const nCardio = z2.length + qualidade.length;

  // ---- §4.1-equivalente: verificações duras ----
  if (nCardio < 3) falhasDuras.push(`Só ${nCardio} sessões de corrida/semana — insuficiente para progredir.`);
  for (let i = 1; i < dias.length; i++)
    if (dias[i - 1].tipo === "cardio_qualidade" && dias[i].tipo === "cardio_qualidade")
      falhasDuras.push(`${dias[i - 1].nome} → ${dias[i].nome}: duas sessões de qualidade em dias seguidos.`);
  if (qualidade.length > 3) falhasDuras.push(`${qualidade.length} sessões de qualidade — excesso de alta intensidade.`);
  for (let i = 1; i < dias.length; i++) {
    const a = dias[i - 1].tipo;
    const b = dias[i].tipo;
    if ((a === "forca" || a === "forca_principal") && b === "cardio_qualidade")
      avisos.push(`${dias[i - 1].nome} → ${dias[i].nome}: força na véspera de uma sessão de qualidade (§2.5).`);
  }
  for (const d of dias) if (d.exercicios.length === 0) falhasDuras.push(`${d.nome}: dia sem conteúdo.`);

  // ---- distribuição polarizada (30) ----
  {
    const minZ2 = z2.reduce((a, d) => a + minutosCardio(d), 0);
    const minQ = qualidade.reduce((a, d) => a + minutosCardio(d), 0);
    const totalCardio = minZ2 + minQ || 1;
    const fracZ12 = minZ2 / totalCardio;
    const alvo = iniciante ? 0.65 : POLARIZADO.z12min; // principiante: piramidal aceita-se
    const fracao = clamp01e(fracZ12 >= alvo ? 1 : fracZ12 / alvo);
    criterios.push({
      nome: "distribuicao_semanal",
      peso: 30,
      fracao,
      pontos: r1e(fracao * 30),
      notas: [`${Math.round(fracZ12 * 100)}% do volume em Z1–2 (alvo ≥ ${Math.round(alvo * 100)}%)`],
    });
  }

  // ---- volume e consistência (20) ----
  {
    const temLongo = z2.some((d) => /long/i.test(d.nome)) || z2.length >= 2;
    const distintos = new Set(dias.map((d) => d.nome)).size >= Math.min(dias.length, 3);
    const fracao = clamp01e((nCardio >= 3 ? 0.6 : nCardio / 5) + (temLongo ? 0.25 : 0) + (distintos ? 0.15 : 0));
    criterios.push({
      nome: "qualidade_selecao",
      peso: 20,
      fracao,
      pontos: r1e(fracao * 20),
      notas: [`${nCardio} sessões de corrida${temLongo ? ", com corrida longa" : ""}`],
    });
  }

  // ---- qualidade doseada + espaçamento (15) ----
  {
    const nQ = qualidade.length;
    const okDose = nQ >= 1 && nQ <= 2;
    let espacamento = 1;
    const idxQ = dias.map((d, i) => (d.tipo === "cardio_qualidade" ? i : -1)).filter((i) => i >= 0);
    for (let k = 1; k < idxQ.length; k++) if (idxQ[k] - idxQ[k - 1] < 2) espacamento = 0;
    const fracao = clamp01e((okDose ? 0.6 : nQ === 0 ? 0.2 : 0.35) + 0.4 * espacamento);
    criterios.push({
      nome: "gestao_fadiga",
      peso: 15,
      fracao,
      pontos: r1e(fracao * 15),
      notas: [`${nQ} sessão(ões) de qualidade`],
    });
  }

  // ---- força de manutenção controlada (10) ----
  {
    const okVolume = forca.length <= 2;
    let semColisao = true;
    for (let i = 1; i < dias.length; i++) {
      const a = dias[i - 1].tipo;
      const b = dias[i].tipo;
      if (((a === "forca" || a === "forca_principal") && b === "cardio_qualidade") ||
          (a === "cardio_qualidade" && (b === "forca" || b === "forca_principal")))
        semColisao = false;
    }
    const fracao = clamp01e((okVolume ? 0.6 : 0.2) + (semColisao ? 0.4 : 0));
    criterios.push({
      nome: "adequacao_objetivo",
      peso: 10,
      fracao,
      pontos: r1e(fracao * 10),
      notas: [`${forca.length} sessão(ões) de força de manutenção`],
    });
  }

  // ---- cobertura de padrões de corrida (10) ----
  {
    const temFacil = z2.length >= (dias.length >= 5 ? 2 : 1);
    const temQualidade = qualidade.length >= 1;
    const fracao = clamp01e((temFacil ? 0.6 : 0) + (temQualidade ? 0.4 : 0));
    criterios.push({
      nome: "cobertura_padroes",
      peso: 10,
      fracao,
      pontos: r1e(fracao * 10),
      notas: [temFacil && temQualidade ? "corrida fácil + qualidade presentes" : "estrutura incompleta"],
    });
  }

  // ---- estrutura (10) ----
  {
    const nEsperado = Math.min(6, Math.max(3, Math.round(perfil.dias || 4)));
    const fracao = clamp01e((dias.length === nEsperado ? 0.7 : 0.4) + (dias.every((d) => d.exercicios.length > 0) ? 0.3 : 0));
    criterios.push({
      nome: "progressao",
      peso: 10,
      fracao,
      pontos: r1e(fracao * 10),
      notas: [`${dias.length} dias`],
    });
  }

  // eficiência/tempo — as sessões de corrida gerem-se pelo relógio
  criterios.push({ nome: "eficiencia_tempo", peso: 5, fracao: 1, pontos: 5, notas: ["sessões geridas pelo tempo/distância"] });

  let pontuacao = r1e(criterios.reduce((a, c) => a + c.pontos, 0));
  if (falhasDuras.length) pontuacao = Math.min(pontuacao, 60);
  const aprovado = falhasDuras.length === 0 && pontuacao >= 85;
  const rejeitado = falhasDuras.length > 0 || pontuacao < 75;
  return { pontuacao, aprovado, precisaRever: !aprovado && !rejeitado, rejeitado, criterios, falhasDuras, avisos };
}

// ===========================================================================
// PASSO 6 — validação de powerlifting / calistenia / híbrido / hyrox
// ===========================================================================

function validarNaoHipertrofia(semana: SemanaSelecionada): ResultadoValidacao {
  const perfil = semana.perfil;
  const dias = semana.dias;
  const obj = perfil.objetivo;
  const minutosSessao = Math.max(30, Math.round(perfil.minutosSessao ?? 75));
  const rel = calcularVolume(semanaParaEntradaVolume(semana), perfil.nivel);
  const vm = (m: Musculo) => rel.porMusculo.find((x) => x.musculo === m);
  // em calistenia o que é "viável" é só o que se faz com o peso do corpo
  const via = viabilidade(
    obj === "calistenia"
      ? { ...perfil, equipamento: perfil.equipamento.filter((q) => (EQUIP_CALIS_V as string[]).includes(q)) }
      : perfil,
  );
  const misto = CATEGORIA[obj] === "misto";

  const criterios: Criterio[] = [];
  const avisos: string[] = [...semana.avisos];
  const falhasDuras: string[] = [];

  const forcaDias = dias.filter((d) => d.tipo === "forca" || d.tipo === "forca_principal" || d.tipo === "skill");
  const cardioDias = dias.filter((d) => (CARDIO_DURO as string[]).includes(d.tipo) || d.tipo === "cardio_z2");
  const duroTipo = (t: string) => (CARDIO_DURO as string[]).includes(t);

  // ===== verificações duras =====
  const vazios = dias.filter((d) => d.exercicios.length === 0);
  const tolEmpty = obj === "calistenia" || obj === "powerlifting" ? 2 : 1; // lesão limita mais estes
  if (vazios.length && vazios.length <= tolEmpty)
    avisos.push(`${vazios.map((d) => d.nome).join(", ")}: sem exercícios viáveis com as lesões/equipamento — usa para descanso/mobilidade.`);
  else if (vazios.length > tolEmpty)
    falhasDuras.push(`${vazios.length} dias sem conteúdo — não há como montar o plano com estas lesões/equipamento.`);
  for (const d of dias) {
    if (d.exercicios.length === 0) continue;
    if (d.tipo === "circuito" || d.tipo === "skill") continue; // repetem por desenho
    const fam = d.exercicios.map((e) => e.exercicio.familia);
    const dup = fam.find((f, i) => fam.indexOf(f) !== i && f !== "skill");
    if (dup) falhasDuras.push(`${d.nome}: família repetida no mesmo dia (${dup}).`);
    if (!duroTipo(d.tipo)) {
      const seq = d.exercicios.map((e) => e.exercicio.fadigaSistemica);
      for (let i = 0; i + 2 < seq.length; i++)
        if (seq[i] === 3 && seq[i + 1] === 3 && seq[i + 2] === 3)
          falhasDuras.push(`${d.nome}: 3 compostos pesados consecutivos.`);
    }
  }
  // acima do teto — só falha se for EXTREMO (planos estruturais, não otimizados)
  for (const v of rel.porMusculo) {
    if (v.estado !== "acima_teto") continue;
    if (v.primario > v.teto * 1.6)
      falhasDuras.push(`${v.musculo}: ${v.direto} séries/semana (primário ${v.primario}) — muito acima do teto (${v.teto}).`);
    else avisos.push(`${v.musculo} ${v.direto} > teto ${v.teto} — aceitável neste objetivo.`);
  }
  // tempo
  for (const d of dias) {
    const min = estimarMinutosDia(d);
    if (!duroTipo(d.tipo) && d.tipo !== "cardio_z2" && min > minutosSessao * 1.1)
      falhasDuras.push(`${d.nome}: ~${min} min > ${minutosSessao} min disponíveis.`);
  }
  // treino concorrente (§2.5)
  for (let i = 1; i < dias.length; i++) {
    if (duroTipo(dias[i - 1].tipo) && (dias[i].tipo === "forca_principal" || /Inferior|Pernas/i.test(dias[i].nome))) {
      if (!avisos.some((a) => /não deixa separar/.test(a)))
        avisos.push(`${dias[i - 1].nome} → ${dias[i].nome}: cardio duro perto de pernas pesado — vê o espaçamento.`);
    }
  }
  // essenciais do objetivo
  if (misto && cardioDias.length === 0) falhasDuras.push("Objetivo com componente de cardio, mas sem nenhuma sessão de cardio.");
  if (misto && forcaDias.length === 0) falhasDuras.push("Objetivo com componente de força, mas sem nenhuma sessão de força.");

  const clamp01n = (n: number) => Math.max(0, Math.min(1, n));
  const r1n = (n: number) => Math.round(n * 10) / 10;

  // ===== 1. estrutura do objetivo (30) =====
  {
    let fracao = 1;
    const notas: string[] = [];
    if (obj === "powerlifting") {
      const principais = new Set(
        dias
          .filter((d) => d.tipo === "forca_principal")
          .map((d) => d.exercicios[0]?.exercicio.familia)
          .filter(Boolean),
      );
      // relativo aos levantamentos que a lesão/equipamento deixam treinar
      // (T1 ideal; sem barra aceita-se um T2 pesado da família)
      const podeAncora = (fam: string) =>
        EXERCICIOS.some((e) => e.familia === fam && e.tier <= 2 && via.ex(e));
      const esperados = (["squat", "hinge", "horizontal_push"] as const).filter(podeAncora);
      const cobre = esperados.filter((f) => principais.has(f)).length;
      if (esperados.length) {
        fracao = cobre / esperados.length;
        notas.push(`${cobre}/${esperados.length} levantamentos principais viáveis presentes`);
      } else {
        fracao = 0.82; // sem barra/carga — força geral com o que há
        avisos.push("Sem barra disponível, o powerlifting fica limitado a trabalho de força geral.");
        notas.push("sem levantamentos com barra viáveis");
      }
    } else if (obj === "calistenia") {
      const tipos = dias.map((d) => d.nome.toLowerCase());
      const ppl = ["empurrar", "puxar", "pernas"].filter((n) => tipos.some((t) => t.includes(n))).length;
      const skillOk = dias.length < 4 || dias.some((d) => d.tipo === "skill");
      const semCarga = forcaDias.every((d) =>
        d.exercicios.every((e) => e.exercicio.familia === "cardio" || e.exercicio.equipamento.some((q) => (["peso_corporal", "barra_fixa", "paralelas", "banda", "trx", "caixa"] as string[]).includes(q))),
      );
      fracao = 0.5 * (ppl / 3) + 0.25 * (skillOk ? 1 : 0) + 0.25 * (semCarga ? 1 : 0);
      notas.push(`PPL ${ppl}/3${skillOk ? " + skill" : ""}${semCarga ? " · só peso corporal" : " · tem carga externa"}`);
    } else {
      // hibrido / hyrox
      const nF = forcaDias.length;
      const nC = cardioDias.length;
      const separados = !dias.some(
        (d) => d.exercicios.some((e) => e.exercicio.familia === "cardio") && d.exercicios.some((e) => e.exercicio.familia !== "cardio") && d.tipo !== "circuito",
      );
      const temCircuito = obj !== "hyrox" || dias.some((d) => d.tipo === "circuito");
      fracao = 0.35 * (nF >= 1 ? 1 : 0) + 0.35 * (nC >= 1 ? 1 : 0) + 0.15 * (separados ? 1 : 0) + 0.15 * (temCircuito ? 1 : 0);
      notas.push(`${nF} força + ${nC} cardio${separados ? ", em dias separados" : ""}`);
    }
    criterios.push({ nome: "adequacao_objetivo", peso: 30, fracao: clamp01n(fracao), pontos: r1n(clamp01n(fracao) * 30), notas });
  }

  // ===== 2. seleção e âncora (20) =====
  {
    let ancoraOK = 0;
    let ancoraTot = 0;
    let ordemOK = 0;
    for (const d of forcaDias) {
      const tiers = d.exercicios.map((e) => e.exercicio.tier);
      let ok = true;
      for (let i = 0; i < tiers.length; i++)
        for (let j = i + 1; j < tiers.length; j++) if (tiers[i] === 3 && tiers[j] !== 3) ok = false;
      if (ok) ordemOK++;
      for (const m of gruposGrandesDoDia(d)) {
        if (via.poolMusculoPesado(m) === 0) continue;
        ancoraTot++;
        if (d.exercicios.some((e) => e.exercicio.tier <= 2 && e.exercicio.primarios.some((p) => p.musculo === m))) ancoraOK++;
      }
    }
    const fr = clamp01n(0.5 * (ancoraTot ? ancoraOK / ancoraTot : 1) + 0.5 * (forcaDias.length ? ordemOK / forcaDias.length : 1));
    criterios.push({ nome: "qualidade_selecao", peso: 20, fracao: fr, pontos: r1n(fr * 20), notas: [`âncora ${ancoraOK}/${ancoraTot}, ordem ${ordemOK}/${forcaDias.length}`] });
  }

  // ===== 3. fadiga e ordem semanal (15) =====
  {
    let pares = 0;
    for (let i = 1; i < dias.length; i++) {
      const a = new Set(dias[i - 1].musculosAlvo.filter((m) => MUSCULOS_GRANDES.includes(m)));
      if (dias[i].musculosAlvo.some((m) => MUSCULOS_GRANDES.includes(m) && a.has(m))) pares++;
    }
    const limite = obj === "powerlifting" ? Math.ceil(dias.length / 2) : 1;
    const fr = clamp01n(1 - Math.max(0, pares - (limite - 1)) * 0.3);
    criterios.push({ nome: "gestao_fadiga", peso: 15, fracao: fr, pontos: r1n(fr * 15), notas: [`${pares} par(es) de dias com o mesmo grupo grande`] });
  }

  // ===== 4. volume suficiente nos motores do objetivo (15) =====
  {
    const alvo = obj === "powerlifting"
      ? (["quadriceps", "gluteo", "isquiotibiais", "peito", "dorsais"] as Musculo[])
      : misto
        ? (["quadriceps", "gluteo", "peito", "dorsais"] as Musculo[])
        : ([...MUSCULOS_GRANDES] as Musculo[]);
    // misto: a força é suplementar e escala com o nº de dias de força
    const nForca = forcaDias.length;
    const piso = misto ? Math.max(2, Math.min(5, nForca * 2)) : 6;
    const scores = alvo
      .filter((m) => via.poolMusculoPrim(m) >= 2)
      .map((m) => {
        const v = vm(m);
        if (!v) return 0.3;
        if (v.direto >= piso) return 1;
        return Math.max(0.3, v.direto / piso);
      });
    const fr = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
    criterios.push({ nome: "distribuicao_semanal", peso: 15, fracao: clamp01n(fr), pontos: r1n(clamp01n(fr) * 15), notas: [`${scores.filter((s) => s >= 1).length}/${scores.length} motores com volume suficiente`] });
  }

  // ===== 5. progressão mensurável (10) =====
  {
    // Em calistenia a progressão é por reps/alavanca (toda mensurável). Nos
    // outros pesa mais o que se pode carregar — âncoras (tier ≤ 2) contam a
    // dobrar face aos isolamentos.
    const todos = forcaDias.flatMap((d) => d.exercicios);
    // sem equipamento de carga, a progressão é por reps/alavanca (como calistenia)
    const semCarga =
      todos.length > 0 &&
      todos.filter((e) =>
        e.exercicio.equipamento.some((q) => ["barra", "halteres", "maquina", "cabos", "kettlebell"].includes(q)),
      ).length / todos.length < 0.3;
    const porReps = obj === "calistenia" || semCarga;
    let peso = 0;
    let bom = 0;
    for (const e of todos) {
      const w = e.exercicio.tier <= 2 ? 2 : 1;
      peso += w;
      if (porReps || e.exercicio.progressao !== "baixa") bom += w;
    }
    const fr = peso ? bom / peso : 1;
    criterios.push({
      nome: "progressao",
      peso: 10,
      fracao: clamp01n(fr),
      pontos: r1n(clamp01n(fr) * 10),
      notas: [porReps ? "progressão por reps/alavanca" : `${Math.round(fr * 100)}% do trabalho com progressão de carga clara`],
    });
  }

  // ===== 6. eficiência / tempo (10) =====
  {
    const excesso = dias
      .filter((d) => !duroTipo(d.tipo) && d.tipo !== "cardio_z2")
      .map((d) => Math.max(0, estimarMinutosDia(d) - minutosSessao) / minutosSessao);
    const fr = clamp01n(1 - 1.5 * excesso.reduce((a, b) => a + b, 0));
    criterios.push({ nome: "eficiencia_tempo", peso: 10, fracao: fr, pontos: r1n(fr * 10), notas: [`sessões de força vs ${minutosSessao} min`] });
  }

  let pontuacao = r1n(criterios.reduce((a, c) => a + c.pontos, 0));
  if (falhasDuras.length) pontuacao = Math.min(pontuacao, 60);
  const aprovado = falhasDuras.length === 0 && pontuacao >= 85;
  const rejeitado = falhasDuras.length > 0 || pontuacao < 75;
  return { pontuacao, aprovado, precisaRever: !aprovado && !rejeitado, rejeitado, criterios, falhasDuras, avisos };
}
