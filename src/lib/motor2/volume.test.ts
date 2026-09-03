import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularVolume,
  volumeDireto,
  INTERVALO_VOLUME,
  type EntradaVolume,
  type EstadoVolume,
  type Musculo,
  type Nivel,
} from "./index.ts";

const vm = (rel: ReturnType<typeof calcularVolume>, m: Musculo) =>
  rel.porMusculo.find((x) => x.musculo === m);

// ===========================================================================
// 1. O exemplo da especificação (§2.1)
// ===========================================================================
test("exemplo da spec: 1 série de supino → peito 1.0, tríceps 0.5, deltoide anterior 0.5", () => {
  const rel = calcularVolume([{ exercicioId: "supino_barra", series: 1 }], "intermedio");
  assert.equal(vm(rel, "peito")!.direto, 1.0);
  assert.equal(vm(rel, "peito")!.primario, 1.0);
  assert.equal(vm(rel, "peito")!.secundario, 0);
  assert.equal(vm(rel, "triceps")!.direto, 0.5);
  assert.equal(vm(rel, "triceps")!.secundario, 0.5);
  assert.equal(vm(rel, "deltoide_anterior")!.direto, 0.5);
  // 4 séries de supino → peito 4.0, tríceps 2.0, deltoide anterior 2.0
  const rel4 = calcularVolume([{ exercicioId: "supino_barra", series: 4 }], "intermedio");
  assert.equal(vm(rel4, "peito")!.direto, 4.0);
  assert.equal(vm(rel4, "triceps")!.direto, 2.0);
  assert.equal(vm(rel4, "deltoide_anterior")!.direto, 2.0);
});

// ===========================================================================
// 2. Três press no mesmo dia → sobrecarga de tríceps e deltoide anterior
// ===========================================================================
test("plano com 3 press acusa sobrecarga de tríceps e deltoide anterior (mas não de peito)", () => {
  // Semana de um iniciante (teto 14) construída à volta de 3 press + isolamento.
  const plano: EntradaVolume = [
    { exercicioId: "supino_barra", series: 5 },
    { exercicioId: "supino_inclinado_halteres", series: 5 },
    { exercicioId: "press_militar_barra", series: 6 },
    { exercicioId: "press_halteres_sentado", series: 4 },
    { exercicioId: "triceps_pushdown_corda", series: 4 },
    { exercicioId: "extensao_triceps_overhead_cabo", series: 4 },
  ];
  const rel = calcularVolume(plano, "iniciante");

  assert.equal(vm(rel, "triceps")!.estado, "acima_teto", `tríceps=${vm(rel, "triceps")!.direto}`);
  assert.equal(
    vm(rel, "deltoide_anterior")!.estado,
    "acima_teto",
    `delt.ant=${vm(rel, "deltoide_anterior")!.direto}`,
  );
  // o peito NÃO é o problema — os press são bons para o peito, o custo é nos secundários
  assert.equal(vm(rel, "peito")!.estado, "dentro", `peito=${vm(rel, "peito")!.direto}`);

  assert.ok(rel.avisos.some((a) => /triceps/.test(a) && /TETO/.test(a)));
  assert.ok(rel.avisos.some((a) => /deltoide_anterior/.test(a) && /TETO/.test(a)));
  assert.ok(!rel.avisos.some((a) => /^peito/.test(a)));
});

// ===========================================================================
// 3. Os intervalos por nível da tabela §2.1
// ===========================================================================
test("estados batem com os intervalos por nível (tabela §2.1)", () => {
  // peck deck: primário peito, sem secundários → N séries dão peito = N exatamente.
  const peitoEm = (n: number, nivel: Nivel): EstadoVolume =>
    vm(calcularVolume([{ exercicioId: "peck_deck", series: n }], nivel), "peito")!.estado;

  const casos: Record<Nivel, [number, EstadoVolume][]> = {
    iniciante: [
      [7, "abaixo"], [8, "dentro"], [12, "dentro"],
      [13, "acima_alvo"], [14, "acima_alvo"], [15, "acima_teto"],
    ],
    intermedio: [
      [11, "abaixo"], [12, "dentro"], [18, "dentro"],
      [19, "acima_alvo"], [20, "acima_alvo"], [21, "acima_teto"],
    ],
    avancado: [
      [13, "abaixo"], [14, "dentro"], [22, "dentro"],
      [23, "acima_alvo"], [25, "acima_alvo"], [26, "acima_teto"],
    ],
  };

  for (const nivel of Object.keys(casos) as Nivel[]) {
    for (const [n, esperado] of casos[nivel]) {
      assert.equal(
        peitoEm(n, nivel),
        esperado,
        `${nivel}: ${n} séries de peito → esperado '${esperado}'`,
      );
    }
  }

  // e os limites da tabela estão como na spec
  assert.deepEqual(INTERVALO_VOLUME.iniciante, { min: 8, max: 12, teto: 14 });
  assert.deepEqual(INTERVALO_VOLUME.intermedio, { min: 12, max: 18, teto: 20 });
  assert.deepEqual(INTERVALO_VOLUME.avancado, { min: 14, max: 22, teto: 25 });
});

test("mínimo absoluto de 8 séries (§4.1) sinalizado independentemente do nível", () => {
  const rel = calcularVolume([{ exercicioId: "peck_deck", series: 7 }], "avancado");
  const p = vm(rel, "peito")!;
  assert.equal(p.estado, "abaixo");
  assert.equal(p.acimaMinimoAbsoluto, false);
  const rel8 = calcularVolume([{ exercicioId: "peck_deck", series: 8 }], "avancado");
  assert.equal(vm(rel8, "peito")!.acimaMinimoAbsoluto, true);
});

// ===========================================================================
// 4. Rácio empurrar:puxar
// ===========================================================================
test("rácio empurrar:puxar calculado corretamente", () => {
  // lado empurrar (só músculos de empurrar, sem secundários):
  //   peck_deck 6  → peito 6
  //   triceps_pushdown_corda 6 → tríceps 6
  //   elevacao_lateral_maquina 6 → deltoide_lateral 6      => empurrar = 18
  // lado puxar:
  //   band_pull_apart 6 → deltoide_posterior 6 + trapézio_médio 6
  //   rosca_inclinado_halteres 6 → bíceps 6                => puxar = 18
  const equilibrado = calcularVolume(
    [
      { exercicioId: "peck_deck", series: 6 },
      { exercicioId: "triceps_pushdown_corda", series: 6 },
      { exercicioId: "elevacao_lateral_maquina", series: 6 },
      { exercicioId: "band_pull_apart", series: 6 },
      { exercicioId: "rosca_inclinado_halteres", series: 6 },
    ],
    "intermedio",
  );
  assert.equal(equilibrado.racioEmpurrarPuxar.empurrar, 18);
  assert.equal(equilibrado.racioEmpurrarPuxar.puxar, 18);
  assert.equal(equilibrado.racioEmpurrarPuxar.racio, 1);
  assert.equal(equilibrado.racioEmpurrarPuxar.equilibrado, true);
  assert.ok(!equilibrado.avisos.some((a) => /empurrar:puxar/.test(a)));

  // push-heavy: empurrar 20, puxar 10 → 2:1 → desequilibrado, avisa "falta puxar"
  const pushHeavy = calcularVolume(
    [
      { exercicioId: "peck_deck", series: 20 },
      { exercicioId: "band_pull_apart", series: 5 }, // dp 5 + tm 5 = puxar 10
    ],
    "avancado",
  );
  assert.equal(pushHeavy.racioEmpurrarPuxar.empurrar, 20);
  assert.equal(pushHeavy.racioEmpurrarPuxar.puxar, 10);
  assert.equal(pushHeavy.racioEmpurrarPuxar.racio, 2);
  assert.equal(pushHeavy.racioEmpurrarPuxar.equilibrado, false);
  assert.ok(pushHeavy.avisos.some((a) => /empurrar:puxar/.test(a) && /puxar/.test(a)));

  // pull-heavy: 0.5:1 → avisa "falta empurrar"
  const pullHeavy = calcularVolume(
    [
      { exercicioId: "peck_deck", series: 5 },
      { exercicioId: "band_pull_apart", series: 10 }, // puxar 20
    ],
    "avancado",
  );
  assert.equal(pullHeavy.racioEmpurrarPuxar.racio, 0.25);
  assert.equal(pullHeavy.racioEmpurrarPuxar.equilibrado, false);
  assert.ok(pullHeavy.avisos.some((a) => /empurrar:puxar/.test(a) && /empurrar/.test(a)));

  // dentro de ±30% continua equilibrado: 13 vs 10 → 1.3
  const limite = calcularVolume(
    [
      { exercicioId: "peck_deck", series: 13 },
      { exercicioId: "band_pull_apart", series: 5 },
    ],
    "avancado",
  );
  assert.equal(limite.racioEmpurrarPuxar.racio, 1.3);
  assert.equal(limite.racioEmpurrarPuxar.equilibrado, true);
});

// ===========================================================================
// robustez
// ===========================================================================
test("linhas do mesmo exercício somam-se; ids desconhecidos são ignorados com aviso", () => {
  const rel = calcularVolume(
    [
      { exercicioId: "peck_deck", series: 3, dia: 1 },
      { exercicioId: "peck_deck", series: 4, dia: 4 },
      { exercicioId: "exercicio_que_nao_existe", series: 5 },
    ],
    "intermedio",
  );
  assert.equal(vm(rel, "peito")!.direto, 7);
  assert.ok(rel.avisos.some((a) => /desconhecido/i.test(a)));
});

test("volumeDireto: helper coincide com o relatório", () => {
  const plano: EntradaVolume = [
    { exercicioId: "supino_barra", series: 4 },
    { exercicioId: "supino_inclinado_halteres", series: 4 },
  ];
  assert.equal(volumeDireto(plano, "peito"), 8);
  assert.equal(volumeDireto(plano, "triceps"), 4); // 2 + 2 (ambos secundários)
  assert.equal(volumeDireto(plano, "deltoide_anterior"), 4);
  assert.equal(volumeDireto(plano, "gluteo"), 0);
});
