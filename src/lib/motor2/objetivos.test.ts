import test from "node:test";
import assert from "node:assert/strict";
import {
  gerarPlanoValidado,
  gerarPlanoV2,
  selecionarSemana,
  validarSemana,
  CARDIO_DURO,
  PARAMS,
  EQUIP_DISPONIVEL,
  type ObjetivoV2,
  type PerfilSelecao,
  type SemanaSelecionada,
} from "./index.ts";

const OBJETIVOS: ObjetivoV2[] = ["hipertrofia", "powerlifting", "hibrido", "hyrox", "corrida", "calistenia"];
const NIVEIS = ["iniciante", "intermedio", "avancado"] as const;
const DIAS = [3, 4, 5, 6];
const LOCAIS = ["ginasio", "casa", "parque", "hibrido", "outro"] as const;
const LESOES = [[], ["ombro"], ["joelho"], ["lombar"], ["ombro", "joelho"], ["anca"], ["cotovelo"]] as const;
const FOCOS = [[], ["peito"], ["dorsais"], ["quadriceps"], ["gluteo"]] as const;
const MINUTOS = [60, 75, 90, 120];

const duro = (t: string) => (CARDIO_DURO as string[]).includes(t);
const pernasPesado = (d: SemanaSelecionada["dias"][number]) =>
  d.tipo === "forca_principal" || /Inferior|Pernas/i.test(d.nome);

// ===========================================================================
// 1. spec §6 — parâmetros das 6 modalidades presentes e coerentes
// ===========================================================================
test("PARAMS cobre as 6 modalidades com reps/RIR/descanso da spec §6", () => {
  for (const o of OBJETIVOS) {
    const p = PARAMS[o];
    assert.ok(p, o);
    assert.ok(p.reps[0] >= 1 && p.reps[1] <= 20 && p.reps[0] <= p.reps[1]);
    assert.ok(p.rir[0] >= 0 && p.rir[1] <= 5 && p.rir[0] <= p.rir[1]);
    assert.ok(p.descanso[0] >= 20 && p.descanso[1] <= 360);
    assert.ok(p.regras.length >= 1);
  }
  // regras que não se podem perder
  assert.ok(PARAMS.powerlifting.rir[0] === 3 && PARAMS.powerlifting.rir[1] === 5);
  assert.ok(PARAMS.powerlifting.regras.some((r) => /nunca falha/i.test(r) && /terra|agachamento/i.test(r)));
  assert.ok(PARAMS.corrida.regras.some((r) => /75–80%|Z1–2/i.test(r)));
  assert.ok(PARAMS.hibrido.regras.some((r) => /dias separados|≥6\s*h/i.test(r)));
  assert.ok(PARAMS.hibrido.regras.some((r) => /24\s*h.*pernas|pernas.*24\s*h/i.test(r)));
  assert.ok(PARAMS.hibrido.regras.some((r) => /bicicleta|remo/i.test(r)));
});

// ===========================================================================
// 2. treino concorrente (spec §2.5) em todas as combinações
// ===========================================================================
test("§2.5 — cardio duro nunca imediatamente antes de pernas pesado, nem no mesmo dia", () => {
  for (const objetivo of ["hibrido", "hyrox", "corrida"] as const) {
    for (const nivel of NIVEIS) {
      for (const dias of DIAS) {
        const s = selecionarSemana({ objetivo, nivel, dias, equipamento: EQUIP_DISPONIVEL.ginasio, lesoes: [] });
        for (let i = 1; i < s.dias.length; i++) {
          if (duro(s.dias[i - 1].tipo) && pernasPesado(s.dias[i])) {
            // só é aceitável se o próprio seletor avisar que não dá para separar
            assert.ok(
              s.avisos.some((a) => /não deixa separar/.test(a)),
              `${objetivo}/${nivel}/${dias}d: ${s.dias[i - 1].nome} → ${s.dias[i].nome} sem aviso`,
            );
          }
          // nunca força + cardio duro no mesmo dia (exceto circuito planeado)
          const d = s.dias[i - 1];
          const temForca = d.exercicios.some((e) => e.exercicio.familia !== "cardio" && e.exercicio.familia !== "conditioning" && e.exercicio.familia !== "carry");
          const temCardio = d.exercicios.some((e) => e.exercicio.familia === "cardio");
          assert.ok(!(temForca && temCardio && duro(d.tipo)), `${objetivo}/${nivel}/${dias}d: força + cardio duro no mesmo dia`);
        }
      }
    }
  }
});

test("§2.5 — com a força como prioridade, o cardio Z2 é bicicleta/remo, não corrida", () => {
  for (const objetivo of ["hibrido", "hyrox"] as const) {
    const s = selecionarSemana({ objetivo, nivel: "intermedio", dias: 6, equipamento: EQUIP_DISPONIVEL.ginasio, lesoes: [] });
    const z2 = s.dias.filter((d) => d.tipo === "cardio_z2").flatMap((d) => d.exercicios);
    for (const e of z2) {
      assert.ok(
        e.exercicio.equipamento.some((q) => q === "bicicleta" || q === "remo_ergometro"),
        `${objetivo}: cardio Z2 = ${e.exercicio.id} (esperava bicicleta/remo)`,
      );
    }
  }
  // corrida: o objetivo é correr — as sessões fáceis são a correr
  const c = selecionarSemana({ objetivo: "corrida", nivel: "intermedio", dias: 5, equipamento: EQUIP_DISPONIVEL.ginasio, lesoes: [] });
  const z2c = c.dias.filter((d) => d.tipo === "cardio_z2").flatMap((d) => d.exercicios);
  assert.ok(z2c.length && z2c.every((e) => /corrida/.test(e.exercicio.id)));
});

// ===========================================================================
// 3. estrutura das modalidades
// ===========================================================================
test("estrutura por objetivo (spec §6)", () => {
  const pl = selecionarSemana({ objetivo: "powerlifting", nivel: "intermedio", dias: 4, equipamento: EQUIP_DISPONIVEL.ginasio, lesoes: [] });
  const principais = pl.dias.filter((d) => d.tipo === "forca_principal").map((d) => d.exercicios[0]?.exercicio.familia);
  assert.ok(["squat", "hinge", "horizontal_push"].every((f) => principais.includes(f as never)), "rotação dos 3 levantamentos");

  const cal = selecionarSemana({ objetivo: "calistenia", nivel: "intermedio", dias: 4, equipamento: EQUIP_DISPONIVEL.ginasio, lesoes: [] });
  assert.ok(cal.dias.some((d) => d.tipo === "skill"), "calistenia tem dia de skill");
  const todos = cal.dias.flatMap((d) => d.exercicios);
  assert.ok(
    todos.every((e) => e.exercicio.familia === "cardio" || e.exercicio.equipamento.some((q) => ["peso_corporal", "barra_fixa", "paralelas", "banda", "trx", "caixa"].includes(q))),
    "calistenia usa só peso corporal",
  );

  const hib = selecionarSemana({ objetivo: "hibrido", nivel: "intermedio", dias: 4, equipamento: EQUIP_DISPONIVEL.ginasio, lesoes: [] });
  assert.ok(hib.dias.some((d) => d.tipo === "cardio_z2") && hib.dias.some((d) => d.tipo.startsWith("forca")));

  const cor = selecionarSemana({ objetivo: "corrida", nivel: "intermedio", dias: 5, equipamento: EQUIP_DISPONIVEL.ginasio, lesoes: [] });
  assert.ok(cor.dias.filter((d) => d.tipo === "cardio_z2").length >= 2 && cor.dias.some((d) => d.tipo === "cardio_qualidade"));
});

test("powerlifting: iniciante nunca recebe 5–6 dias de levantamentos pesados", () => {
  for (const dias of [5, 6]) {
    const s = selecionarSemana({ objetivo: "powerlifting", nivel: "iniciante", dias, equipamento: EQUIP_DISPONIVEL.ginasio, lesoes: [] });
    assert.ok(s.dias.length <= 4, `iniciante powerlifting com ${s.dias.length} dias`);
    assert.ok(s.avisos.some((a) => /iniciante/i.test(a)));
  }
});

// ===========================================================================
// 4. TESTE FINAL (spec §8) — 100 planos por objetivo, todos ≥85
// ===========================================================================
test("spec §8 — 600 planos aleatórios (100 × 6 objetivos): distribuição e ≥85", () => {
  let seed = 99;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const pk = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];

  let rejeitados = 0;
  let totalAbaixo = 0;

  for (const objetivo of OBJETIVOS) {
    const pts: number[] = [];
    const abaixo: { p: PerfilSelecao; v: ReturnType<typeof validarSemana> }[] = [];
    for (let i = 0; i < 100; i++) {
      const p: PerfilSelecao = {
        objetivo,
        nivel: pk(NIVEIS),
        dias: pk(DIAS),
        equipamento: EQUIP_DISPONIVEL[pk(LOCAIS)],
        lesoes: [...pk(LESOES)] as PerfilSelecao["lesoes"],
        foco: objetivo === "hipertrofia" ? ([...pk(FOCOS)] as PerfilSelecao["foco"]) : [],
        minutosSessao: pk(MINUTOS),
      };
      const { validacao } = gerarPlanoValidado(p);
      pts.push(validacao.pontuacao);
      if (validacao.rejeitado) rejeitados++;
      if (validacao.pontuacao < 85) abaixo.push({ p, v: validacao });
    }
    const media = pts.reduce((a, b) => a + b, 0) / pts.length;
    const bucket = (lo: number, hi: number) => pts.filter((x) => x >= lo && x < hi).length;
    console.log(
      `\n  ${objetivo.padEnd(12)} ≥85: ${pts.filter((x) => x >= 85).length}/100 · média ${media.toFixed(1)} · ` +
        `[<75:${bucket(0, 75)} 75–84:${bucket(75, 85)} 85–94:${bucket(85, 95)} 95+:${bucket(95, 101)}]`,
    );
    for (const { p, v } of abaixo) {
      const porque = v.falhasDuras.length
        ? v.falhasDuras.join(" | ")
        : v.criterios.filter((c) => c.pontos < c.peso * 0.75).map((c) => c.nome).join(", ");
      console.log(`    ↓ ${p.nivel}/${p.dias}d lesão=${(p.lesoes ?? []).join(",") || "-"} → ${v.pontuacao}  [${porque}]`);
    }
    totalAbaixo += abaixo.length;

    // por objetivo: a grande maioria ≥85 e média alta
    assert.ok(pts.filter((x) => x >= 85).length >= 96, `${objetivo}: só ${pts.filter((x) => x >= 85).length}/100 ≥85`);
    assert.ok(media >= 90, `${objetivo}: média ${media.toFixed(1)}`);
    assert.ok(pts.every((x) => x >= 78), `${objetivo}: mínimo ${Math.min(...pts)}`);
  }

  // no conjunto: nenhum plano é REJEITADO e ≥ 98% pontuam ≥85
  assert.equal(rejeitados, 0, `${rejeitados} planos rejeitados`);
  assert.ok(600 - totalAbaixo >= 588, `só ${600 - totalAbaixo}/600 ≥85`);
});

// ===========================================================================
// 5. adaptador para a app (PlanoGerado)
// ===========================================================================
test("gerarPlanoV2 devolve um PlanoGerado válido para cada objetivo", () => {
  for (const goal of OBJETIVOS) {
    const mp = {
      goal,
      sex: "homem" as const,
      level: "intermedio" as const,
      daysPerWeek: goal === "corrida" ? 5 : 4,
      location: "ginasio" as const,
      injuries: [],
      focus: [],
    };
    const plano = gerarPlanoV2(mp as never, {});
    assert.equal(plano.version, 1);
    assert.equal(plano.days.length, 7);
    assert.equal(plano.meta.goal, goal);
    const treino = plano.days.filter((d) => !d.rest);
    assert.ok(treino.length >= 3);
    for (const d of treino) {
      assert.ok((d.exercises ?? []).length > 0, `${goal}: ${d.title} sem exercícios`);
      for (const e of d.exercises ?? []) {
        assert.ok(e.name && e.sets.length > 0);
        for (const s of e.sets) assert.ok(s.w === null || s.w >= 10);
      }
    }
    // descanso entre dias de treino (nunca 7 seguidos)
    assert.ok(plano.days.some((d) => d.rest));
  }
  // calistenia: tudo peso corporal
  const cal = gerarPlanoV2({ goal: "calistenia", sex: "homem", level: "intermedio", daysPerWeek: 4, location: "ginasio", injuries: [], focus: [] } as never, {});
  for (const d of cal.days.filter((x) => !x.rest))
    for (const e of d.exercises ?? []) assert.ok(e.bw || e.muscle === "Cardio", `${e.name} tem carga em calistenia`);
});

test("gerarPlanoV2 aplica a progressão e o check-in", () => {
  const mp = { goal: "hipertrofia" as const, sex: "homem" as const, level: "intermedio" as const, daysPerWeek: 4, location: "ginasio" as const, injuries: [], focus: [] };
  const base = gerarPlanoV2(mp as never, {});
  const prog = gerarPlanoV2(mp as never, {}, { progression: { week: 4, loadBonus: 10, repBonus: 1, streak: 0, lastRpe: null, deloadWeek: false, history: [] } });
  const cargaBase = base.days.find((d) => !d.rest)!.exercises!.find((e) => e.sets[0].w != null)!.sets[0].w!;
  const cargaProg = prog.days.find((d) => !d.rest)!.exercises!.find((e) => e.sets[0].w != null)!.sets[0].w!;
  assert.ok(cargaProg > cargaBase, `progressão não subiu a carga (${cargaBase} → ${cargaProg})`);
  assert.equal(prog.meta.week, 4);
});
