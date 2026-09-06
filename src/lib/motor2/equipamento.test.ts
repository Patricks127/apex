/* ============================================================
   APEX — Motor v2 · Casa + Ginásio

   Parte 1 (modelo de dados): `equipamentoPorDia` descreve a semana
   corretamente; nessa altura era inerte (o seletor ainda não a lia).

   Parte 2 (este ficheiro, secção de baixo): o seletor passa a ler
   `equipamentoPorDia` — candidatos por dia, âncoras pesadas
   (agachamento/terra/supino com barra) atribuídas aos dias de ginásio,
   `validarDia` continua a ser a porta única em todos os dias.
   ============================================================ */

import test from "node:test";
import assert from "node:assert/strict";
import {
  EQUIP_CASA_OMISSAO,
  EQUIP_DISPONIVEL,
  equipamentoCasaDe,
  equipamentoDaSemana,
  equipamentoPorDiaDe,
} from "./equipamento.ts";
import { gerarPlanoV2, perfilV2De } from "./plano.ts";
import { selecionarSemana, validarDia, type PerfilSelecao } from "./seletor.ts";
import type { MotorProfile } from "../motor/index.ts";
import type { Equipamento, Familia } from "./tipos.ts";

const mesmoSet = (a: Equipamento[], b: Equipamento[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

// ---------------------------------------------------------------------------
// equipamentoPorDiaDe
// ---------------------------------------------------------------------------

test("local fixo → todos os dias com o mesmo conjunto, um por dia de treino", () => {
  for (const local of ["ginasio", "parque", "outro"] as const) {
    for (const dias of [3, 4, 5, 6]) {
      const porDia = equipamentoPorDiaDe({ location: local, dias });
      assert.equal(porDia.length, dias, `${local}/${dias}d`);
      for (const d of porDia) assert.ok(mesmoSet(d, EQUIP_DISPONIVEL[local]));
    }
  }
});

test("local desconhecido cai no ginásio (não fica sem equipamento)", () => {
  const porDia = equipamentoPorDiaDe({ location: "nave_espacial", dias: 4 });
  assert.equal(porDia.length, 4);
  assert.ok(mesmoSet(porDia[0], EQUIP_DISPONIVEL.ginasio));
});

test("hibrido → N dias de ginásio + o resto em casa", () => {
  for (const dias of [3, 4, 5, 6]) {
    for (let ginasio = 1; ginasio < dias; ginasio++) {
      const porDia = equipamentoPorDiaDe({ location: "hibrido", dias, diasGinasio: ginasio });
      assert.equal(porDia.length, dias);
      const nGinasio = porDia.filter((d) => mesmoSet(d, EQUIP_DISPONIVEL.ginasio)).length;
      assert.equal(nGinasio, ginasio, `${dias}d com ${ginasio} no ginásio`);
      // os dias de casa são mesmo dias de casa: sem máquinas nem cabos
      for (const d of porDia.slice(ginasio)) {
        assert.ok(!d.includes("maquina") && !d.includes("cabos"));
      }
    }
  }
});

test("hibrido usa o conjunto COMPLETO de ginásio, não o antigo set único", () => {
  const [dia] = equipamentoPorDiaDe({ location: "hibrido", dias: 4, diasGinasio: 2 });
  assert.ok(mesmoSet(dia, EQUIP_DISPONIVEL.ginasio));
  // o set "hibrido" do v1 não tinha estes — um dia de ginásio é um dia de ginásio
  assert.ok(dia.includes("sled") && dia.includes("skierg"));
});

test("hibrido: diasGinasio ausente ou fora do intervalo é limitado aos dias", () => {
  assert.equal(equipamentoPorDiaDe({ location: "hibrido", dias: 4 }).length, 4);
  const todos = equipamentoPorDiaDe({ location: "hibrido", dias: 4, diasGinasio: 9 });
  assert.ok(todos.every((d) => mesmoSet(d, EQUIP_DISPONIVEL.ginasio)));
  const nenhum = equipamentoPorDiaDe({ location: "hibrido", dias: 4, diasGinasio: -2 });
  assert.ok(nenhum.every((d) => !mesmoSet(d, EQUIP_DISPONIVEL.ginasio)));
});

test("equipamento de casa: omissão quando não declarado, peso corporal sempre", () => {
  assert.ok(mesmoSet(equipamentoCasaDe(null), EQUIP_CASA_OMISSAO));
  assert.ok(mesmoSet(equipamentoCasaDe([]), EQUIP_CASA_OMISSAO));
  assert.ok(equipamentoCasaDe(["halteres"]).includes("peso_corporal"));
  assert.ok(mesmoSet(equipamentoCasaDe(["barra", "banco"]), ["barra", "banco", "peso_corporal"]));
});

test("equipamento declarado em casa chega aos dias de casa", () => {
  const porDia = equipamentoPorDiaDe({
    location: "hibrido",
    dias: 4,
    diasGinasio: 2,
    equipamentoCasa: ["barra", "banco"],
  });
  assert.ok(mesmoSet(porDia[3], ["barra", "banco", "peso_corporal"]));
  // location "casa" usa o mesmo conjunto em todos os dias
  const soCasa = equipamentoPorDiaDe({ location: "casa", dias: 3, equipamentoCasa: ["kettlebell"] });
  assert.ok(soCasa.every((d) => mesmoSet(d, ["kettlebell", "peso_corporal"])));
});

test("equipamentoDaSemana é a união sem repetições", () => {
  const porDia = equipamentoPorDiaDe({ location: "hibrido", dias: 4, diasGinasio: 2 });
  const uniao = equipamentoDaSemana(porDia);
  assert.equal(uniao.length, new Set(uniao).size);
  for (const d of porDia) for (const q of d) assert.ok(uniao.includes(q));
});

// ---------------------------------------------------------------------------
// integração com o perfil do motor
// ---------------------------------------------------------------------------

const mp = (o: Partial<MotorProfile> = {}): MotorProfile => ({
  goal: "hipertrofia",
  sex: "homem",
  level: "intermedio",
  daysPerWeek: 4,
  location: "hibrido",
  injuries: [],
  focus: [],
  ...o,
});

test("perfilV2De preenche equipamentoPorDia (e deriva-o quando o perfil não o traz)", () => {
  const derivado = perfilV2De(mp({ gymDaysPerWeek: 2 }));
  assert.equal(derivado.equipamentoPorDia?.length, 4);
  assert.equal(
    derivado.equipamentoPorDia!.filter((d) => mesmoSet(d, EQUIP_DISPONIVEL.ginasio)).length,
    2,
  );

  const explicito = perfilV2De(mp({ equipamentoPorDia: [["halteres"], ["banda"], ["barra"], ["trx"]] }));
  assert.deepEqual(explicito.equipamentoPorDia, [["halteres"], ["banda"], ["barra"], ["trx"]]);
});

test("PARTE 2: equipamentoPorDia deixou de ser inerte — muda o plano gerado", () => {
  // o campo `equipamento` (o pool "da semana", ainda usado pelos passos que
  // procuram por vários dias) continua a ser o do local.
  assert.ok(mesmoSet(perfilV2De(mp({ gymDaysPerWeek: 1 })).equipamento, EQUIP_DISPONIVEL.hibrido));

  const dias = (p: MotorProfile) => JSON.stringify(gerarPlanoV2(p, {}).days);
  const semDiasDeCasa = dias(mp({ gymDaysPerWeek: 4 })); // 4 de 4 — nenhum dia de casa
  const comDiasDeCasa = dias(mp({ gymDaysPerWeek: 2 })); // 2 de 4 — alternância real
  assert.notEqual(comDiasDeCasa, semDiasDeCasa, "equipamentoPorDia devia mudar os exercícios escolhidos");
});

// ===========================================================================
// PARTE 2 — o seletor por dia (candidatosPorDia + atribuição de dias-tipo)
// ===========================================================================

function perfilHibrido(o: {
  dias: number;
  diasGinasio: number;
  nivel?: PerfilSelecao["nivel"];
  splitFormato?: PerfilSelecao["splitFormato"];
}): PerfilSelecao {
  const equipamentoPorDia = equipamentoPorDiaDe({ location: "hibrido", dias: o.dias, diasGinasio: o.diasGinasio });
  return {
    objetivo: "hipertrofia",
    nivel: o.nivel ?? "intermedio",
    dias: o.dias,
    equipamento: equipamentoDaSemana(equipamentoPorDia),
    equipamentoPorDia,
    lesoes: [],
    foco: [],
    splitFormato: o.splitFormato,
  };
}

// A ordem dos dias-tipo do split nunca muda (parte 2 mapeia EQUIPAMENTO por
// posição, não dias-tipo) — por isso os testes classificam "dia de casa" vs
// "dia de ginásio" pelo `equipamento` de cada `DiaSelecionado`, nunca por
// índice fixo.
const ehDiaDeGinasio = (dia: { equipamento: Equipamento[] }) => dia.equipamento.includes("barra");

test("Híbrido 5d/3 ginásio: os 2 dias de casa não têm exercício que exija barra, máquina ou cabos", () => {
  const perfil = perfilHibrido({ dias: 5, diasGinasio: 3 });
  const semana = selecionarSemana(perfil);
  const diasCasa = semana.dias.filter((d) => !ehDiaDeGinasio(d));
  assert.equal(diasCasa.length, 2, `esperava 2 dias de casa, houve ${diasCasa.length}`);
  for (const dia of diasCasa) {
    const casaSet = new Set(dia.equipamento);
    assert.ok(!casaSet.has("barra") && !casaSet.has("maquina") && !casaSet.has("cabos"));
    for (const ex of dia.exercicios) {
      assert.ok(
        ex.exercicio.equipamento.some((q) => casaSet.has(q)),
        `${dia.nome} (dia de casa): "${ex.exercicio.nome}" (equip=${ex.exercicio.equipamento.join(",")}) não é possível com o equipamento de casa`,
      );
    }
  }
});

test("Híbrido 5d/3 ginásio: os dias de ginásio mantêm as âncoras pesadas (agachamento/terra com barra); os de casa não", () => {
  const perfil = perfilHibrido({ dias: 5, diasGinasio: 3 });
  const semana = selecionarSemana(perfil);
  const ANCORAS_INFERIOR: Familia[] = ["squat", "hinge"];
  const temT1DeBarra = (dia: (typeof semana.dias)[number]) =>
    dia.exercicios.some(
      (e) => ANCORAS_INFERIOR.includes(e.exercicio.familia) && e.exercicio.tier === 1 && e.exercicio.equipamento.includes("barra"),
    );
  const diasGinasio = semana.dias.filter(ehDiaDeGinasio);
  const diasCasa = semana.dias.filter((d) => !ehDiaDeGinasio(d));
  assert.equal(diasGinasio.length, 3);
  assert.ok(diasGinasio.some(temT1DeBarra), "nenhum dia de ginásio tem agachamento/terra com barra (Tier 1)");
  assert.ok(!diasCasa.some(temT1DeBarra), "um dia de casa ficou com agachamento/terra de barra — devia ter ido para o ginásio");
});

test("Híbrido: grupos grandes nunca ficam em dias consecutivos, mesmo depois de mapear o equipamento por necessidade", () => {
  // regressão: uma primeira versão da atribuição REORDENAVA os dias-tipo e
  // podia pôr "Inferior" ao lado de "Pernas" (os dois de quad/isquio/gluteo)
  // — a ordem do split já evitava isto; mapear o EQUIPAMENTO em vez do
  // dia-tipo tinha de preservar essa garantia.
  const GRANDES = new Set(["peito", "dorsais", "quadriceps", "isquiotibiais", "gluteo"]);
  const combos = [
    { dias: 4, ginasio: 1 }, { dias: 4, ginasio: 2 }, { dias: 4, ginasio: 3 },
    { dias: 5, ginasio: 1 }, { dias: 5, ginasio: 2 }, { dias: 5, ginasio: 3 }, { dias: 5, ginasio: 4 },
    { dias: 6, ginasio: 1 }, { dias: 6, ginasio: 2 }, { dias: 6, ginasio: 3 }, { dias: 6, ginasio: 4 }, { dias: 6, ginasio: 5 },
  ];
  for (const splitFormato of ["frequencia", "muscular"] as const) {
    for (const c of combos) {
      const perfil = perfilHibrido({ dias: c.dias, diasGinasio: c.ginasio, splitFormato });
      const semana = selecionarSemana(perfil);
      for (let i = 1; i < semana.dias.length; i++) {
        const a = new Set(semana.dias[i - 1].musculosAlvo.filter((m) => GRANDES.has(m)));
        const clash = semana.dias[i].musculosAlvo.filter((m) => GRANDES.has(m) && a.has(m));
        assert.equal(
          clash.length,
          0,
          `${splitFormato} ${c.dias}d/${c.ginasio}gin: "${semana.dias[i - 1].nome}" → "${semana.dias[i].nome}" repetem grupo grande (${clash.join(",")})`,
        );
      }
    }
  }
});

test("Híbrido: nenhum dia viola validarDia (vários dias/ginásio, frequência e muscular)", () => {
  const combos = [
    { dias: 3, ginasio: 1 },
    { dias: 3, ginasio: 2 },
    { dias: 4, ginasio: 1 },
    { dias: 4, ginasio: 2 },
    { dias: 4, ginasio: 3 },
    { dias: 5, ginasio: 1 },
    { dias: 5, ginasio: 2 },
    { dias: 5, ginasio: 3 },
    { dias: 5, ginasio: 4 },
    { dias: 6, ginasio: 1 },
    { dias: 6, ginasio: 3 },
    { dias: 6, ginasio: 5 },
  ];
  let diasVerificados = 0;
  for (const splitFormato of ["frequencia", "muscular"] as const) {
    const muscular = splitFormato === "muscular";
    for (const c of combos) {
      const perfil = perfilHibrido({ dias: c.dias, diasGinasio: c.ginasio, splitFormato });
      const semana = selecionarSemana(perfil);
      for (const d of semana.dias) {
        diasVerificados++;
        const vistos: (typeof d.exercicios)[number]["exercicio"][] = [];
        for (const e of d.exercicios) {
          const motivo = validarDia(e.exercicio, vistos, d.musculosAlvo, muscular);
          assert.equal(
            motivo,
            null,
            `${splitFormato} ${c.dias}d/${c.ginasio}gin: "${d.nome}" tem ${e.exercicio.id} que a porta recusaria — ${motivo}`,
          );
          vistos.push(e.exercicio);
        }
      }
    }
  }
  assert.ok(diasVerificados > 100, `poucos dias verificados (${diasVerificados})`);
});

test("Híbrido: volume semanal por músculo dentro do intervalo (dias de casa não deixam buracos)", () => {
  const combos = [
    { dias: 4, ginasio: 1 },
    { dias: 4, ginasio: 2 },
    { dias: 4, ginasio: 3 },
    { dias: 5, ginasio: 1 },
    { dias: 5, ginasio: 2 },
    { dias: 5, ginasio: 3 },
    { dias: 5, ginasio: 4 },
    { dias: 6, ginasio: 2 },
    { dias: 6, ginasio: 4 },
  ];
  const GRANDES = ["peito", "dorsais", "quadriceps", "isquiotibiais", "gluteo"] as const;
  for (const c of combos) {
    const perfil = perfilHibrido({ dias: c.dias, diasGinasio: c.ginasio });
    const semana = selecionarSemana(perfil);
    for (const v of semana.volume.porMusculo) {
      assert.notEqual(v.estado, "acima_teto", `${c.dias}d/${c.ginasio}gin: ${v.musculo} acima do teto (${v.direto})`);
    }
    for (const m of GRANDES) {
      const vm = semana.volume.porMusculo.find((x) => x.musculo === m);
      if (!vm) continue;
      // abaixo de 8 só é aceitável com um aviso a explicar a limitação (mesmo
      // padrão já usado para lesão/equipamento — spec §4.1)
      const explicado = semana.avisos.some((a) => a.includes(m));
      assert.ok(
        vm.acimaMinimoAbsoluto || explicado,
        `${c.dias}d/${c.ginasio}gin: ${m} abaixo de 8 séries sem aviso (${vm.direto})`,
      );
    }
  }
});
