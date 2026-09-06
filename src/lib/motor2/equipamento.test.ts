/* ============================================================
   APEX — Motor v2 · Casa + Ginásio, parte 1 (modelo de dados)

   Estes testes fixam duas coisas:
   a) `equipamentoPorDia` descreve a semana corretamente;
   b) a parte 1 é INERTE — o seletor ainda não lê o campo, e os planos gerados
      são bit-a-bit os mesmos de antes. A parte 2 vira este último teste do
      avesso (aí os dias de casa TÊM de diferir dos de ginásio).
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
import type { MotorProfile } from "../motor/index.ts";
import type { Equipamento } from "./tipos.ts";

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

test("PARTE 1 é inerte: o conjunto plano e o plano gerado não mudam", () => {
  // o campo `equipamento` (o que o seletor lê hoje) continua a ser o do local
  assert.ok(mesmoSet(perfilV2De(mp({ gymDaysPerWeek: 1 })).equipamento, EQUIP_DISPONIVEL.hibrido));

  const dias = (p: MotorProfile) => JSON.stringify(gerarPlanoV2(p, {}).days);
  const semAlternancia = dias(mp());
  assert.equal(dias(mp({ gymDaysPerWeek: 1 })), semAlternancia);
  assert.equal(
    dias(mp({ gymDaysPerWeek: 3, equipamentoPorDia: [["halteres", "peso_corporal"]] })),
    semAlternancia,
  );
});
