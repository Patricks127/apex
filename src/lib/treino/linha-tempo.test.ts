import test from "node:test";
import assert from "node:assert/strict";
import { construirLinhaTempo, indiceDiaSemanaHoje, proximoDiaDeTreino } from "./linha-tempo.ts";
import type { DiaGerado, ExercicioGerado, Movimento } from "@/lib/motor";

function exercicio(nome: string, nSets: number, rest = "90 s"): ExercicioGerado {
  return {
    name: nome,
    swap: null,
    sets: Array.from({ length: nSets }, () => ({ w: 50, reps: 8, rpe: "RIR 2" })),
    rest,
    muscle: "peito",
    bw: false,
    substituted: false,
  };
}

const AQUECIMENTO: Movimento[] = [{ name: "Bicicleta", dose: "3 min" }];
const ALONGAMENTO: Movimento[] = [{ name: "Peito na porta", dose: "2×20s" }];

const DIA_BASE: DiaGerado = {
  dayIndex: 0,
  dayName: "Segunda",
  dayShort: "Seg",
  rest: false,
  title: "Peito e tríceps",
  warmup: AQUECIMENTO,
  cooldown: ALONGAMENTO,
  exercises: [exercicio("Supino com barra", 4), exercicio("Crucifixo", 3), exercicio("Tríceps corda", 3)],
};

test("ordem dos blocos: aquecimento, exercício, descanso, exercício, descanso, exercício, alongamento", () => {
  const { itens } = construirLinhaTempo(DIA_BASE, { estadoDia: "hoje_por_comecar" });
  assert.deepEqual(
    itens.map((i) => i.tipo),
    ["aquecimento", "exercicio", "descanso", "exercicio", "descanso", "exercicio", "alongamento"],
  );
});

test("sem descanso depois do ÚLTIMO exercício — a seguir vem o alongamento diretamente", () => {
  const { itens } = construirLinhaTempo(DIA_BASE, { estadoDia: "hoje_por_comecar" });
  const ultimoExercicioIdx = itens.map((i) => i.tipo).lastIndexOf("exercicio");
  assert.equal(itens[ultimoExercicioIdx + 1]?.tipo, "alongamento");
});

test("um só exercício → nenhum bloco de descanso (não há entre-exercícios)", () => {
  const dia: DiaGerado = { ...DIA_BASE, warmup: undefined, cooldown: undefined, exercises: [exercicio("Supino", 4)] };
  const { itens } = construirLinhaTempo(dia, { estadoDia: "hoje_por_comecar" });
  assert.deepEqual(itens.map((i) => i.tipo), ["exercicio"]);
});

test("dia já feito → todos os blocos 'feito', nada por fazer", () => {
  const { itens, duracaoRestanteMin } = construirLinhaTempo(DIA_BASE, { estadoDia: "feito" });
  assert.ok(itens.every((i) => i.estado === "feito"));
  assert.equal(duracaoRestanteMin, 0);
});

test("dia neutro (não é hoje) → tudo 'por fazer', sem 'a decorrer'", () => {
  const { itens, duracaoRestanteMin, duracaoTotalMin } = construirLinhaTempo(DIA_BASE, { estadoDia: "neutro" });
  assert.ok(itens.every((i) => i.estado === "por_fazer"));
  assert.equal(duracaoRestanteMin, duracaoTotalMin);
});

test("dia por fazer → só o primeiro bloco 'a decorrer', resto 'por fazer'; restante ≈ total", () => {
  const { itens, duracaoTotalMin, duracaoRestanteMin } = construirLinhaTempo(DIA_BASE, { estadoDia: "hoje_por_comecar" });
  assert.equal(itens[0]?.estado, "a_decorrer");
  assert.ok(itens.slice(1).every((i) => i.estado === "por_fazer"));
  // arredondamento por bloco pode diferir do total em ±1min por bloco somado
  assert.ok(Math.abs(duracaoRestanteMin - duracaoTotalMin) <= itens.length);
});

test("hora cumulativa: cada bloco começa onde o anterior acabou", () => {
  const { itens } = construirLinhaTempo(DIA_BASE, { estadoDia: "hoje_por_comecar" });
  let esperado = 0;
  for (const item of itens) {
    assert.equal(item.inicioMin, esperado);
    esperado += item.duracaoMin;
  }
});

test("descanso lê o número de 'rest' (\"90 s\" → 2min arredondado)", () => {
  const dia: DiaGerado = {
    ...DIA_BASE,
    warmup: undefined,
    cooldown: undefined,
    exercises: [exercicio("A", 1, "90 s"), exercicio("B", 1)],
  };
  const { itens } = construirLinhaTempo(dia, { estadoDia: "hoje_por_comecar" });
  const descanso = itens.find((i) => i.tipo === "descanso");
  assert.equal(descanso?.duracaoMin, 2); // round(90/60) = 2
});

test("descanso sem número reconhecível não rebenta — cai na estimativa fixa", () => {
  const dia: DiaGerado = {
    ...DIA_BASE,
    warmup: undefined,
    cooldown: undefined,
    exercises: [exercicio("A", 1, "—"), exercicio("B", 1)],
  };
  const { itens } = construirLinhaTempo(dia, { estadoDia: "hoje_por_comecar" });
  const descanso = itens.find((i) => i.tipo === "descanso");
  assert.equal(descanso?.duracaoMin, 1); // round(60/60) = 1
});

test("indiceDiaSemanaHoje: 0=Segunda…6=Domingo (Date#getDay() é 0=Domingo)", () => {
  assert.equal(indiceDiaSemanaHoje(new Date("2026-09-07T12:00:00Z")), 0); // segunda
  assert.equal(indiceDiaSemanaHoje(new Date("2026-09-06T12:00:00Z")), 6); // domingo
  assert.equal(indiceDiaSemanaHoje(new Date("2026-09-10T12:00:00Z")), 3); // quinta
});

test("dia de descanso (sem warmup/exercises/cooldown) → linha do tempo vazia", () => {
  const dia: DiaGerado = { dayIndex: 1, dayName: "Terça", dayShort: "Ter", rest: true };
  const { itens, duracaoTotalMin } = construirLinhaTempo(dia, { estadoDia: "hoje_por_comecar" });
  assert.deepEqual(itens, []);
  assert.equal(duracaoTotalMin, 0);
});

// ---------------------------------------------------------------------------
// proximoDiaDeTreino — "hoje é descanso, o próximo treino é quarta" (painel)
// ---------------------------------------------------------------------------

function semana3x(diasTreino: number[]): DiaGerado[] {
  return Array.from({ length: 7 }, (_, i) =>
    diasTreino.includes(i) ? { ...DIA_BASE, dayIndex: i } : { dayIndex: i, dayName: "x", dayShort: "x", rest: true },
  );
}

test("proximoDiaDeTreino: amanhã (offset 1) quando o dia seguinte é treino", () => {
  const dias = semana3x([0, 2, 4]); // seg/qua/sex
  const r = proximoDiaDeTreino(dias, 1); // hoje = terça
  assert.equal(r?.offset, 1);
  assert.equal(r?.dia.dayIndex, 2);
});

test("proximoDiaDeTreino: salta dias de descanso até encontrar treino", () => {
  const dias = semana3x([0, 2, 4]);
  const r = proximoDiaDeTreino(dias, 4); // hoje = sexta (treino) → próximo é segunda
  assert.equal(r?.offset, 3);
  assert.equal(r?.dia.dayIndex, 0);
});

test("proximoDiaDeTreino: dá a volta à semana (hoje = domingo, próximo = segunda)", () => {
  const dias = semana3x([0, 2, 4]);
  const r = proximoDiaDeTreino(dias, 6);
  assert.equal(r?.offset, 1);
  assert.equal(r?.dia.dayIndex, 0);
});

test("proximoDiaDeTreino: null só quando a semana inteira é descanso", () => {
  const dias = semana3x([]);
  assert.equal(proximoDiaDeTreino(dias, 0), null);
});

test("proximoDiaDeTreino: nunca devolve o próprio hoje, mesmo sendo treino", () => {
  const dias = semana3x([0]); // só segunda tem treino
  const r = proximoDiaDeTreino(dias, 0); // hoje já é o único dia de treino
  assert.equal(r?.offset, 7); // só volta a acontecer daqui a 7 dias
  assert.equal(r?.dia.dayIndex, 0);
});
