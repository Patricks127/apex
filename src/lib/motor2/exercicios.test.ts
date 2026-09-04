import test from "node:test";
import assert from "node:assert/strict";
import {
  EXERCICIOS,
  FAMILIAS,
  PADROES,
  MUSCULOS,
  EQUIPAMENTOS,
  ZONAS,
  NIVEIS,
  FAMILIA_PADRAO,
  contagemPorFamilia,
  exercicioPorId,
  musculosDe,
  type Familia,
  type Padrao,
} from "./index.ts";

const F = new Set<string>(FAMILIAS);
const P = new Set<string>(PADROES);
const M = new Set<string>(MUSCULOS);
const EQ = new Set<string>(EQUIPAMENTOS);
const Z = new Set<string>(ZONAS);
const N = new Set<string>(NIVEIS);

test("dimensão da base: ~120 exercícios", () => {
  console.log(`  total = ${EXERCICIOS.length}`);
  console.log("  por família:", JSON.stringify(contagemPorFamilia()));
  assert.ok(
    EXERCICIOS.length >= 118 && EXERCICIOS.length <= 138,
    `esperado ~120, tem ${EXERCICIOS.length}`,
  );
});

test("ids únicos e em snake_case", () => {
  const vistos = new Set<string>();
  for (const e of EXERCICIOS) {
    assert.ok(!vistos.has(e.id), `id duplicado: ${e.id}`);
    vistos.add(e.id);
    assert.match(e.id, /^[a-z0-9_]+$/, `id inválido: ${e.id}`);
    assert.ok(e.nome.trim().length > 2, `nome curto: ${e.id}`);
  }
});

test("todos os campos do tipo Exercicio presentes e no domínio certo", () => {
  for (const e of EXERCICIOS) {
    const ctx = `[${e.id}]`;
    assert.ok(F.has(e.familia), `${ctx} familia inválida: ${e.familia}`);
    assert.ok(P.has(e.padrao), `${ctx} padrao inválido: ${e.padrao}`);
    assert.ok([1, 2, 3].includes(e.tier), `${ctx} tier inválido`);
    assert.ok([1, 2, 3].includes(e.fadigaSistemica), `${ctx} fadigaSistemica`);
    assert.ok([1, 2, 3].includes(e.fadigaLocal), `${ctx} fadigaLocal`);
    assert.ok([1, 2, 3].includes(e.exigenciaTecnica), `${ctx} exigenciaTecnica`);
    assert.ok(
      ["livre", "apoiado", "maquina"].includes(e.estabilidade),
      `${ctx} estabilidade`,
    );
    assert.ok(
      ["alongado", "medio", "encurtado"].includes(e.perfilResistencia),
      `${ctx} perfilResistencia`,
    );
    assert.ok(["alta", "media", "baixa"].includes(e.progressao), `${ctx} progressao`);
    assert.ok(N.has(e.nivelMinimo), `${ctx} nivelMinimo`);

    assert.ok(Array.isArray(e.equipamento) && e.equipamento.length >= 1, `${ctx} equipamento vazio`);
    for (const q of e.equipamento) assert.ok(EQ.has(q), `${ctx} equipamento inválido: ${q}`);

    assert.ok(Array.isArray(e.contraindicacoes), `${ctx} contraindicacoes`);
    for (const z of e.contraindicacoes) assert.ok(Z.has(z), `${ctx} zona inválida: ${z}`);
  }
});

test("contagem fracionada: primário = 1.0, secundário = 0.5 (spec 2.1)", () => {
  for (const e of EXERCICIOS) {
    const ctx = `[${e.id}]`;
    assert.ok(e.primarios.length >= 1, `${ctx} sem músculo primário`);
    for (const p of e.primarios) {
      assert.ok(M.has(p.musculo), `${ctx} músculo primário inválido: ${p.musculo}`);
      assert.equal(p.contributo, 1.0, `${ctx} contributo primário != 1.0`);
    }
    for (const s of e.secundarios) {
      assert.ok(M.has(s.musculo), `${ctx} músculo secundário inválido: ${s.musculo}`);
      assert.equal(s.contributo, 0.5, `${ctx} contributo secundário != 0.5`);
    }
    // um músculo não pode ser primário e secundário ao mesmo tempo
    const prim = new Set(e.primarios.map((x) => x.musculo));
    for (const s of e.secundarios) {
      assert.ok(!prim.has(s.musculo), `${ctx} ${s.musculo} está em primários e secundários`);
    }
  }
});

test("cada uma das 21 famílias tem exercícios; as 16 da spec com ≥3", () => {
  const cont = contagemPorFamilia();
  for (const f of FAMILIAS) {
    assert.ok((cont[f] ?? 0) >= 1, `família sem exercícios: ${f}`);
  }
  const spec16: Familia[] = [
    "squat", "hinge", "unilateral_inferior", "knee_flexion", "hip_extension",
    "horizontal_push", "incline_push", "vertical_push", "chest_isolation",
    "vertical_pull", "horizontal_pull", "rear_delt_scap", "lateral_raise",
    "elbow_flexion", "elbow_extension", "calf",
  ];
  for (const f of spec16) {
    assert.ok((cont[f] ?? 0) >= 3, `família da spec com poucos exercícios (${cont[f] ?? 0}): ${f}`);
  }
});

test("padrao coerente com a família (herdado ou afinação plausível)", () => {
  // pares família→padrão que consideramos afinações válidas ao FAMILIA_PADRAO
  const afinacoesOk: Record<string, string[]> = {
    squat: ["agachar"],
    unilateral_inferior: ["unilateral_inferior", "extensao_anca"],
    knee_flexion: ["flexao_joelho", "extensao_anca"],
    horizontal_push: ["empurrar_horizontal"],
    chest_isolation: ["empurrar_horizontal"],
    vertical_push: ["empurrar_vertical"],
    lateral_raise: ["abducao_ombro"],
    elbow_extension: ["extensao_cotovelo"],
    conditioning: ["potencia", "dobrar_anca", "locomocao", "puxar_horizontal"],
    carry: ["transporte", "core_antirrotacao"],
    core: ["core_antiextensao", "core_antirrotacao", "core_flexao"],
    cardio: ["locomocao"],
    skill: ["empurrar_vertical", "puxar_vertical", "puxar_horizontal", "core_flexao"],
  };
  for (const e of EXERCICIOS) {
    const canon = FAMILIA_PADRAO[e.familia];
    const permitidos = afinacoesOk[e.familia] ?? [canon];
    assert.ok(
      e.padrao === canon || permitidos.includes(e.padrao),
      `[${e.id}] padrao '${e.padrao}' não coerente com família '${e.familia}'`,
    );
  }
});

test("tier vs. fadiga/exigência plausíveis", () => {
  const naoResistencia = new Set(["cardio", "conditioning", "carry", "skill"]);
  for (const e of EXERCICIOS) {
    // isolamentos (tier 3) de resistência não deviam ser de fadiga sistémica máxima
    if (e.tier === 3 && !naoResistencia.has(e.familia)) {
      assert.ok(e.fadigaSistemica <= 2, `[${e.id}] tier 3 com fadigaSistemica 3`);
    }
    // compostos de peso livre tier 1 (não-cardio) têm exigência técnica ≥2
    if (e.tier === 1 && e.estabilidade === "livre" && !naoResistencia.has(e.familia)) {
      assert.ok(e.exigenciaTecnica >= 2, `[${e.id}] tier 1 livre com exigência técnica < 2`);
    }
  }
});

test("contraindicações: carga axial na coluna marca 'lombar'", () => {
  const axiais = [
    "agachamento_barra_costas", "agachamento_frontal", "terra_convencional",
    "terra_sumo", "good_morning", "remada_curvada_barra", "press_militar_barra",
  ];
  for (const id of axiais) {
    const e = exercicioPorId(id);
    assert.ok(e, `exercício em falta: ${id}`);
    assert.ok(e!.contraindicacoes.includes("lombar"), `[${id}] devia contraindicar 'lombar'`);
  }
});

test("cobertura de padrões essenciais na base", () => {
  const essenciais: Padrao[] = [
    "agachar", "dobrar_anca", "empurrar_horizontal", "empurrar_vertical",
    "puxar_horizontal", "puxar_vertical", "flexao_joelho", "extensao_anca",
    "abducao_ombro", "flexao_cotovelo", "extensao_cotovelo", "flexao_plantar",
    "rotacao_externa", "core_antiextensao",
  ];
  const presentes = new Set<Padrao>(EXERCICIOS.map((e) => e.padrao));
  for (const p of essenciais) {
    assert.ok(presentes.has(p), `nenhum exercício com o padrão essencial '${p}'`);
  }
});

test("perfilResistencia: famílias de alto volume cobrem ≥2 perfis (spec 2.4)", () => {
  const alvo: Familia[] = [
    "horizontal_push", "incline_push", "vertical_pull", "horizontal_pull",
    "hinge", "squat", "elbow_flexion", "elbow_extension", "lateral_raise",
  ];
  for (const f of alvo) {
    const perfis = new Set(EXERCICIOS.filter((e) => e.familia === f).map((e) => e.perfilResistencia));
    assert.ok(perfis.size >= 2, `família '${f}' só cobre 1 perfil de resistência: ${[...perfis]}`);
  }
});

test("cobertura por tier de cada músculo grande (âncora + isolamento)", () => {
  // "costas" mapeia para dorsais (a §3.2 separa vertical/horizontal pull).
  const grandes: { musculo: (typeof MUSCULOS)[number]; nome: string }[] = [
    { musculo: "peito", nome: "peito" },
    { musculo: "dorsais", nome: "costas (dorsais)" },
    { musculo: "quadriceps", nome: "quadricípite" },
    { musculo: "isquiotibiais", nome: "isquiotibiais" },
    { musculo: "gluteo", nome: "glúteo" },
    { musculo: "deltoide_lateral", nome: "deltoide lateral" },
    { musculo: "biceps", nome: "bíceps" },
    { musculo: "triceps", nome: "tríceps" },
  ];

  const ehPrimario = (e: (typeof EXERCICIOS)[number], m: string) =>
    e.primarios.some((x) => x.musculo === m);
  const ehSecundario = (e: (typeof EXERCICIOS)[number], m: string) =>
    e.secundarios.some((x) => x.musculo === m);

  console.log("\n  músculo grande        | T1p T2p T3p | T1s T2s T3s | âncora? iso?");
  console.log("  ----------------------|-------------|-------------|-------------");

  // Músculos que se treinam SOBRETUDO por isolamento + carga secundária de
  // compostos — não têm (nem precisam de) âncora composta primária própria.
  const isolamentoPuro = new Set(["deltoide lateral", "bíceps"]);

  const semAncora: string[] = [];
  const semIso: string[] = [];
  const semCargaComposta: string[] = [];
  const semTier1Estrito: string[] = [];

  for (const g of grandes) {
    const prim = [1, 2, 3].map(
      (t) => EXERCICIOS.filter((e) => e.tier === t && ehPrimario(e, g.musculo)).length,
    );
    const sec = [1, 2, 3].map(
      (t) => EXERCICIOS.filter((e) => e.tier === t && ehSecundario(e, g.musculo)).length,
    );
    const ancora = prim[0] + prim[1] > 0;
    const iso = prim[2] > 0;
    const cargaComposta = prim[0] + prim[1] + sec[0] + sec[1] > 0; // pesado, primário OU secundário
    console.log(
      `  ${g.nome.padEnd(21)} |  ${prim[0]}   ${prim[1]}   ${prim[2]}  ` +
        `|  ${sec[0]}   ${sec[1]}   ${sec[2]}  | ${ancora ? "sim" : "NÃO"}    ${iso ? "sim" : "NÃO"}`,
    );
    if (!iso) semIso.push(g.nome);
    if (isolamentoPuro.has(g.nome)) {
      if (!cargaComposta) semCargaComposta.push(g.nome);
    } else if (!ancora) {
      semAncora.push(g.nome);
    }
    if (prim[0] === 0) semTier1Estrito.push(g.nome);
  }

  if (semTier1Estrito.length) {
    console.log(
      `\n  (informativo) sem Tier 1 primário estrito: ${semTier1Estrito.join(", ")} — ` +
        "esperado: bíceps, tríceps e deltoide lateral nunca são a âncora de uma " +
        "sessão pesada; recebem carga Tier 1/2 como secundários (das puxadas e " +
        "dos press) e têm o grosso do volume em isolamento Tier 3.",
    );
  }

  // Falha dura: um grande com âncora composta esperada sem nenhum T1/T2 primário;
  // um de isolamento puro sem QUALQUER carga pesada (nem secundária); ou qualquer
  // um sem isolamento T3 primário.
  assert.equal(
    semAncora.length,
    0,
    `músculos grandes SEM âncora (0 exercícios primários em Tier 1+2): ${semAncora.join(", ")}`,
  );
  assert.equal(
    semCargaComposta.length,
    0,
    `músculos de isolamento sem qualquer carga pesada (T1/T2 primária ou secundária): ${semCargaComposta.join(", ")}`,
  );
  assert.equal(
    semIso.length,
    0,
    `músculos grandes SEM isolamento (0 exercícios primários em Tier 3): ${semIso.join(", ")}`,
  );
});

test("helpers", () => {
  assert.equal(exercicioPorId("supino_barra")?.nome, "Supino com barra");
  assert.equal(exercicioPorId("nao_existe"), undefined);
  const m = musculosDe(exercicioPorId("supino_barra")!);
  assert.deepEqual(m.sort(), ["deltoide_anterior", "peito", "triceps"]);
});
