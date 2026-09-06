import test from "node:test";
import assert from "node:assert/strict";
import {
  selecionarSemana,
  avaliarHistorico,
  gerarPlanoComHistorico,
  equipamentoDaSemana,
  equipamentoPorDiaDe,
  EXERCICIOS,
  EQUIP_DISPONIVEL,
  type HistoricoTreino,
  type LogExercicio,
  type PerfilSelecao,
  type SemanaSelecionada,
} from "./index.ts";

const porId = new Map(EXERCICIOS.map((e) => [e.id, e]));
const base = (o: Partial<PerfilSelecao> = {}): PerfilSelecao => ({
  objetivo: "hipertrofia",
  nivel: "intermedio",
  dias: 4,
  equipamento: EQUIP_DISPONIVEL.ginasio,
  lesoes: [],
  ...o,
});
const todos = (s: SemanaSelecionada) => s.dias.flatMap((d) => d.exercicios.map((e) => e.exercicio.id));
const semVazio = (): HistoricoTreino => ({ logs: [], checkins: [] });

const logsEstaveis = (exercicioId: string, carga: number, rpe: number): LogExercicio[] =>
  [1, 2, 3].map((semana) => ({ exercicioId, semana, saltado: false, cargaKg: carga, reps: 8, rpe }));

const logsAProgredir = (exercicioId: string): LogExercicio[] =>
  [
    { exercicioId, semana: 1, saltado: false, cargaKg: 60, reps: 8, rpe: 8 },
    { exercicioId, semana: 2, saltado: false, cargaKg: 62.5, reps: 8, rpe: 8 },
    { exercicioId, semana: 3, saltado: false, cargaKg: 65, reps: 8, rpe: 8 },
    { exercicioId, semana: 4, saltado: false, cargaKg: 67.5, reps: 8, rpe: 8.5 },
  ];

// ===========================================================================
// 1. Exercício com progressão boa → mantido em 10 regenerações seguidas
// ===========================================================================
test("progressão consistente → o exercício é mantido em 10 regenerações", () => {
  const perfil = base({ dias: 5 });
  const alvo = todos(selecionarSemana(perfil))[0];
  const hist: HistoricoTreino = { logs: logsAProgredir(alvo), checkins: [] };

  for (let i = 0; i < 10; i++) {
    const { semana, decisoes } = gerarPlanoComHistorico(perfil, hist);
    const d = decisoes.find((x) => x.exercicioId === alvo);
    assert.ok(todos(semana).includes(alvo), `regeneração ${i}: ${alvo} desapareceu`);
    assert.ok(d && d.accao === "manter", `regeneração ${i}: ${alvo} foi trocado (${d?.motivo})`);
    assert.match(d.motivo, /Mantido/);
  }
});

test("sem histórico nenhum → nada é substituído", () => {
  const s = selecionarSemana(base({ dias: 4 }));
  const { semana, decisoes } = avaliarHistorico(s, semVazio());
  assert.deepEqual(todos(semana), todos(s));
  assert.ok(decisoes.every((d) => d.accao === "manter"));
  assert.ok(decisoes.every((d) => /ainda sem histórico/.test(d.motivo)));
});

// ===========================================================================
// 2. Estagnação 3 semanas → substituído, e o substituto é da mesma família
// ===========================================================================
test("estagnação ≥3 semanas (mesma carga e RPE) → substituído por variante da mesma família", () => {
  const s = selecionarSemana(base({ dias: 4 }));
  // escolher um exercício cuja família tenha alternativas viáveis
  const alvoId = todos(s).find((id) => {
    const e = porId.get(id)!;
    return EXERCICIOS.some((c) => c.familia === e.familia && c.id !== id && c.nivelMinimo !== "avancado");
  })!;
  const alvo = porId.get(alvoId)!;

  const hist: HistoricoTreino = { logs: logsEstaveis(alvoId, 100, 8), checkins: [] };
  const { semana, decisoes } = avaliarHistorico(s, hist);

  const d = decisoes.find((x) => x.exercicioId === alvoId)!;
  assert.equal(d.accao, "substituir", d.motivo);
  assert.equal(d.gatilho, "estagnacao");
  assert.ok(d.substitutoId && d.substitutoId !== alvoId);
  const sub = porId.get(d.substitutoId)!;
  assert.equal(sub.familia, alvo.familia, "o substituto tem de ser da MESMA família");
  assert.ok(!todos(semana).includes(alvoId), "o exercício estagnado continua na semana");
  assert.ok(todos(semana).includes(d.substitutoId));
});

test("carga a subir mas RPE parado → NÃO é estagnação (mantém-se)", () => {
  const s = selecionarSemana(base({ dias: 4 }));
  const alvoId = todos(s)[2];
  const logs: LogExercicio[] = [
    { exercicioId: alvoId, semana: 1, saltado: false, cargaKg: 80, reps: 8, rpe: 8 },
    { exercicioId: alvoId, semana: 2, saltado: false, cargaKg: 85, reps: 8, rpe: 8 },
    { exercicioId: alvoId, semana: 3, saltado: false, cargaKg: 90, reps: 8, rpe: 8 },
  ];
  const { decisoes } = avaliarHistorico(s, { logs, checkins: [] });
  assert.equal(decisoes.find((x) => x.exercicioId === alvoId)!.accao, "manter");
});

// ===========================================================================
// 3. Desconforto no ombro 2× → troca por variante da mesma família sem 'ombro'
// ===========================================================================
test("desconforto no ombro em 2 check-ins → exercícios que forçam o ombro são trocados", () => {
  const perfil = base({ dias: 5, nivel: "intermedio" });
  const s = selecionarSemana(perfil);
  const hist: HistoricoTreino = {
    logs: [],
    checkins: [
      { semana: 2, zonas: ["ombro"] },
      { semana: 3, zonas: ["ombro"] },
    ],
  };
  const { semana, decisoes } = avaliarHistorico(s, hist, { equipamento: perfil.equipamento });

  const forcamOmbro = todos(s).filter((id) => porId.get(id)!.contraindicacoes.includes("ombro"));
  assert.ok(forcamOmbro.length > 0, "o plano de teste não tem exercícios com contraindicação de ombro");

  const gin = EQUIP_DISPONIVEL.ginasio as string[];
  const nivelOrd = { iniciante: 0, intermedio: 1, avancado: 2 } as const;
  const temAlt = (e: (typeof EXERCICIOS)[number]) =>
    EXERCICIOS.some(
      (c) =>
        c.familia === e.familia &&
        c.id !== e.id &&
        !c.contraindicacoes.includes("ombro") &&
        nivelOrd[c.nivelMinimo] <= nivelOrd.intermedio &&
        c.equipamento.some((q) => gin.includes(q)),
    );
  for (const id of forcamOmbro) {
    const e = porId.get(id)!;
    const temAlternativa = temAlt(e);
    const d = decisoes.find((x) => x.exercicioId === id)!;
    if (temAlternativa) {
      assert.equal(d.accao, "substituir", `${id}: ${d.motivo}`);
      assert.equal(d.gatilho, "desconforto");
      const sub = porId.get(d.substitutoId!)!;
      assert.equal(sub.familia, e.familia);
      assert.ok(!sub.contraindicacoes.includes("ombro"), `${sub.id} ainda força o ombro`);
    } else {
      assert.equal(d.accao, "manter");
      assert.match(d.motivo, /não há variante/);
    }
  }
  // nenhum exercício com contraindicação de ombro sobrevive quando havia troca possível
  for (const id of todos(semana)) {
    const e = porId.get(id)!;
    if (!e.contraindicacoes.includes("ombro")) continue;
    assert.ok(!temAlt(e), `${id} sobreviveu apesar de haver alternativa sem ombro`);
  }
});

test("desconforto numa zona que o exercício NÃO força → não mexe nesse exercício", () => {
  const s = selecionarSemana(base({ dias: 4 }));
  const { decisoes } = avaliarHistorico(s, { logs: [], checkins: [{ semana: 1, zonas: ["tornozelo"] }, { semana: 2, zonas: ["tornozelo"] }] });
  // nenhum exercício de peito/costas/braço é trocado por desconforto no tornozelo
  for (const d of decisoes) {
    if (d.gatilho === "desconforto") {
      assert.ok(porId.get(d.exercicioId)!.contraindicacoes.includes("tornozelo"));
    }
  }
});

// ===========================================================================
// gatilhos 3 e 4
// ===========================================================================
test("RPE sistematicamente acima do alvo → substituído", () => {
  const s = selecionarSemana(base({ dias: 4 }));
  const alvoId = todos(s).find((id) =>
    EXERCICIOS.some((c) => c.familia === porId.get(id)!.familia && c.id !== id && c.nivelMinimo !== "avancado"),
  )!;
  // carga a subir (não é estagnação), mas RPE sempre 9.5–10 (alvo hipertrofia ≤ 9)
  const logs: LogExercicio[] = [
    { exercicioId: alvoId, semana: 1, saltado: false, cargaKg: 40, reps: 8, rpe: 9.5 },
    { exercicioId: alvoId, semana: 2, saltado: false, cargaKg: 42.5, reps: 8, rpe: 10 },
    { exercicioId: alvoId, semana: 3, saltado: false, cargaKg: 45, reps: 8, rpe: 9.5 },
  ];
  const { decisoes } = avaliarHistorico(s, { logs, checkins: [] });
  const d = decisoes.find((x) => x.exercicioId === alvoId)!;
  assert.equal(d.accao, "substituir", d.motivo);
  assert.equal(d.gatilho, "rpe_alto");
});

test("exercício saltado repetidamente → substituído", () => {
  const s = selecionarSemana(base({ dias: 4 }));
  const alvoId = todos(s).find((id) =>
    EXERCICIOS.some((c) => c.familia === porId.get(id)!.familia && c.id !== id && c.nivelMinimo !== "avancado"),
  )!;
  const logs: LogExercicio[] = [1, 2, 3, 4].map((semana) => ({
    exercicioId: alvoId,
    semana,
    saltado: true,
    cargaKg: null,
    reps: null,
    rpe: null,
  }));
  const { decisoes } = avaliarHistorico(s, { logs, checkins: [] });
  const d = decisoes.find((x) => x.exercicioId === alvoId)!;
  assert.equal(d.accao, "substituir", d.motivo);
  assert.equal(d.gatilho, "saltado");
  assert.match(d.motivo, /saltaste/);
});

// ===========================================================================
// 4. Cada substituição tem um motivo legível
// ===========================================================================
test("toda a substituição traz um motivo legível (nomes + razão)", () => {
  const s = selecionarSemana(base({ dias: 6 }));
  const ids = todos(s);
  // provocar os 4 gatilhos ao mesmo tempo em exercícios diferentes
  const comAlt = ids.filter((id) =>
    EXERCICIOS.some((c) => c.familia === porId.get(id)!.familia && c.id !== id && c.nivelMinimo !== "avancado"),
  );
  const [a, b, c] = comAlt;
  const hist: HistoricoTreino = {
    logs: [
      ...logsEstaveis(a, 100, 8), // estagnação
      { exercicioId: b, semana: 1, saltado: false, cargaKg: 30, reps: 8, rpe: 9.6 },
      { exercicioId: b, semana: 2, saltado: false, cargaKg: 32, reps: 8, rpe: 9.7 },
      { exercicioId: b, semana: 3, saltado: false, cargaKg: 34, reps: 8, rpe: 9.8 }, // rpe alto
      ...[1, 2, 3].map((w) => ({ exercicioId: c, semana: w, saltado: true, cargaKg: null, reps: null, rpe: null })), // saltado
    ],
    checkins: [
      { semana: 1, zonas: ["ombro"] },
      { semana: 2, zonas: ["ombro"] },
    ],
  };
  const { decisoes } = avaliarHistorico(s, hist);
  const trocas = decisoes.filter((d) => d.accao === "substituir");
  assert.ok(trocas.length >= 3, `só ${trocas.length} trocas`);

  for (const d of trocas) {
    const antes = porId.get(d.exercicioId)!.nome;
    const depois = porId.get(d.substitutoId!)!.nome;
    assert.match(d.motivo, /^Troquei /, d.motivo);
    assert.ok(d.motivo.includes(antes), `motivo não nomeia o exercício antes: ${d.motivo}`);
    assert.ok(d.motivo.includes(depois), `motivo não nomeia o substituto: ${d.motivo}`);
    // menciona a razão concreta
    assert.match(d.motivo, /semanas sem subir|desconforto|acima do alvo|saltaste/, d.motivo);
    assert.ok(d.motivo.length <= 200);
  }
});

// ===========================================================================
// invariantes do substituto
// ===========================================================================
test("o substituto respeita família, nível e equipamento; nunca troca por variedade", () => {
  const perfil = base({ dias: 5, nivel: "iniciante", equipamento: EQUIP_DISPONIVEL.casa });
  const s = selecionarSemana(perfil);
  const alvoId = todos(s).find((id) =>
    EXERCICIOS.some(
      (c) =>
        c.familia === porId.get(id)!.familia &&
        c.id !== id &&
        c.equipamento.some((q) => (EQUIP_DISPONIVEL.casa as string[]).includes(q)) &&
        c.nivelMinimo === "iniciante",
    ),
  );
  if (!alvoId) return; // nada a testar neste plano
  const dupsAntes = todos(s).length - new Set(todos(s)).size;
  const { semana, decisoes } = avaliarHistorico(s, { logs: logsEstaveis(alvoId, 50, 8), checkins: [] }, { equipamento: perfil.equipamento });
  const d = decisoes.find((x) => x.exercicioId === alvoId)!;
  if (d.accao !== "substituir") return;
  const sub = porId.get(d.substitutoId!)!;
  const orig = porId.get(alvoId)!;
  assert.equal(sub.familia, orig.familia, "o substituto tem de ser da mesma família — nunca por variedade");
  assert.equal(sub.nivelMinimo, "iniciante");
  assert.ok(sub.equipamento.some((q) => (EQUIP_DISPONIVEL.casa as string[]).includes(q)));
  assert.ok(todos(semana).length - new Set(todos(semana)).size <= dupsAntes, "a troca criou um duplicado novo");
});

// ===========================================================================
// Casa+Ginásio (parte 3): o substituto respeita o equipamento do PRÓPRIO dia
// ===========================================================================
test("Casa+Ginásio: substituição por estagnação num dia de casa devolve variante disponível em casa", () => {
  const equipamentoPorDia = equipamentoPorDiaDe({ location: "hibrido", dias: 5, diasGinasio: 2 });
  const perfil = base({ dias: 5, equipamento: equipamentoDaSemana(equipamentoPorDia), equipamentoPorDia });
  const s = selecionarSemana(perfil);

  const diasDoExercicio = (id: string) => s.dias.filter((d) => d.exercicios.some((e) => e.exercicio.id === id));
  // um exercício cujos slots estão TODOS num dia de casa (sem barra — ver
  // `ehDiaDeGinasio` em equipamento.test.ts para o mesmo critério)
  const alvoId = todos(s).find((id) => {
    const dias = diasDoExercicio(id);
    return dias.length > 0 && dias.every((d) => !d.equipamento.includes("barra"));
  });
  assert.ok(alvoId, "não achei nenhum exercício só em dia(s) de casa neste plano de teste");

  const diaCasa = diasDoExercicio(alvoId!)[0];
  const hist: HistoricoTreino = { logs: logsEstaveis(alvoId!, 40, 8), checkins: [] };
  // passa a união RICA da semana (como `gerarPlanoComHistorico` sempre fez) —
  // de propósito, para provar que já não é isso que decide o substituto.
  const { semana, decisoes } = avaliarHistorico(s, hist, { equipamento: perfil.equipamento });

  const d = decisoes.find((x) => x.exercicioId === alvoId)!;
  assert.equal(d.accao, "substituir", d.motivo);
  const sub = porId.get(d.substitutoId!)!;
  assert.ok(
    sub.equipamento.some((q) => diaCasa.equipamento.includes(q)),
    `substituto ${sub.id} (${sub.equipamento.join(",")}) não é executável no dia de casa (${diaCasa.equipamento.join(",")})`,
  );
  assert.ok(todos(semana).includes(d.substitutoId!));
});

test("Casa+Ginásio: o melhor candidato por tier/perfil (hip_thrust_maquina, gym) é preterido pela variante de casa (hip_thrust_1_perna)", () => {
  // hip_thrust_barra (T2, encurtado) estagna. Por tier+perfil, o melhor
  // candidato da família é hip_thrust_maquina (T2, encurtado, máquina) — só
  // perde para hip_thrust_1_perna (T3, encurtado, peso_corporal/halteres) se
  // o equipamento considerado for o do PRÓPRIO dia (sem máquina), não a
  // união rica da semana. Prova determinística do mecanismo corrigido.
  const perfil = base({ dias: 1, equipamento: EQUIP_DISPONIVEL.ginasio }); // união rica de propósito
  const s: SemanaSelecionada = {
    perfil,
    split: "x",
    alvoVolume: {},
    dias: [
      {
        indice: 0,
        nome: "Pernas (casa)",
        tipo: "legs",
        musculosAlvo: ["gluteo"],
        equipamento: ["halteres", "banda", "peso_corporal", "barra_fixa", "banco"],
        exercicios: [{ exercicio: porId.get("hip_thrust_barra")!, series: 3, ordem: 1, foco: false }],
      },
    ],
    volume: { nivel: "intermedio", porMusculo: [], racioEmpurrarPuxar: { empurrar: 0, puxar: 0, racio: 1, equilibrado: true }, avisos: [] },
    avisos: [],
  };
  const hist: HistoricoTreino = { logs: logsEstaveis("hip_thrust_barra", 40, 8), checkins: [] };
  // passa a união rica explicitamente — como `gerarPlanoComHistorico` sempre
  // fez — para confirmar que já não é ela a decidir o substituto.
  const { decisoes } = avaliarHistorico(s, hist, { equipamento: perfil.equipamento });
  const d = decisoes.find((x) => x.exercicioId === "hip_thrust_barra")!;
  assert.equal(d.accao, "substituir", d.motivo);
  assert.equal(d.substitutoId, "hip_thrust_1_perna", `esperava a variante de casa, veio ${d.substitutoId}`);
});

test("gerarPlanoComHistorico revalida o plano depois das trocas", () => {
  const perfil = base({ dias: 4 });
  const s0 = selecionarSemana(perfil);
  const hist: HistoricoTreino = { logs: logsEstaveis(todos(s0)[0], 100, 8), checkins: [] };
  const { validacao, decisoes } = gerarPlanoComHistorico(perfil, hist);
  assert.ok(validacao.pontuacao >= 75, `pontuação caiu para ${validacao.pontuacao} depois das trocas`);
  assert.ok(decisoes.length > 0);
});
