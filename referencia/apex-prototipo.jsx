import React, { useState, useEffect, useRef } from "react";

/* ============================================================
   APEX — Planning Engine v6 (semana navegável + splits detalhados)
   Cada dia da semana produz a sua própria sessão completa.
   O utilizador pode abrir qualquer dia, começá-lo, e reordenar
   os exercícios dentro da sessão.
   ============================================================ */

const round25 = (x) => Math.max(10, Math.round(x / 2.5) * 2.5);

const E1RM = {
  iniciante: { agachamento: 60, terra: 80, supino: 42, press: 30 },
  intermedio: { agachamento: 105, terra: 140, supino: 75, press: 50 },
  avancado: { agachamento: 145, terra: 185, supino: 108, press: 68 },
};
const SEX_MULT = {
  homem: { agachamento: 1, terra: 1, supino: 1, press: 1 },
  mulher: { agachamento: 0.72, terra: 0.72, supino: 0.55, press: 0.55 },
};
const LIFT_LABEL = { agachamento: "Agachamento", terra: "Levantamento terra", supino: "Supino", press: "Press militar" };
const HYPERTROPHY_GOALS = ["forca"];
const STRENGTH_LIFT_GOALS = ["forca", "powerlifting", "hibrido"];
const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const GOALS = [
  { id: "forca", label: "Ganhar músculo (hipertrofia)", short: "Hipertrofia" },
  { id: "powerlifting", label: "Powerlifting / força máxima", short: "Força máxima" },
  { id: "hibrido", label: "Ser híbrido: forte E resistente", short: "Híbrido" },
  { id: "hyrox", label: "Competir em Hyrox", short: "Hyrox" },
  { id: "resistencia", label: "Correr melhor / mais longe", short: "Corrida" },
  { id: "calistenia", label: "Calistenia / peso corporal", short: "Calistenia" },
];

const REHAB = {
  ombro: [{ name: "Rotação externa com banda", dose: "2×15/lado" }, { name: "Face pull leve", dose: "2×15" }],
  joelho: [{ name: "Extensão terminal c/ banda", dose: "2×15" }, { name: "Elevação de perna estendida", dose: "2×12/lado" }],
  lombar: [{ name: "Bird-dog", dose: "2×10/lado" }, { name: "Dead bug", dose: "2×10" }],
  anca: [{ name: "Clamshell c/ banda", dose: "2×15/lado" }, { name: "Ponte de glúteo", dose: "2×12" }],
  cotovelo: [{ name: "Flexão/extensão de punho leve", dose: "2×15" }, { name: "Supinação com halter", dose: "2×12/lado" }],
  tornozelo: [{ name: "Dorsiflexão c/ banda", dose: "2×15/lado" }, { name: "Elevação de gémeos controlada", dose: "2×15" }],
  pescoco: [{ name: "Retração cervical (chin tuck)", dose: "2×10" }, { name: "Mobilidade suave de pescoço", dose: "2×8/lado" }],
  pulso: [{ name: "Mobilidade de punho em apoio", dose: "2×10" }, { name: "Alongamento de flexores do punho", dose: "2×20s" }],
};

const FOCUS_WORK = {
  gluteo: { label: "Glúteo", ex: { ginasio: "Hip thrust c/ pausa", casa: "Elevação de anca a 1 perna", parque: "Elevação de anca a 1 perna" }, reps: 12, day: "pernas" },
  peito: { label: "Peitoral", ex: { ginasio: "Aberturas / cross-over", casa: "Flexões com pausa", parque: "Fundos com inclinação" }, reps: 12, day: "peito" },
  costas: { label: "Costas", ex: { ginasio: "Puxada na barra", casa: "Remada com elástico", parque: "Remada invertida" }, reps: 10, day: "costas" },
  ombros: { label: "Ombros", ex: { ginasio: "Elevações laterais", casa: "Pike push-ups", parque: "Pike push-ups" }, reps: 12, day: "ombros" },
  bracos: { label: "Braços", ex: { ginasio: "Rosca + tríceps corda", casa: "Rosca halteres + fundos banco", parque: "Elevações supinadas + fundos" }, reps: 10, day: "bracos" },
  core: { label: "Core", ex: { ginasio: "Prancha com carga", casa: "Dead bug + prancha", parque: "Elevações de pernas na barra" }, reps: 10, day: "core" },
};

const WARMUPS = {
  strength_lower: [{ name: "Bicicleta / passadeira fácil", dose: "3 min" }, { name: "Mobilidade de anca (90/90)", dose: "1 min/lado" }, { name: "Séries de aproximação", dose: "2–3 leves" }],
  strength_upper: [{ name: "Remo / corda fácil", dose: "3 min" }, { name: "Rotações de ombro c/ banda", dose: "15 reps" }, { name: "Band pull-apart", dose: "20 reps" }, { name: "Séries de aproximação", dose: "2–3 leves" }],
  power: [{ name: "Cardio leve", dose: "3 min" }, { name: "Mobilidade articular", dose: "2 min" }, { name: "Rampas até carga alvo", dose: "4–5 séries" }],
  run_easy: [{ name: "Caminhada rápida", dose: "3 min" }, { name: "Mobilidade dinâmica", dose: "2 min" }, { name: "Progressão até Z2", dose: "5 min" }],
  run_hard: [{ name: "Corrida fácil progressiva", dose: "10 min" }, { name: "Drills (skipping)", dose: "2×20 m" }, { name: "Acelerações", dose: "4×80 m" }],
  hyrox: [{ name: "Row / bike fácil", dose: "5 min" }, { name: "Mobilidade full-body", dose: "3 min" }, { name: "Ativação leve", dose: "2×10" }],
  calisthenics: [{ name: "Cardio leve", dose: "3 min" }, { name: "Mobilidade ombro/punho", dose: "2 min" }, { name: "Progressões do skill", dose: "2 séries" }],
};
const COOLDOWNS = {
  lower: [{ name: "Along. quadríceps", dose: "30s/lado" }, { name: "Along. isquiotibiais", dose: "30s/lado" }, { name: "Along. flexores da anca", dose: "30s/lado" }],
  upper: [{ name: "Along. peito na porta", dose: "30s" }, { name: "Along. tríceps", dose: "30s/lado" }, { name: "Along. dorsais", dose: "30s/lado" }],
  run: [{ name: "Retorno à calma a andar", dose: "3 min" }, { name: "Along. gémeos", dose: "30s/lado" }, { name: "Along. isquiotibiais", dose: "30s/lado" }],
  hyrox: [{ name: "Row muito leve", dose: "3 min" }, { name: "Along. full-body", dose: "3 min" }],
  full: [{ name: "Along. full-body suave", dose: "3–4 min" }, { name: "Respiração diafragmática", dose: "1 min" }],
};

function macroPhase(weeksOut) {
  if (weeksOut == null) return null;
  if (weeksOut <= 1) return { idx: 2, name: "Taper", desc: "Reduzir volume, manter intensidade — chegar fresco à prova." };
  if (weeksOut <= 4) return { idx: 1, name: "Intensificação", desc: "Especificidade máxima: os movimentos da prova, ao ritmo da prova." };
  return { idx: 0, name: "Acumulação", desc: "Construir a base: volume e capacidade de trabalho." };
}
function weeksUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  if (isNaN(diff) || diff < 0) return null;
  return Math.max(1, Math.ceil(diff / (7 * 24 * 3600 * 1000)));
}

function baseLifts(profile, maxes) {
  const mult = SEX_MULT[profile.sex] || SEX_MULT.homem;
  const lvl = {}; const usedReal = [];
  Object.keys(E1RM[profile.level]).forEach((k) => {
    if (maxes && maxes[k]) { lvl[k] = maxes[k]; usedReal.push(k); }
    else lvl[k] = E1RM[profile.level][k] * mult[k];
  });
  return { lvl, usedReal };
}
function swapNote(group, profile) {
  const { injuries } = profile;
  return {
    agachamento: injuries.includes("joelho") ? "Protege o joelho" : null,
    terra: injuries.includes("lombar") ? "Sem carga axial na lombar" : null,
    supino: injuries.includes("ombro") ? "Pega neutra (poupa ombro)" : null,
  }[group];
}
function setArr(n, w, reps, rpe) {
  return Array.from({ length: n }, () => ({ w, reps, rpe, done: false, loggedRpe: null }));
}
function ex(name, note, sets, rest, extra = {}) {
  return { name, swap: note, sets, rest, ...extra };
}

/* ============================================================
   SPLITS: para cada objetivo e nº de dias, define os dias da
   semana. Cada dia tem { label, type, cdType, build(ctx) }.
   'rest' marca dia de descanso.
   ============================================================ */

function hypDay(title, mainKey, exercises, focusDay) {
  return { label: title, type: mainKey === "agachamento" || mainKey === "terra" ? "strength_lower" : "strength_upper",
    cdType: mainKey === "agachamento" || mainKey === "terra" ? "lower" : "upper", focusDay,
    build: (c) => exercises(c) };
}

const REST = { label: "Descanso", rest: true };

// ---- Hipertrofia: split muscular clássico ----
function hypExercises(list) {
  return (c) => list.map((it) => {
    const w = it.pct ? round25(c.lvl[it.lift] * it.pct * c.loadMod) : null;
    const reps = it.reps > 0 ? it.reps + (c.repAdd || 0) : it.reps; // progressão dupla: +reps
    return ex(c.eq === "parque" && it.bwName ? it.bwName : it.name, it.lift ? swapNote(it.lift, c.profile) : null,
      setArr(Math.max(2, it.sets - c.setCut), w, reps, it.rpe || "7–8"), it.rest || "90 s", it.bwName && c.eq === "parque" ? { bw: true } : {});
  });
}
const HYP_SPLITS = {
  // 3 dias — Full-body A/B/C: cada músculo é treinado 3× por semana
  3: [
    hypDay("Full-body A (ênfase empurrar)", "supino", hypExercises([
      { name: "Supino com barra", lift: "supino", pct: 0.72, sets: 4, reps: 8 },
      { name: "Agachamento com barra", lift: "agachamento", pct: 0.7, sets: 3, reps: 8 },
      { name: "Remada curvada", lift: "terra", pct: 0.4, sets: 3, reps: 10 },
      { name: "Cadeira flexora (isquiotibiais)", lift: "agachamento", pct: 0.25, sets: 3, reps: 12, rest: "60 s" },
      { name: "Rosca + tríceps (superset)", sets: 3, reps: 12, rest: "60 s" },
    ]), "peito"),
    hypDay("Full-body B (ênfase puxar)", "terra", hypExercises([
      { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 8 },
      { name: "Puxada na barra (pulldown)", sets: 4, reps: 10 },
      { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 3, reps: 10 },
      { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12, rest: "75 s" },
      { name: "Rosca direta", sets: 3, reps: 12, rest: "60 s" },
    ]), "costas"),
    REST,
    hypDay("Full-body C (ênfase pernas)", "agachamento", hypExercises([
      { name: "Agachamento com barra", lift: "agachamento", pct: 0.75, sets: 4, reps: 8 },
      { name: "Supino com barra", lift: "supino", pct: 0.6, sets: 3, reps: 10 },
      { name: "Remada na máquina", sets: 3, reps: 12 },
      { name: "Peso morto romeno", lift: "terra", pct: 0.45, sets: 3, reps: 10 },
      { name: "Rosca martelo + tríceps testa", sets: 3, reps: 12, rest: "60 s" },
    ]), "pernas"),
    REST, REST, REST,
  ],
  // 4 dias — Upper/Lower ×2: cada músculo 2× por semana
  4: [
    hypDay("Superior A", "supino", hypExercises([
      { name: "Supino com barra", lift: "supino", pct: 0.72, sets: 4, reps: 8 },
      { name: "Remada curvada", lift: "terra", pct: 0.42, sets: 4, reps: 8 },
      { name: "Desenvolvimento militar", lift: "press", pct: 0.65, sets: 3, reps: 10 },
      { name: "Puxada na barra", sets: 3, reps: 10 },
      { name: "Rosca direta", sets: 3, reps: 12, rest: "60 s" },
      { name: "Tríceps na corda", sets: 3, reps: 12, rest: "60 s" },
    ]), "peito"),
    hypDay("Inferior A", "agachamento", hypExercises([
      { name: "Agachamento com barra", lift: "agachamento", pct: 0.75, sets: 4, reps: 6 },
      { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 8 },
      { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12 },
      { name: "Extensão de perna", lift: "agachamento", pct: 0.3, sets: 3, reps: 15, rest: "60 s" },
      { name: "Gémeos em pé", sets: 4, reps: 15, rest: "45 s" },
    ]), "pernas"),
    REST,
    hypDay("Superior B", "supino", hypExercises([
      { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.55, sets: 4, reps: 10 },
      { name: "Remada na máquina", sets: 4, reps: 10 },
      { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
      { name: "Cross-over de cabos", sets: 3, reps: 15, rest: "60 s" },
      { name: "Rosca martelo", sets: 3, reps: 12, rest: "60 s" },
      { name: "Tríceps testa", sets: 3, reps: 12, rest: "60 s" },
    ]), "peito"),
    hypDay("Inferior B", "terra", hypExercises([
      { name: "Levantamento terra", lift: "terra", pct: 0.7, sets: 4, reps: 6 },
      { name: "Agachamento frontal", lift: "agachamento", pct: 0.55, sets: 3, reps: 10 },
      { name: "Cadeira flexora (isquiotibiais)", lift: "agachamento", pct: 0.25, sets: 4, reps: 12, rest: "60 s" },
      { name: "Hip thrust", sets: 3, reps: 12, rest: "75 s" },
      { name: "Gémeos sentado", sets: 4, reps: 15, rest: "45 s" },
    ]), "pernas"),
    REST, REST,
  ],
  // 5 dias — Upper/Lower/Push/Pull/Legs: cada músculo ~2× por semana
  5: [
    hypDay("Superior (força)", "supino", hypExercises([
      { name: "Supino com barra", lift: "supino", pct: 0.78, sets: 4, reps: 6 },
      { name: "Remada curvada", lift: "terra", pct: 0.45, sets: 4, reps: 6 },
      { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 3, reps: 8 },
      { name: "Puxada na barra", sets: 3, reps: 8 },
      { name: "Rosca direta", sets: 3, reps: 10, rest: "60 s" },
      { name: "Tríceps na barra", sets: 3, reps: 10, rest: "60 s" },
    ]), "peito"),
    hypDay("Inferior (força)", "agachamento", hypExercises([
      { name: "Agachamento com barra", lift: "agachamento", pct: 0.78, sets: 5, reps: 5 },
      { name: "Peso morto romeno", lift: "terra", pct: 0.6, sets: 4, reps: 8 },
      { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 10 },
      { name: "Gémeos em pé", sets: 4, reps: 12, rest: "45 s" },
    ]), "pernas"),
    hypDay("Empurrar (volume)", "supino", hypExercises([
      { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 12 },
      { name: "Desenvolvimento de ombros", lift: "press", pct: 0.5, sets: 3, reps: 12 },
      { name: "Aberturas / cross-over", sets: 3, reps: 15, rest: "60 s" },
      { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
      { name: "Tríceps na corda", sets: 4, reps: 15, rest: "60 s" },
    ]), "peito"),
    hypDay("Puxar (volume)", "terra", hypExercises([
      { name: "Puxada na barra (pulldown)", sets: 4, reps: 12 },
      { name: "Remada unilateral c/ halter", sets: 4, reps: 12 },
      { name: "Remada na máquina (pega estreita)", sets: 3, reps: 15 },
      { name: "Crucifixo invertido (posteriores)", sets: 3, reps: 15, rest: "60 s" },
      { name: "Rosca direta + martelo", sets: 4, reps: 12, rest: "60 s" },
    ]), "costas"),
    hypDay("Pernas (volume)", "agachamento", hypExercises([
      { name: "Agachamento búlgaro", lift: "agachamento", pct: 0.35, sets: 4, reps: 12 },
      { name: "Cadeira extensora", lift: "agachamento", pct: 0.3, sets: 4, reps: 15, rest: "60 s" },
      { name: "Cadeira flexora", lift: "agachamento", pct: 0.25, sets: 4, reps: 15, rest: "60 s" },
      { name: "Hip thrust", sets: 4, reps: 12, rest: "75 s" },
      { name: "Gémeos sentado", sets: 4, reps: 20, rest: "45 s" },
    ]), "pernas"),
    REST, REST,
  ],
  // 6 dias — Push/Pull/Legs ×2: cada músculo 2× por semana
  6: [
    hypDay("Empurrar A (força)", "supino", hypExercises([
      { name: "Supino com barra", lift: "supino", pct: 0.78, sets: 4, reps: 6 },
      { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 4, reps: 8 },
      { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 3, reps: 10 },
      { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
      { name: "Tríceps na barra", sets: 4, reps: 10, rest: "60 s" },
    ]), "peito"),
    hypDay("Puxar A (força)", "terra", hypExercises([
      { name: "Levantamento terra", lift: "terra", pct: 0.72, sets: 4, reps: 6 },
      { name: "Puxada na barra", sets: 4, reps: 8 },
      { name: "Remada curvada", lift: "terra", pct: 0.45, sets: 4, reps: 8 },
      { name: "Crucifixo invertido", sets: 3, reps: 15, rest: "60 s" },
      { name: "Rosca direta com barra", sets: 4, reps: 10, rest: "60 s" },
    ]), "costas"),
    hypDay("Pernas A (força)", "agachamento", hypExercises([
      { name: "Agachamento com barra", lift: "agachamento", pct: 0.78, sets: 5, reps: 5 },
      { name: "Peso morto romeno", lift: "terra", pct: 0.6, sets: 4, reps: 8 },
      { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 10 },
      { name: "Gémeos em pé", sets: 4, reps: 12, rest: "45 s" },
    ]), "pernas"),
    hypDay("Empurrar B (volume)", "supino", hypExercises([
      { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 12 },
      { name: "Desenvolvimento Arnold", lift: "press", pct: 0.42, sets: 3, reps: 12 },
      { name: "Aberturas na máquina (peck deck)", sets: 4, reps: 15, rest: "60 s" },
      { name: "Elevações laterais", sets: 4, reps: 20, rest: "45 s" },
      { name: "Tríceps na corda", sets: 4, reps: 15, rest: "60 s" },
    ]), "peito"),
    hypDay("Puxar B (volume)", "terra", hypExercises([
      { name: "Puxada na barra (pega neutra)", sets: 4, reps: 12 },
      { name: "Remada unilateral", sets: 4, reps: 12 },
      { name: "Pullover", sets: 3, reps: 15, rest: "60 s" },
      { name: "Crucifixo invertido", sets: 4, reps: 15, rest: "60 s" },
      { name: "Rosca martelo + concentrada", sets: 4, reps: 12, rest: "60 s" },
    ]), "costas"),
    hypDay("Pernas B (volume)", "agachamento", hypExercises([
      { name: "Agachamento frontal", lift: "agachamento", pct: 0.55, sets: 4, reps: 10 },
      { name: "Cadeira extensora", lift: "agachamento", pct: 0.3, sets: 4, reps: 15, rest: "60 s" },
      { name: "Cadeira flexora", lift: "agachamento", pct: 0.25, sets: 4, reps: 15, rest: "60 s" },
      { name: "Hip thrust", sets: 4, reps: 12, rest: "75 s" },
      { name: "Gémeos sentado", sets: 4, reps: 20, rest: "45 s" },
    ]), "pernas"),
    REST,
  ],
};

// ---- Powerlifting ----
function plDay(title, exercises) {
  return { label: title, type: "power", cdType: "lower", build: exercises };
}
function plExercises(list) {
  return (c) => list.map((it) => {
    const cnsCut = c.R.snc < 55;
    const pct = cnsCut && it.heavy ? it.pct - 0.08 : it.pct;
    const reps = cnsCut && it.heavy ? it.reps + 1 : it.reps;
    return ex(it.name, it.lift ? swapNote(it.lift, c.profile) : null,
      setArr(it.sets, round25(c.lvl[it.lift] * pct * c.loadMod), reps, it.heavy ? (cnsCut ? "7" : "8–9") : "8"), it.rest || "3 min");
  });
}
const PL_SPLITS = {
  3: [
    plDay("Agachamento (pesado)", plExercises([
      { name: "Agachamento", lift: "agachamento", pct: 0.88, sets: 5, reps: 3, heavy: true, rest: "4 min" },
      { name: "Agachamento frontal (acessório)", lift: "agachamento", pct: 0.6, sets: 3, reps: 6 },
      { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 8, rest: "2 min" },
      { name: "Core anti-extensão", lift: null, sets: 3, reps: 0, rest: "60 s" },
    ])),
    plDay("Supino (pesado)", plExercises([
      { name: "Supino", lift: "supino", pct: 0.88, sets: 5, reps: 3, heavy: true, rest: "4 min" },
      { name: "Supino fecho (acessório)", lift: "supino", pct: 0.65, sets: 3, reps: 6 },
      { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 3, reps: 6 },
      { name: "Tríceps pesado", lift: null, sets: 3, reps: 10, rest: "90 s" },
    ])),
    plDay("Levantamento terra (pesado)", plExercises([
      { name: "Levantamento terra", lift: "terra", pct: 0.85, sets: 4, reps: 3, heavy: true, rest: "5 min" },
      { name: "Terra deficit (acessório)", lift: "terra", pct: 0.6, sets: 3, reps: 5 },
      { name: "Remada curvada pesada", lift: "terra", pct: 0.5, sets: 4, reps: 6 },
      { name: "Costas altas / face pull", lift: null, sets: 3, reps: 15, rest: "60 s" },
    ])),
    REST, REST, REST, REST,
  ],
};
PL_SPLITS[4] = [
  PL_SPLITS[3][0], PL_SPLITS[3][1], REST,
  plDay("Terra pesado + Agach. volume", plExercises([
    { name: "Levantamento terra", lift: "terra", pct: 0.85, sets: 4, reps: 3, heavy: true, rest: "5 min" },
    { name: "Agachamento (volume)", lift: "agachamento", pct: 0.72, sets: 4, reps: 6, rest: "3 min" },
    { name: "Remada pesada", lift: "terra", pct: 0.5, sets: 4, reps: 8, rest: "2 min" },
  ])),
  plDay("Supino volume + acessórios", plExercises([
    { name: "Supino (volume)", lift: "supino", pct: 0.72, sets: 5, reps: 6, rest: "3 min" },
    { name: "Desenvolvimento militar", lift: "press", pct: 0.68, sets: 4, reps: 8 },
    { name: "Tríceps + bíceps", lift: null, sets: 3, reps: 12, rest: "60 s" },
  ])),
  REST, REST,
];
PL_SPLITS[5] = [...PL_SPLITS[4].slice(0, 5), PL_SPLITS[3][2], REST];
PL_SPLITS[5][2] = plDay("Acessórios de força (superior)", plExercises([
  { name: "Supino pausado", lift: "supino", pct: 0.6, sets: 4, reps: 5 },
  { name: "Remada", lift: "terra", pct: 0.45, sets: 4, reps: 8 },
  { name: "Ombros e braços", lift: null, sets: 3, reps: 12, rest: "90 s" },
]));
PL_SPLITS[6] = [...PL_SPLITS[5].slice(0, 6),
  plDay("Acessórios de força (inferior)", plExercises([
    { name: "Agachamento frontal", lift: "agachamento", pct: 0.6, sets: 4, reps: 6 },
    { name: "Terra romeno", lift: "terra", pct: 0.6, sets: 4, reps: 8 },
    { name: "Core pesado", lift: null, sets: 3, reps: 0, rest: "60 s" },
  ]))];

// ---- Corrida (polarizada) ----
function runDay(label, kind) {
  return { label, type: kind === "hard" ? "run_hard" : "run_easy", cdType: "run", kind,
    build: (c) => runSession(c, kind) };
}
function runSession(c, kind) {
  if (kind === "hard") return [
    ex("6 × 1000 m a ritmo de 5 km", null, setArr(6, null, 0, "8–9"), "90 s trote", { detail: "Ritmo controlado e repetível" }),
    ex("Retorno à calma", null, setArr(1, null, 0, "3"), "", { detail: "10 min muito fácil" }),
  ];
  if (kind === "tempo") return [
    ex("20 min em ritmo de limiar (tempo)", null, setArr(1, null, 0, "7"), "", { detail: "Confortavelmente difícil, sustentável" }),
    ex("Retorno à calma", null, setArr(1, null, 0, "3"), "", { detail: "10 min fácil" }),
  ];
  if (kind === "long") return [ex("Corrida longa contínua", null, setArr(1, null, 0, "5"), "", { detail: "75–90 min em Zona 2, ritmo conversacional" })];
  return [ex("Rodagem fácil (Zona 2)", null, setArr(1, null, 0, "4–5"), "", { detail: "40–50 min, consegues falar frases inteiras" })];
}
const RUN_SPLITS = {
  3: [runDay("Rodagem fácil Z2", "easy"), REST, runDay("Intervalos (VO₂max)", "hard"), REST, runDay("Corrida longa", "long"), REST, REST],
  4: [runDay("Rodagem fácil Z2", "easy"), runDay("Intervalos (VO₂max)", "hard"), REST, runDay("Rodagem fácil Z2", "easy"), runDay("Corrida longa", "long"), REST, REST],
  5: [runDay("Rodagem fácil Z2", "easy"), runDay("Intervalos (VO₂max)", "hard"), runDay("Rodagem fácil Z2", "easy"), runDay("Corrida tempo (limiar)", "tempo"), runDay("Corrida longa", "long"), REST, REST],
  6: [runDay("Rodagem fácil Z2", "easy"), runDay("Intervalos (VO₂max)", "hard"), runDay("Rodagem fácil Z2", "easy"), runDay("Corrida tempo (limiar)", "tempo"), runDay("Rodagem fácil Z2", "easy"), runDay("Corrida longa", "long"), REST],
};

// ---- Hyrox ----
function hyroxSession(c, kind) {
  if (kind === "run") return [ex("Corrida contínua Zona 2", null, setArr(1, null, 0, "5"), "", { detail: "50–60 min base aeróbia" })];
  if (kind === "intervals") return [
    ex("8 × 400 m rápido", null, setArr(8, null, 0, "8–9"), "60 s", { detail: "Ritmo de prova ou mais rápido" }),
    ex("Retorno à calma", null, setArr(1, null, 0, "3"), "", { detail: "10 min fácil" }),
  ];
  if (kind === "strength") return [
    ex("Agachamento", swapNote("agachamento", c.profile), setArr(4, round25(c.lvl.agachamento * 0.78 * c.loadMod), 5, "8"), "2–3 min"),
    ex("Peso morto / RDL", swapNote("terra", c.profile), setArr(3, round25(c.lvl.terra * 0.6 * c.loadMod), 8, "8"), "2 min"),
    ex("Lunges com carga", null, setArr(3, null, 20, "8"), "90 s", { detail: "Padrão específico de Hyrox" }),
  ];
  // sim (simulação) — o circuito híbrido
  return [
    ex("Corrida 1 km (ritmo alvo)", null, setArr(1, null, 0, "7–8"), "direto p/ estação", { isCircuit: true, detail: "Entrar na estação sem parar" }),
    ex("SkiErg / Row 500 m", null, setArr(1, null, 0, "8"), "60 s", { isCircuit: true }),
    ex("Sled push + pull 25 m", null, setArr(2, null, 0, "8–9"), "60 s", { isCircuit: true, detail: "Carga de prova" }),
    ex("Burpee broad jumps", null, setArr(1, null, 15, "8"), "60 s", { isCircuit: true }),
    ex("Farmers carry 40 m", null, setArr(2, null, 0, "8"), "60 s", { isCircuit: true, detail: "Sem pousar" }),
    ex("Wall balls", null, setArr(2, null, 20, "8–9"), "90 s", { isCircuit: true }),
  ];
}
function hyroxDay(label, kind, cdType) {
  return { label, type: kind === "sim" ? "hyrox" : kind === "strength" ? "strength_lower" : kind === "intervals" ? "run_hard" : "run_easy",
    cdType: cdType || (kind === "strength" ? "lower" : kind === "sim" ? "hyrox" : "run"), kind, build: (c) => hyroxSession(c, kind) };
}
const HYROX_SPLITS = {
  3: [hyroxDay("Força específica", "strength"), hyroxDay("Corrida base Z2", "run"), hyroxDay("Simulação de prova", "sim"), REST, REST, hyroxDay("Corrida longa Z2", "run"), REST],
  4: [hyroxDay("Força específica", "strength"), hyroxDay("Intervalos", "intervals"), hyroxDay("Simulação de prova", "sim"), REST, hyroxDay("Corrida longa Z2", "run"), REST, REST],
  5: [hyroxDay("Força específica", "strength"), hyroxDay("Intervalos", "intervals"), hyroxDay("Corrida base Z2", "run"), hyroxDay("Simulação de prova", "sim"), REST, hyroxDay("Corrida longa Z2", "run"), REST],
  6: [hyroxDay("Força específica", "strength"), hyroxDay("Intervalos", "intervals"), hyroxDay("Corrida base Z2", "run"), hyroxDay("Simulação de prova", "sim"), hyroxDay("Força + cond.", "strength"), hyroxDay("Corrida longa Z2", "run"), REST],
};

// ---- Calistenia ----
function caliSession(c, kind) {
  const reps = c.profile.level === "iniciante" ? 6 : c.profile.level === "intermedio" ? 10 : 14;
  if (kind === "push") return [
    ex(c.profile.injuries.includes("ombro") ? "Flexões inclinadas" : "Fundos nas paralelas", swapNote("supino", c.profile), setArr(4, null, reps, "8"), "2 min"),
    ex("Flexões (variação difícil)", null, setArr(4, null, reps, "8"), "90 s"),
    ex("Pike push-ups (ombros)", null, setArr(3, null, Math.max(5, reps - 3), "8"), "90 s"),
    ex("Tríceps em banco", null, setArr(3, null, reps + 2, "8"), "60 s"),
  ];
  if (kind === "pull") return [
    ex(c.profile.level === "iniciante" ? "Negativas de elevação" : "Elevações (pull-ups)", null, setArr(4, null, reps, "8"), "2 min", { detail: "Progressão por reps e amplitude" }),
    ex("Remada invertida na barra", null, setArr(4, null, reps + 2, "8"), "90 s"),
    ex("Elevações supinadas (chin-ups)", null, setArr(3, null, Math.max(4, reps - 2), "8"), "90 s"),
    ex("Rosca com toalha / anéis", null, setArr(3, null, reps, "8"), "60 s"),
  ];
  if (kind === "legs") return [
    ex(c.profile.injuries.includes("joelho") ? "Agachamento à caixa" : "Pistol squat progressivo", swapNote("agachamento", c.profile), setArr(4, null, Math.max(4, reps - 4), "8"), "2 min"),
    ex("Afundos (lunges)", null, setArr(3, null, reps + 4, "8"), "90 s"),
    ex("Elevação de anca a 1 perna", null, setArr(3, null, reps + 2, "8"), "90 s"),
    ex("Gémeos a 1 perna", null, setArr(4, null, 15, "8"), "45 s"),
  ];
  // skill
  return [
    ex("Skill: hold (L-sit / prancha frontal)", null, setArr(4, null, 0, "8"), "2 min", { detail: "Tempo sob tensão — o skill do dia" }),
    ex("Progressão para pino (handstand)", null, setArr(4, null, 0, "8"), "90 s"),
    ex("Core: elevações de pernas na barra", null, setArr(3, null, reps, "8"), "90 s"),
    ex("Prancha lateral", null, setArr(3, null, 0, "7"), "45 s"),
  ];
}
function caliDay(label, kind) {
  return { label, type: "calisthenics", cdType: kind === "legs" ? "lower" : "upper", kind, build: (c) => caliSession(c, kind) };
}
const CALI_SPLITS = {
  3: [caliDay("Empurrar (Push)", "push"), REST, caliDay("Puxar (Pull)", "pull"), REST, caliDay("Pernas e Core", "legs"), REST, REST],
  4: [caliDay("Empurrar (Push)", "push"), caliDay("Puxar (Pull)", "pull"), REST, caliDay("Pernas", "legs"), caliDay("Skill e Core", "skill"), REST, REST],
  5: [caliDay("Empurrar (Push)", "push"), caliDay("Puxar (Pull)", "pull"), caliDay("Pernas", "legs"), caliDay("Skill", "skill"), caliDay("Full-body", "push"), REST, REST],
  6: [caliDay("Empurrar (Push)", "push"), caliDay("Puxar (Pull)", "pull"), caliDay("Pernas", "legs"), caliDay("Empurrar (Push)", "push"), caliDay("Puxar (Pull)", "pull"), caliDay("Skill e Core", "skill"), REST],
};

// ---- Híbrido ----
function hybDay(label, kind) {
  return { label, type: kind === "strength" ? "strength_lower" : kind === "intervals" ? "run_hard" : "run_easy",
    cdType: kind === "strength" ? "lower" : "run", kind, build: (c) => hybSession(c, kind) };
}
function hybSession(c, kind) {
  if (kind === "intervals") return [ex("6 × 800 m rápido", null, setArr(6, null, 0, "8–9"), "90 s", { detail: "Qualidade de corrida" }), ex("Retorno à calma", null, setArr(1, null, 0, "3"), "", { detail: "10 min" })];
  if (kind === "run") return [ex("Rodagem fácil Zona 2", null, setArr(1, null, 0, "5"), "", { detail: "40 min base aeróbia" })];
  if (kind === "long") return [ex("Corrida longa Z2", null, setArr(1, null, 0, "5"), "", { detail: "60–75 min" })];
  if (kind === "cond") return [
    ex("Circuito metabólico (kettlebell + burpees)", null, setArr(4, null, 0, "8"), "60 s", { isCircuit: true, detail: "Condicionamento" }),
    ex("Farmers carry", null, setArr(3, null, 0, "8"), "60 s", { detail: "40 m" }),
  ];
  // strength (upper ou lower)
  if (kind === "strengthUp") return [
    ex("Supino com barra", swapNote("supino", c.profile), setArr(4, round25(c.lvl.supino * 0.78 * c.loadMod), 5, "8"), "2–3 min"),
    ex("Remada curvada", swapNote("terra", c.profile), setArr(4, round25(c.lvl.terra * 0.45 * c.loadMod), 6, "8"), "2 min"),
    ex("Desenvolvimento de ombros", null, setArr(3, round25(c.lvl.press * 0.65 * c.loadMod), 8, "8"), "2 min"),
  ];
  return [
    ex("Agachamento", swapNote("agachamento", c.profile), setArr(Math.max(3, 4 - c.setCut), round25(c.lvl.agachamento * 0.78 * c.loadMod), 5, "8"), "2–3 min"),
    ex("Peso morto romeno", swapNote("terra", c.profile), setArr(3, round25(c.lvl.terra * 0.6 * c.loadMod), 8, "8"), "2 min"),
    ex("Finisher: kettlebell swings", null, setArr(3, null, 15, "8"), "60 s"),
  ];
}
const HYB_SPLITS = {
  3: [hybDay("Força inferior", "strength"), hybDay("Corrida (intervalos)", "intervals"), { ...hybDay("Força + condicionamento", "strength"), build: (c) => [...hybSession(c, "strengthUp"), ...hybSession(c, "cond")] }, REST, REST, hybDay("Corrida longa", "long"), REST],
  4: [hybDay("Força inferior", "strength"), hybDay("Intervalos", "intervals"), { ...hybDay("Força superior", "strengthUp"), build: (c) => hybSession(c, "strengthUp") }, REST, hybDay("Condicionamento", "cond"), hybDay("Corrida longa", "long"), REST],
  5: [hybDay("Força inferior", "strength"), hybDay("Intervalos", "intervals"), { ...hybDay("Força superior", "strengthUp"), build: (c) => hybSession(c, "strengthUp") }, hybDay("Rodagem Z2", "run"), hybDay("Condicionamento", "cond"), REST, hybDay("Corrida longa", "long")],
  6: [hybDay("Força inferior", "strength"), hybDay("Intervalos", "intervals"), { ...hybDay("Força superior", "strengthUp"), build: (c) => hybSession(c, "strengthUp") }, hybDay("Rodagem Z2", "run"), hybDay("Condicionamento", "cond"), hybDay("Força total", "strength"), hybDay("Corrida longa", "long")],
};


// ---- Bro split alternativo: 1 grupo muscular por dia (frequência 1×/semana) ----
const HYP_BRO = {
  3: [
    hypDay("Peito e Tríceps", "supino", hypExercises([
      { name: "Supino com barra", lift: "supino", pct: 0.72, sets: 4, reps: 8 },
      { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 10 },
      { name: "Aberturas / cross-over", sets: 3, reps: 15, rest: "60 s" },
      { name: "Tríceps testa", sets: 4, reps: 12, rest: "60 s" },
      { name: "Tríceps na corda", sets: 3, reps: 15, rest: "60 s" },
    ]), "peito"),
    REST,
    hypDay("Costas e Bíceps", "terra", hypExercises([
      { name: "Puxada na barra (pulldown)", sets: 4, reps: 10 },
      { name: "Remada curvada", lift: "terra", pct: 0.42, sets: 4, reps: 10 },
      { name: "Remada unilateral c/ halter", sets: 3, reps: 12 },
      { name: "Rosca direta", sets: 4, reps: 12, rest: "60 s" },
      { name: "Rosca martelo", sets: 3, reps: 12, rest: "60 s" },
    ]), "costas"),
    REST,
    hypDay("Pernas e Ombros", "agachamento", hypExercises([
      { name: "Agachamento com barra", lift: "agachamento", pct: 0.72, sets: 4, reps: 8 },
      { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 10 },
      { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12 },
      { name: "Desenvolvimento de ombros", lift: "press", pct: 0.6, sets: 4, reps: 10 },
      { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
    ]), "pernas"),
    REST, REST, REST,
  ],
  4: [
    hypDay("Peito", "supino", hypExercises([
      { name: "Supino com barra", lift: "supino", pct: 0.75, sets: 4, reps: 8 },
      { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 10 },
      { name: "Aberturas na máquina (peck deck)", sets: 3, reps: 12, rest: "60 s" },
      { name: "Cross-over de cabos", sets: 3, reps: 15, rest: "60 s" },
      { name: "Flexões até à falha", sets: 2, reps: 0, rest: "60 s" },
    ]), "peito"),
    hypDay("Costas", "terra", hypExercises([
      { name: "Levantamento terra", lift: "terra", pct: 0.7, sets: 4, reps: 6 },
      { name: "Puxada na barra", sets: 4, reps: 10 },
      { name: "Remada curvada", lift: "terra", pct: 0.42, sets: 4, reps: 10 },
      { name: "Remada unilateral", sets: 3, reps: 12 },
      { name: "Pullover", sets: 3, reps: 15, rest: "60 s" },
    ]), "costas"),
    REST,
    hypDay("Ombros e Braços", "press", hypExercises([
      { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 4, reps: 8 },
      { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
      { name: "Crucifixo invertido (posteriores)", sets: 3, reps: 15, rest: "60 s" },
      { name: "Rosca direta + tríceps (superset)", sets: 4, reps: 12, rest: "60 s" },
      { name: "Rosca martelo + tríceps corda", sets: 3, reps: 12, rest: "60 s" },
    ]), "ombros"),
    hypDay("Pernas", "agachamento", hypExercises([
      { name: "Agachamento com barra", lift: "agachamento", pct: 0.75, sets: 5, reps: 8 },
      { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 10 },
      { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12 },
      { name: "Cadeira extensora + flexora", lift: "agachamento", pct: 0.3, sets: 3, reps: 15, rest: "60 s" },
      { name: "Gémeos", sets: 4, reps: 15, rest: "45 s" },
    ]), "pernas"),
    REST, REST,
  ],
  5: [
    hypDay("Peito", "supino", hypExercises([
      { name: "Supino com barra", lift: "supino", pct: 0.75, sets: 4, reps: 8 },
      { name: "Supino inclinado c/ halteres", lift: "supino", pct: 0.5, sets: 4, reps: 10 },
      { name: "Aberturas na máquina (peck deck)", sets: 3, reps: 12, rest: "60 s" },
      { name: "Cross-over de cabos", sets: 3, reps: 15, rest: "60 s" },
      { name: "Flexões até à falha", sets: 2, reps: 0, rest: "60 s" },
    ]), "peito"),
    hypDay("Costas", "terra", hypExercises([
      { name: "Levantamento terra", lift: "terra", pct: 0.72, sets: 4, reps: 6 },
      { name: "Puxada na barra", sets: 4, reps: 10 },
      { name: "Remada curvada", lift: "terra", pct: 0.42, sets: 4, reps: 10 },
      { name: "Remada unilateral", sets: 3, reps: 12 },
      { name: "Pullover", sets: 3, reps: 15, rest: "60 s" },
    ]), "costas"),
    hypDay("Pernas", "agachamento", hypExercises([
      { name: "Agachamento com barra", lift: "agachamento", pct: 0.75, sets: 5, reps: 8 },
      { name: "Peso morto romeno", lift: "terra", pct: 0.55, sets: 4, reps: 10 },
      { name: "Prensa de pernas", lift: "agachamento", pct: 0.9, sets: 3, reps: 12 },
      { name: "Cadeira extensora + flexora", lift: "agachamento", pct: 0.3, sets: 3, reps: 15, rest: "60 s" },
      { name: "Gémeos", sets: 4, reps: 15, rest: "45 s" },
    ]), "pernas"),
    hypDay("Ombros", "press", hypExercises([
      { name: "Desenvolvimento militar", lift: "press", pct: 0.7, sets: 4, reps: 8 },
      { name: "Desenvolvimento Arnold", lift: "press", pct: 0.45, sets: 3, reps: 12 },
      { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
      { name: "Elevações posteriores", sets: 4, reps: 15, rest: "60 s" },
      { name: "Encolhimentos", sets: 3, reps: 15, rest: "60 s" },
    ]), "ombros"),
    hypDay("Braços e Core", "supino", hypExercises([
      { name: "Rosca direta com barra", sets: 4, reps: 10, rest: "60 s" },
      { name: "Tríceps na barra (fundos ou testa)", sets: 4, reps: 10, rest: "60 s" },
      { name: "Rosca martelo", sets: 3, reps: 12, rest: "60 s" },
      { name: "Tríceps na corda", sets: 3, reps: 15, rest: "60 s" },
      { name: "Prancha + rotação (core)", sets: 3, reps: 0, rest: "45 s" },
    ]), "bracos"),
    REST, REST,
  ],
};
HYP_BRO[6] = [HYP_BRO[5][0], HYP_BRO[5][1], HYP_BRO[5][2], HYP_BRO[5][3], HYP_BRO[5][4],
  hypDay("Ponto fraco / Core", "agachamento", hypExercises([
    { name: "Hip thrust", sets: 4, reps: 12 },
    { name: "Afundos com halteres", sets: 3, reps: 12 },
    { name: "Elevações laterais", sets: 4, reps: 15, rest: "60 s" },
    { name: "Abdominais com carga", sets: 4, reps: 15, rest: "45 s" },
    { name: "Prancha lateral", sets: 3, reps: 0, rest: "45 s" },
  ]), "core"), REST];

const SPLITS = { forca: HYP_SPLITS, powerlifting: PL_SPLITS, resistencia: RUN_SPLITS, hyrox: HYROX_SPLITS, calistenia: CALI_SPLITS, hibrido: HYB_SPLITS };

const SCIENCE = {
  forca: "Hipertrofia responde a volume por grupo muscular com esforço próximo da falha: 6–12 reps a 65–80% 1RM, RPE 7–8. O split divide a semana para dar volume e recuperação a cada músculo.",
  powerlifting: "Força máxima é adaptação neural: cargas altas (85–92% 1RM), poucas reps, descanso longo. A semana roda os três levantamentos com dias pesados e dias de volume.",
  hyrox: "Hyrox exige correr sob fadiga: a semana combina força específica, intervalos, base aeróbia e simulações que treinam a transição corrida↔estação.",
  resistencia: "Modelo polarizado ~80/20: a maioria do volume é fácil (Z2) para construir base aeróbia, com dias duros (intervalos, tempo) para elevar VO₂max e limiar.",
  calistenia: "Sem carga externa, a sobrecarga faz-se por alavancas, amplitude, reps e tempo sob tensão. O split Push/Pull/Legs/Skill dá foco e recuperação a cada padrão.",
  hibrido: "No treino concorrente, força e resistência competem. A solução é separar qualidades em dias distintos, mantendo reps moderadas na força para não acumular fadiga.",
};

/* ============================================================
   PLANO PERSONALIZADO — o utilizador constrói a semana e o
   motor analisa-a com as mesmas regras científicas que usa
   para gerar os seus próprios planos.
   ============================================================ */

const CUSTOM_LIFT_MAP = {
  "Agachamento com barra": { lift: "agachamento", pct: 0.7 },
  "Leg press": { lift: "agachamento", pct: 0.9 },
  "Levantamento terra": { lift: "terra", pct: 0.65 },
  "Hip thrust": { lift: "terra", pct: 0.5 },
  "Supino com barra": { lift: "supino", pct: 0.7 },
  "Supino neutro c/ halteres": { lift: "supino", pct: 0.5 },
  "Press militar": { lift: "press", pct: 0.65 },
  "Remada curvada": { lift: "terra", pct: 0.4 },
};

function customExercise(it, c) {
  const lib = LIBRARY.find((l) => l.name === it.name) || {};
  const map = CUSTOM_LIFT_MAP[it.name];
  const w = lib.bw ? null : map ? round25(c.lvl[map.lift] * map.pct * c.loadMod) : null;
  return ex(it.name, null, setArr(Math.max(1, (it.sets || 3) - c.setCut), w, it.reps || (lib.bw ? 10 : 8), "7–8"), lib.bw ? "90 s" : "2 min", lib.bw ? { bw: true } : {});
}

// Analisa um plano semanal criado pelo utilizador. Devolve score 0-100 + achados.
function analyzeCustomPlan(plan, profile) {
  const findings = [];
  let score = 100;
  const muscleOf = (name) => { const l = LIBRARY.find((x) => x.name === name); return l ? l.muscle : null; };
  const trainDays = plan.filter((d) => !d.rest && d.items && d.items.length);
  if (!trainDays.length) return { score: 0, verdict: "O plano não tem nenhum dia de treino.", findings: [{ level: "bad", text: "Adiciona exercícios a pelo menos um dia." }] };

  const freq = {}, sets = {};
  plan.forEach((d) => {
    if (d.rest || !d.items) return;
    const seen = new Set();
    d.items.forEach((it) => { const m = muscleOf(it.name); if (!m) return; seen.add(m); sets[m] = (sets[m] || 0) + (it.sets || 3); });
    seen.forEach((m) => { freq[m] = (freq[m] || 0) + 1; });
  });

  const majors = [["Peito", "Peito"], ["Costas", "Costas"], ["Pernas", "Pernas"]];
  majors.forEach(([m, label]) => {
    if (!freq[m]) { score -= 15; findings.push({ level: "bad", text: `${label} não é treinado nenhuma vez — é um dos grandes grupos.`, fix: `Adiciona pelo menos um exercício de ${label.toLowerCase()}.` }); }
    else if (freq[m] === 1) { score -= 8; findings.push({ level: "warn", text: `${label}: só 1×/semana. Para o mesmo volume, 2× gera mais crescimento.`, fix: `Divide o volume de ${label.toLowerCase()} por dois dias.` }); }
    else findings.push({ level: "good", text: `${label}: ${freq[m]}×/semana — frequência ideal.` });
  });

  Object.entries(sets).forEach(([m, s]) => {
    if (s > 22) { score -= 5; findings.push({ level: "warn", text: `${m}: ${s} séries/semana — acima do que a maioria consegue recuperar (10–20).`, fix: "Corta 1–2 exercícios ou séries." }); }
  });

  const restDays = plan.filter((d) => d.rest || !d.items || !d.items.length).length;
  if (restDays === 0) { score -= 10; findings.push({ level: "warn", text: "Zero dias de descanso — o músculo cresce a recuperar, não a treinar.", fix: "Marca pelo menos 1 dia de descanso." }); }
  else findings.push({ level: "good", text: `${restDays} dia${restDays > 1 ? "s" : ""} de descanso — a recuperação está contemplada.` });

  for (let i = 0; i < 6; i++) {
    const a = plan[i], b = plan[i + 1];
    if (a && b && !a.rest && !b.rest && a.items && b.items && a.items.length && b.items.length) {
      const ma = new Set(a.items.map((it) => muscleOf(it.name)));
      const rep = b.items.map((it) => muscleOf(it.name)).find((m) => m && ma.has(m) && ["Pernas", "Posterior", "Peito", "Costas"].includes(m));
      if (rep) { score -= 8; findings.push({ level: "warn", text: `${rep} em dias consecutivos (${DAY_SHORT[i]}→${DAY_SHORT[i + 1]}) — o ideal são ~48h entre estímulos do mesmo grupo.`, fix: "Afasta esses dias ou troca um dos treinos." }); break; }
    }
  }

  const push = (sets["Peito"] || 0) + (sets["Ombros"] || 0);
  const pull = sets["Costas"] || 0;
  if (push > 0 && pull === 0) { score -= 12; findings.push({ level: "bad", text: "Só empurras, nunca puxas — desequilíbrio postural garantido a prazo.", fix: "Adiciona remadas ou puxadas." }); }
  else if (pull > 0 && push / pull > 2) { score -= 10; findings.push({ level: "warn", text: "Muito mais volume de empurrar do que de puxar — receita para ombros irritados.", fix: "Reforça costas para equilibrar (rácio ~1:1)." }); }
  else if (pull > 0 && push > 0) findings.push({ level: "good", text: "Empurrar e puxar equilibrados — bom para a saúde do ombro." });

  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 85 ? "Plano sólido — pouco a apontar." : score >= 65 ? "Bom plano, com ajustes a fazer." : score >= 45 ? "Funciona, mas tem falhas importantes." : "Precisa de ser repensado antes de avançares.";
  return { score, verdict, findings };
}

function getWeekPlan(profile) {
  const d = Math.min(6, Math.max(3, profile.days));
  if (profile.goal === "forca" && profile.splitStyle === "custom" && profile.customPlan) {
    return profile.customPlan.map((day, i) => {
      if (day.rest || !day.items || !day.items.length) return { label: "Descanso", rest: true, dayIndex: i, dayName: DAY_NAMES[i], dayShort: DAY_SHORT[i] };
      const lower = day.items.some((it) => { const l = LIBRARY.find((x) => x.name === it.name); return l && ["Pernas", "Posterior", "Glúteo"].includes(l.muscle); });
      return { label: day.label || "Treino", type: lower ? "strength_lower" : "strength_upper", cdType: lower ? "lower" : "upper", custom: true,
        build: (c) => day.items.map((it) => customExercise(it, c)), dayIndex: i, dayName: DAY_NAMES[i], dayShort: DAY_SHORT[i] };
    });
  }
  let splits = SPLITS[profile.goal] || HYP_SPLITS;
  if (profile.goal === "forca" && profile.splitStyle === "bro") splits = HYP_BRO;
  return (splits[d] || splits[4]).map((day, i) => ({ ...day, dayIndex: i, dayName: DAY_NAMES[i], dayShort: DAY_SHORT[i] }));
}

// Descreve os dois estilos de split para o ecrã de escolha
function splitOptions(profile) {
  if (profile.goal !== "forca") return null;
  const freqDays = (SPLITS.forca[Math.min(6, Math.max(3, profile.days))] || SPLITS.forca[4]).filter((x) => !x.rest).map((x) => x.label);
  const broDays = (HYP_BRO[Math.min(6, Math.max(3, profile.days))] || HYP_BRO[4]).filter((x) => !x.rest).map((x) => x.label);
  return {
    freq: { id: "freq", title: "Frequência 2× (recomendado)", tag: "Mais crescimento", desc: "Cada músculo treinado 2×/semana. A ciência atual mostra que dividir o volume em 2 sessões gera mais hipertrofia que concentrar tudo numa.", days: freqDays },
    bro: { id: "bro", title: "1 músculo por dia (bro split)", tag: "Mais foco por sessão", desc: "Cada dia dedicado a um grupo (peito, costas...). Frequência 1×/semana mas volume máximo por sessão. Popular e válido se recuperares bem.", days: broDays },
  };
}

// Constrói a sessão de um dia específico do plano
/* ============================================================
   SOBRECARGA PROGRESSIVA — o treino evolui semana a semana.
   Modelo: progressão dupla (reps → carga) guiada pela
   autorregulação por RPE, com deload periódico de fadiga.
   ============================================================ */

// Incremento de carga por objetivo e nível (kg/semana nos compostos)
const WEEKLY_STEP = {
  powerlifting: { iniciante: 5, intermedio: 2.5, avancado: 2.5 },
  forca: { iniciante: 5, intermedio: 2.5, avancado: 2.5 },
  hibrido: { iniciante: 5, intermedio: 2.5, avancado: 2.5 },
};

// Estado inicial de progressão (semana 1)
function initProgression() {
  return { week: 1, loadBonus: 0, repBonus: 0, streak: 0, lastRpe: null, deloadWeek: false, history: [] };
}

// Decide a semana seguinte a partir do desempenho da semana atual.
// avgRpe: média do RPE reportado; completion: 0-1 (fração de séries feitas)
function advanceWeek(prog, profile, avgRpe, completion) {
  const p = { ...prog, history: [...prog.history] };
  const step = (WEEKLY_STEP[profile.goal] || WEEKLY_STEP.forca)[profile.level] || 2.5;
  p.history.push({ week: p.week, avgRpe, completion });

  // Deload a cada 5 semanas (ou se 2 semanas duras seguidas), mas nunca dois deloads seguidos
  const twoHardWeeks = !prog.deloadWeek && prog.lastRpe != null && avgRpe >= 9 && prog.lastRpe >= 9;
  const dueDeload = !prog.deloadWeek && ((p.week % 5 === 0) || twoHardWeeks);

  if (dueDeload) {
    p.week += 1; p.deloadWeek = true; p.lastRpe = null; // reset para não re-disparar
    p.reason = twoHardWeeks ? "Duas semanas duras seguidas — semana de descarga para recuperares e voltares mais forte." : "Semana de descarga programada (a cada 5 semanas) — gestão de fadiga acumulada.";
    return p;
  }
  p.deloadWeek = false;

  if (completion < 0.8) {
    // Não cumpriste o volume — repete a carga, sem subir
    p.reason = "Não completaste todas as séries — mantenho a carga esta semana para consolidares.";
  } else if (avgRpe <= 7.5) {
    // Fácil — progride: primeiro reps (dupla progressão), depois carga
    if (p.repBonus < 2) { p.repBonus += 1; p.streak += 1; p.reason = "Semana passada esteve fácil (RPE baixo) — +1 rep por série (progressão dupla)."; }
    else { p.repBonus = 0; p.loadBonus += step; p.streak += 1; p.reason = `Atingiste o topo das reps — subo a carga +${step} kg e recomeço o ciclo de reps.`; }
  } else if (avgRpe <= 8.5) {
    // Na zona certa — pequena progressão de carga
    p.loadBonus += step; p.streak += 1; p.reason = `Na zona ideal de esforço — progressão de +${step} kg nos compostos.`;
  } else {
    // Duro mas não excessivo — mantém para dominar a carga
    p.streak = 0; p.reason = "Semana exigente (RPE alto) — mantenho a carga para a dominares antes de subir.";
  }
  p.week += 1; p.lastRpe = avgRpe;
  return p;
}

// Fator multiplicativo aplicado às cargas, derivado do loadBonus acumulado.
// loadBonus é em kg absolutos sobre o agachamento de referência; convertido em %.
function progressionFactor(prog, profile, deload) {
  if (!prog) return { mult: 1, repAdd: 0 };
  if (deload || prog.deloadWeek) return { mult: 0.9, repAdd: 0 }; // descarga: -10% carga
  // Base de referência para converter kg->% (usa agachamento intermédio como âncora)
  const anchor = 105;
  const mult = 1 + (prog.loadBonus / anchor);
  return { mult, repAdd: prog.repBonus || 0 };
}

/* ============================================================
   CHECK-IN PÓS-TREINO — o desconforto reportado influencia
   a sessão seguinte: cautela na carga, não substituição total
   (isso é reservado a lesões declaradas no onboarding).
   ============================================================ */
const ZONE_TO_MUSCLES = {
  ombro: ["Ombros", "Peito"], cotovelo: ["Braços"], pulso: ["Braços", "Peito"],
  joelho: ["Pernas"], lombar: ["Posterior", "Pernas", "Costas"], anca: ["Pernas", "Posterior"],
  tornozelo: ["Pernas"], pescoco: ["Costas", "Ombros"],
};
const ZONE_LABELS = { ombro: "ombro", cotovelo: "cotovelo", pulso: "pulso", joelho: "joelho", lombar: "lombar", anca: "anca", tornozelo: "tornozelo", pescoco: "pescoço" };
function guessMuscle(name) {
  const lib = LIBRARY.find((l) => l.name === name);
  if (lib) return lib.muscle;
  const n = name.toLowerCase();
  if (/supino|flexõe|aberturas|cross|peck|fundos/.test(n)) return "Peito";
  if (/puxada|remada|pulldown|pullover|dorsais|pull-up|chin-up|elevações supinadas/.test(n)) return "Costas";
  if (/desenvolvimento|militar|arnold|elevações laterais|pike|crucifixo/.test(n)) return "Ombros";
  if (/rosca/.test(n)) return "Braços";
  if (/tríceps/.test(n)) return "Braços";
  if (/agachamento|prensa|leg press|extensão|extensora|búlgaro|frontal|afundo|lunge|pistol/.test(n)) return "Pernas";
  if (/terra|romeno|rdl|flexora|isquiot|hip thrust|glúteo|anca/.test(n)) return "Posterior";
  if (/gémeos|panturr/.test(n)) return "Pernas";
  if (/prancha|core|abdomin|dead bug|l-sit/.test(n)) return "Core";
  return null;
}

function buildDaySession(profile, R, maxes, prefs, dayIndex, prog, checkinFlags) {
  const week = getWeekPlan(profile);
  const day = week[dayIndex];
  if (!day || day.rest) return null;
  const { lvl, usedReal } = baseLifts(profile, maxes);
  const weeksOut = weeksUntil(profile.eventDate);
  const phase = macroPhase(weeksOut);
  const adjustments = [];
  let loadMod = 1.0, setCut = 0;
  const pf = progressionFactor(prog, profile, false);
  loadMod *= pf.mult; // sobrecarga progressiva acumulada
  if (phase && phase.idx === 2) { loadMod -= 0.1; setCut += 1; adjustments.push("Taper: volume reduzido para a prova"); }
  if (R.muscular < 55 && (day.cdType === "lower" || day.cdType === "upper")) { loadMod -= 0.07; setCut += 1; adjustments.push("Carga −7% e −1 série (fadiga muscular)"); }
  if (prog && prog.deloadWeek) adjustments.push("Semana de descarga: −10% carga para recuperares");

  const ctx = { profile, R, lvl, loadMod, setCut, eq: profile.equipment, repAdd: pf.repAdd };
  let exercises = day.build(ctx);

  // Interpretar foco escrito à mão: mapear palavras-chave a grupos
  const noteFocus = [];
  if (profile.focusNote && profile.focusNote.trim()) {
    const t = profile.focusNote.toLowerCase();
    const kw = { gluteo: ["glúteo","gluteo","rabo"], peito: ["peito","peitoral"], costas: ["costas","dorsal"], ombros: ["ombro","deltoide"], bracos: ["braço","braco","bíceps","biceps","tríceps","triceps"], core: ["abdominal","abdómen","core","barriga"], gemeos: ["gémeo","gemeo","panturr"] };
    Object.entries(kw).forEach(([g, words]) => { if (words.some((w) => t.includes(w)) && FOCUS_WORK[g]) noteFocus.push(g); });
  }
  const allFocus = [...new Set([...(profile.focus || []), ...noteFocus])].slice(0, 3);

  // Foco muscular: só hipertrofia, e só nos dias do músculo-alvo, fora do taper
  if (HYPERTROPHY_GOALS.includes(profile.goal) && !(phase && phase.idx === 2) && allFocus.length) {
    allFocus.forEach((f) => {
      const fw = FOCUS_WORK[f];
      if (fw.day === day.focusDay) {
        const eq = profile.equipment === "hibrido" ? "ginasio" : profile.equipment;
        exercises = [...exercises, ex(fw.ex[eq] || fw.ex.ginasio, null, setArr(3, profile.equipment === "parque" ? null : round25(lvl.supino * 0.35), fw.reps, "8–9"), "60 s", { focusTag: fw.label })];
      }
    });
  }

  const warmup = prefs.warmup ? (WARMUPS[day.type] || WARMUPS.strength_lower) : null;
  const cooldown = prefs.cooldown ? (COOLDOWNS[day.cdType] || COOLDOWNS.full) : null;
  const rehab = profile.injuries.length && profile.physio === "nao" ? profile.injuries.flatMap((i) => REHAB[i] || []) : [];

  // Check-in pós-treino: desconforto recente → cautela na carga (não substituição total)
  let checkinCaution = false;
  const flaggedZones = checkinFlags && checkinFlags.length ? checkinFlags : [];
  if (flaggedZones.length) {
    const flaggedMuscles = new Set();
    flaggedZones.forEach((z) => (ZONE_TO_MUSCLES[z] || []).forEach((m) => flaggedMuscles.add(m)));
    exercises = exercises.map((exo) => {
      const m = guessMuscle(exo.name);
      if (m && flaggedMuscles.has(m) && exo.sets && exo.sets[0] && exo.sets[0].w) {
        checkinCaution = true;
        return { ...exo, sets: exo.sets.map((s) => ({ ...s, w: s.w ? round25(s.w * 0.92) : s.w })),
          swap: (exo.swap ? exo.swap + " · " : "") + "Carga cautelar (desconforto reportado no check-in)" };
      }
      return exo;
    });
    if (checkinCaution) adjustments.push(`Carga −8% em exercícios ligados a ${flaggedZones.map((z) => ZONE_LABELS[z] || z).join(", ")} (reportaste desconforto)`);
  }

  const why = [day.custom
    ? "Plano desenhado por ti e analisado pelo motor — as cargas, a progressão semanal e a autorregulação por RPE continuam ativas por cima da tua estrutura."
    : (SCIENCE[profile.goal] || SCIENCE.forca)];
  if (usedReal.length && STRENGTH_LIFT_GOALS.includes(profile.goal)) why.push(`Cargas a partir dos teus recordes reais (${usedReal.map((k) => LIFT_LABEL[k].toLowerCase()).join(", ")}).`);
  if (weeksOut != null) why.push(`Faltam ${weeksOut} sem. — fase de ${phase.name.toLowerCase()}: ${phase.desc}`);
  if (profile.focusNote && profile.focusNote.trim() && HYPERTROPHY_GOALS.includes(profile.goal)) why.push(`Pedido de foco «${profile.focusNote.trim().slice(0, 50)}»: interpretei e reforcei essa zona no dia certo.`);
  if (checkinCaution) why.push("O teu check-in do último treino reportou desconforto — apliquei cautela nas cargas relacionadas até veres como reage.");
  if (profile.equipment === "outro" && profile.equipmentNote && profile.equipmentNote.trim()) why.push(`Local: «${profile.equipmentNote.trim().slice(0, 60)}» — tratado como equivalente a ginásio; ajusta os exercícios manualmente se algo não for possível aí.`);
  why.push(adjustments.length ? `Ajustes: ${adjustments.join("; ")}.` : "Prontidão boa: sessão como planeada.");

  if (prog && prog.week > 1 && !prog.deloadWeek && prog.reason) why.splice(1, 0, `Progressão (semana ${prog.week}): ${prog.reason}`);
  return {
    dayIndex, dayName: day.dayName, title: day.label, type: day.type,
    adjustments, rehab, warmup, cooldown, weeksOut, phase, why, exercises,
    weekNumber: prog ? prog.week : 1, deloadWeek: prog ? prog.deloadWeek : false,
    goalShort: (GOALS.find((g) => g.id === profile.goal) || {}).short || "",
  };
}

function autoregulate(set, rpe, bw) {
  if (bw || set.w == null) {
    if (rpe >= 9.5) return { reps: Math.max(3, set.reps - 3), msg: "RPE 10 — próximas séries −3 reps." };
    if (rpe >= 9) return { reps: Math.max(3, set.reps - 2), msg: "Perto do limite — −2 reps." };
    if (rpe <= 6) return { reps: set.reps + 2, msg: "Fácil demais — +2 reps. Estimativa atualizada." };
    return { reps: set.reps, msg: "Na zona certa. Mantém." };
  }
  if (rpe >= 9.5) return { w: round25(set.w * 0.93), msg: "RPE 10 — próxima série −7%." };
  if (rpe >= 9) return { w: round25(set.w * 0.96), msg: "Perto do limite — próxima −4%." };
  if (rpe <= 6) return { w: round25(set.w + 2.5), msg: "Estava leve — +2,5 kg. Força atualizada." };
  return { w: set.w, msg: "Na zona certa. Mantém." };
}

const LIBRARY = [
  { name: "Agachamento com barra", muscle: "Pernas", avoid: ["joelho"] },
  { name: "Leg press", muscle: "Pernas", avoid: [] },
  { name: "Levantamento terra", muscle: "Posterior", avoid: ["lombar"] },
  { name: "Hip thrust", muscle: "Glúteo", avoid: [] },
  { name: "Supino com barra", muscle: "Peito", avoid: ["ombro"] },
  { name: "Supino neutro c/ halteres", muscle: "Peito", avoid: [] },
  { name: "Press militar", muscle: "Ombros", avoid: ["ombro"] },
  { name: "Elevações laterais", muscle: "Ombros", avoid: [] },
  { name: "Remada curvada", muscle: "Costas", avoid: ["lombar"] },
  { name: "Puxada na barra", muscle: "Costas", avoid: [] },
  { name: "Rosca direta", muscle: "Braços", avoid: ["cotovelo"] },
  { name: "Tríceps na corda", muscle: "Braços", avoid: ["cotovelo"] },
  { name: "Elevações (pull-ups)", muscle: "Costas", bw: true, avoid: [] },
  { name: "Flexões", muscle: "Peito", bw: true, avoid: ["ombro"] },
  { name: "Prancha", muscle: "Core", bw: true, avoid: [] },
];
const E1RM_REF = E1RM;
const SEX_MULT_REF = SEX_MULT;

/* ============================================================
   APEX — UI v6 (semana navegável + reordenar exercícios)
   ============================================================ */const T = { bg: "#0F1319", surface: "#171D26", raised: "#1E2631", line: "#2A3441", text: "#EEF2F6", muted: "#94A1B0", faint: "#5D6B7A", accent: "#3D6BFF", accentSoft: "rgba(61,107,255,0.14)", good: "#3FD9A4", mid: "#F2B33D", low: "#F2604F" };
const FONT = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { margin: 0; }
@keyframes fadeUp { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:none;} }
@keyframes pulse { 0%,100% { opacity:1;} 50% { opacity:.35;} }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
textarea:focus, input:focus { outline: 1px solid #3D6BFF; }
input[type="date"] { color-scheme: dark; }
input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }
`;
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

function Eyebrow({ children, color }) { return <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: color || T.faint, fontWeight: 600 }}>{children}</div>; }
function Chip({ label, active, onClick, small, disabled }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: small ? "8px 12px" : "12px 16px", borderRadius: 999, cursor: disabled ? "default" : "pointer", border: `1px solid ${active ? T.accent : T.line}`, background: active ? T.accentSoft : "transparent", color: disabled ? T.faint : active ? T.text : T.muted, fontFamily: "Archivo", fontSize: small ? 13 : 15, fontWeight: 600, transition: "all .15s", textAlign: "left", opacity: disabled ? 0.5 : 1 }}>{label}</button>;
}
function Stepper({ onDec, onInc, size }) {
  const s = size || 34;
  const btn = { width: s, height: s, borderRadius: 9, border: `1px solid ${T.line}`, background: T.raised, color: T.text, fontSize: s / 2, fontWeight: 700, cursor: "pointer", fontFamily: "Archivo", lineHeight: 1 };
  return <span style={{ display: "inline-flex", gap: 6 }} onClick={(e) => e.stopPropagation()}><button style={btn} onClick={onDec}>−</button><button style={btn} onClick={onInc}>+</button></span>;
}
function Toggle({ on, onClick }) { return <button onClick={onClick} style={{ width: 46, height: 27, borderRadius: 999, border: "none", cursor: "pointer", background: on ? T.accent : T.line, position: "relative", transition: "background .2s", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: "50%", background: "#fff", transition: "left .2s" }} /></button>; }
function ReadinessRings({ r }) {
  const systems = [{ radius: 64, val: r.muscular }, { radius: 50, val: r.cardio }, { radius: 36, val: r.snc }];
  const col = (v) => (v >= 70 ? T.good : v >= 55 ? T.mid : T.low);
  const composite = Math.round((r.muscular + r.cardio + r.snc) / 3); const sweep = 260, start = 140;
  return (<svg viewBox="0 0 160 160" style={{ width: 168, height: 168 }}>{systems.map((s, k) => { const c = 2 * Math.PI * s.radius, frac = sweep / 360; return (<g key={k} transform={`rotate(${start} 80 80)`}><circle cx="80" cy="80" r={s.radius} fill="none" stroke={T.line} strokeWidth="7" strokeDasharray={`${c * frac} ${c}`} strokeLinecap="round" /><circle cx="80" cy="80" r={s.radius} fill="none" stroke={col(s.val)} strokeWidth="7" strokeDasharray={`${c * frac * (s.val / 100)} ${c}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .6s ease, stroke .6s" }} /></g>); })}<text x="80" y="78" textAnchor="middle" fill={col(composite)} style={{ ...mono, fontSize: 30, fontWeight: 600 }}>{composite}</text><text x="80" y="96" textAnchor="middle" fill={T.faint} style={{ ...mono, fontSize: 8, letterSpacing: "0.2em" }}>PRONTIDÃO</text></svg>);
}
function MacroBar({ weeksOut, phase }) {
  if (weeksOut == null || !phase) return null;
  const phases = ["Acumulação", "Intensificação", "Taper"];
  return (<div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16, marginBottom: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><Eyebrow color={T.accent}>Caminho até à prova</Eyebrow><span style={{ ...mono, fontSize: 12, color: T.text, fontWeight: 600 }}>{weeksOut} sem.</span></div><div style={{ display: "flex", gap: 4, marginTop: 12 }}>{phases.map((p, i) => (<div key={p} style={{ flex: i === 0 ? 5 : i === 1 ? 3 : 1.5 }}><div style={{ height: 6, borderRadius: 3, background: i === phase.idx ? T.accent : i < phase.idx ? "rgba(61,107,255,0.35)" : T.line, transition: "background .4s" }} /><div style={{ fontSize: 9.5, marginTop: 5, color: i === phase.idx ? T.text : T.faint, fontWeight: i === phase.idx ? 700 : 500, ...mono, letterSpacing: "0.04em" }}>{p.toUpperCase()}</div></div>))}</div><p style={{ fontSize: 12.5, color: T.muted, margin: "10px 0 0", lineHeight: 1.5 }}><span style={{ color: T.text, fontWeight: 600 }}>{phase.name}:</span> {phase.desc}</p></div>);
}

/* ==================== ONBOARDING ==================== */
const LEVELS = [{ id: "iniciante", label: "A começar" }, { id: "intermedio", label: "Treino há 1–3 anos" }, { id: "avancado", label: "Avançado / competidor" }];
const EQUIP = [{ id: "ginasio", label: "Ginásio" }, { id: "casa", label: "Em casa" }, { id: "hibrido", label: "Casa + Ginásio" }, { id: "parque", label: "Parque de calistenia" }, { id: "outro", label: "✎ Outro (escrever)" }];
const INJURIES = ["ombro", "cotovelo", "pulso", "joelho", "lombar", "anca", "tornozelo", "pescoco"];
const INJ_LABEL = { ombro: "Ombro", cotovelo: "Cotovelo", pulso: "Pulso", joelho: "Joelho", lombar: "Lombar", anca: "Anca", tornozelo: "Tornozelo", pescoco: "Pescoço" };
const EVENT_GOALS = ["hyrox", "custom"];

function Onboarding({ onDone }) {
  const [p, setP] = useState({ goal: null, customText: "", photo: null, eventDate: "", focus: [], focusNote: "", sex: null, level: null, days: 4, equipment: "ginasio", equipmentNote: "", injuries: [], injuryNote: "", physio: null, splitStyle: "freq" });
  const fileRef = useRef(null);
  const stepIds = ["goal", ...(HYPERTROPHY_GOALS.includes(p.goal) ? ["focus"] : []), "sex", "level", "days", "equip", "inj"];
  const [stepIdx, setStepIdx] = useState(0);
  const stepId = stepIds[Math.min(stepIdx, stepIds.length - 1)];
  const hasEvent = EVENT_GOALS.includes(p.goal);
  const toggleInj = (i) => setP((q) => { const has = q.injuries.includes(i); const inj = has ? q.injuries.filter((x) => x !== i) : [...q.injuries, i]; return { ...q, injuries: inj, physio: (inj.length || q.injuryNote.trim()) ? q.physio : null }; });
  const toggleFocus = (f) => setP((q) => { if (f === "nenhum") return { ...q, focus: [] }; const has = q.focus.includes(f); if (!has && q.focus.length >= 2) return q; return { ...q, focus: has ? q.focus.filter((x) => x !== f) : [...q.focus, f] }; });
  const onPhoto = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setP((q) => ({ ...q, photo: r.result, goal: "custom" })); r.readAsDataURL(f); };
  const hasInjury = p.injuries.length > 0 || p.injuryNote.trim().length > 0;
  const canNext = { goal: p.goal && (p.goal !== "custom" || p.customText.trim() || p.photo), focus: true, sex: p.sex, level: p.level, days: true, equip: true, inj: !hasInjury || p.physio }[stepId];
  const next = () => { if (stepIdx < stepIds.length - 1) setStepIdx(stepIdx + 1); else { const goalLabel = p.goal === "custom" ? (p.customText.trim() ? p.customText.trim().slice(0, 60) : "Prova específica") : (GOALS.find((g) => g.id === p.goal) || {}).label; onDone({ ...p, goal: p.goal === "custom" ? "hibrido" : p.goal, realGoal: p.goal, goalLabel, customGoal: p.goal === "custom" }); } };
  const Q = (title, sub, children) => (<div style={{ animation: "fadeUp .35s ease" }}><h2 style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 25, margin: "0 0 6px", lineHeight: 1.15 }}>{title}</h2>{sub && <p style={{ color: T.muted, fontSize: 14, margin: "0 0 18px" }}>{sub}</p>}{children}</div>);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 24, overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>{stepIds.map((_, i) => <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= stepIdx ? T.accent : T.line, transition: "background .3s" }} />)}</div>
      <div style={{ flex: 1 }}>
        {stepId === "goal" && Q('Qual é o teu objetivo?', 'Cada objetivo gera uma semana de treino diferente — com base científica própria.', <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{GOALS.map((g) => <Chip key={g.id} label={g.label} active={p.goal === g.id} onClick={() => setP({ ...p, goal: g.id })} />)}<Chip label="✎ Outro objetivo / prova" active={p.goal === "custom"} onClick={() => setP({ ...p, goal: "custom" })} /></div>
          {p.goal === "custom" && (<div style={{ marginTop: 14 }}><textarea value={p.customText} onChange={(e) => setP({ ...p, customText: e.target.value })} rows={3} placeholder="Ex.: «Prova da GNR: 2400 m em 12 min, flexões, abdominais»" style={{ width: "100%", background: T.raised, border: `1px solid ${T.line}`, borderRadius: 12, color: T.text, fontFamily: "Archivo", fontSize: 14, padding: 12, resize: "vertical" }} /><input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} /><button onClick={() => fileRef.current && fileRef.current.click()} style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, cursor: "pointer", border: `1px dashed ${p.photo ? T.good : T.line}`, background: "transparent", color: p.photo ? T.good : T.muted, fontFamily: "Archivo", fontWeight: 600, fontSize: 14 }}>{p.photo ? "✓ Foto carregada" : "📷 Adicionar foto da prova"}</button>{p.photo && <img src={p.photo} alt="Prova" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 12, marginTop: 8, border: `1px solid ${T.line}` }} />}{p.photo && <p style={{ fontSize: 12, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>Podes também escrever os exercícios da prova na caixa acima — a IA combina a foto e o texto.</p>}</div>)}
          {hasEvent && (<div style={{ marginTop: 14 }}><div style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Quando é a prova?</div><input type="date" value={p.eventDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setP({ ...p, eventDate: e.target.value })} style={{ width: "100%", background: T.raised, border: `1px solid ${p.eventDate ? T.accent : T.line}`, borderRadius: 12, color: T.text, fontFamily: "Archivo", fontSize: 15, padding: "12px 14px" }} /><p style={{ fontSize: 12, color: T.faint, margin: "8px 0 0", lineHeight: 1.5 }}>{p.eventDate ? `${weeksUntil(p.eventDate)} semana(s) — o motor divide o tempo em fases.` : "Opcional — com data, o plano ganha fases."}</p></div>)}
        </>)}
        {stepId === "focus" && Q('Foco em alguma zona?', 'Só na musculação. Escolhe até 2 — acessórios extra no dia certo do split.', <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Chip small label="Sem foco" active={p.focus.length === 0 && !p.focusNote.trim()} onClick={() => { toggleFocus("nenhum"); setP((q)=>({...q, focusNote:""})); }} />{Object.entries(FOCUS_WORK).map(([id, f]) => <Chip key={id} small label={f.label} active={p.focus.includes(id)} onClick={() => toggleFocus(id)} />)}</div>
          <textarea value={p.focusNote} onChange={(e) => setP({ ...p, focusNote: e.target.value })} rows={2} placeholder="Outro foco nas tuas palavras (ex.: «quero uns gémeos maiores» ou «parte de cima do peito»)" style={{ width: "100%", marginTop: 12, background: T.raised, border: `1px solid ${T.line}`, borderRadius: 12, color: T.text, fontFamily: "Archivo", fontSize: 14, padding: 12, resize: "vertical" }} />
          {p.focusNote.trim() && <p style={{ fontSize: 12, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>A IA vai interpretar o teu pedido e reforçar o trabalho dessa zona no dia certo do split.</p>}
        </>)}
        {stepId === "sex" && Q('Sexo', 'Ajusta as estimativas iniciais de carga.', <><div style={{ display: "flex", gap: 8 }}><Chip label="Homem" active={p.sex === "homem"} onClick={() => setP({ ...p, sex: "homem" })} /><Chip label="Mulher" active={p.sex === "mulher"} onClick={() => setP({ ...p, sex: "mulher" })} /></div></>)}
        {stepId === "level" && Q('O teu nível', 'Ponto de partida das cargas — tudo se ajusta.', <><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{LEVELS.map((l) => <Chip key={l.id} label={l.label} active={p.level === l.id} onClick={() => setP({ ...p, level: l.id })} />)}</div></>)}
        {stepId === "days" && Q('Dias por semana?', 'Sê realista — o melhor plano é o que cumpres.', <><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{[3, 4, 5, 6].map((d) => <Chip key={d} label={`${d} dias`} active={p.days === d} onClick={() => setP({ ...p, days: d })} />)}</div></>)}
        {stepId === "equip" && Q('Onde vais treinar?', 'O motor adapta exercícios e cargas ao local.', <><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{EQUIP.map((e) => <Chip key={e.id} label={e.label} active={p.equipment === e.id} onClick={() => setP({ ...p, equipment: e.id })} />)}</div>
          {p.equipment === "outro" && <textarea value={p.equipmentNote} onChange={(e) => setP({ ...p, equipmentNote: e.target.value })} rows={2} placeholder="Descreve onde treinas e o que tens disponível (ex.: «quintal de casa, só um kettlebell de 16kg e uma barra fixa»)" style={{ width: "100%", marginTop: 12, background: T.raised, border: `1px solid ${T.line}`, borderRadius: 12, color: T.text, fontFamily: "Archivo", fontSize: 14, padding: 12, resize: "vertical" }} />}
          {p.equipment === "outro" && p.equipmentNote.trim() && <p style={{ fontSize: 12, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>Vou tratar isto como um ginásio equivalente por agora e ajustar os exercícios à medida que registas o que consegues ou não fazer.</p>}</>)}
        {stepId === "inj" && Q('Alguma lesão ou zona sensível?', 'Seleciona ou descreve. O motor substitui exercícios contraindicados.', <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{INJURIES.map((i) => <Chip key={i} small label={INJ_LABEL[i]} active={p.injuries.includes(i)} onClick={() => toggleInj(i)} />)}</div>
          <textarea value={p.injuryNote} onChange={(e) => setP({ ...p, injuryNote: e.target.value })} rows={2} placeholder="Outra lesão ou detalhe (ex.: «tendinite no ombro direito»)" style={{ width: "100%", marginTop: 12, background: T.raised, border: `1px solid ${T.line}`, borderRadius: 12, color: T.text, fontFamily: "Archivo", fontSize: 14, padding: 12, resize: "vertical" }} />
          {hasInjury && (<div style={{ marginTop: 16 }}><div style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Estás a fazer fisioterapia?</div><div style={{ display: "flex", gap: 8 }}><Chip small label="Sim, com profissional" active={p.physio === "sim"} onClick={() => setP({ ...p, physio: "sim" })} /><Chip small label="Não" active={p.physio === "nao"} onClick={() => setP({ ...p, physio: "nao" })} /></div>{p.physio === "nao" && <div style={{ marginTop: 12, background: "rgba(242,179,61,0.08)", border: "1px solid rgba(242,179,61,0.3)", borderRadius: 12, padding: 12, fontSize: 12.5, color: T.muted, lineHeight: 1.55 }}>Vou incluir um <span style={{ color: T.text, fontWeight: 600 }}>bloco de recuperação</span>. <span style={{ color: T.mid }}>Não substitui um fisioterapeuta</span>.</div>}</div>)}
        </>)}
      </div>
      <button onClick={next} disabled={!canNext} style={{ padding: 16, borderRadius: 14, border: "none", cursor: canNext ? "pointer" : "default", background: canNext ? T.accent : T.raised, color: canNext ? "#fff" : T.faint, fontFamily: "Archivo", fontWeight: 700, fontSize: 16, marginTop: 16, flexShrink: 0 }}>{stepIdx < stepIds.length - 1 ? "Continuar" : "Gerar o meu plano"}</button>
    </div>
  );
}

function Building({ profile, onDone }) {
  const w = weeksUntil(profile.eventDate);
  const lines = ["A analisar o teu perfil", ...(profile.customGoal ? ["A interpretar o teu objetivo"] : []), `A montar a semana de ${(GOALS.find(g=>g.id===profile.goal)||{}).short}`, ...(w != null ? [`A dividir ${w} semanas em fases`] : []), "A calcular cargas científicas", ...(profile.injuries.length || profile.injuryNote ? ["A verificar contraindicações"] : []), "A finalizar o teu split"];
  const [i, setI] = useState(0);
  useEffect(() => { if (i < lines.length) { const t = setTimeout(() => setI(i + 1), 460); return () => clearTimeout(t); } const t = setTimeout(onDone, 520); return () => clearTimeout(t); }, [i]);
  return (<div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 32, gap: 13 }}><Eyebrow color={T.accent}>Planning Engine</Eyebrow>{lines.map((l, k) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, opacity: k <= i ? 1 : 0.25, transition: "opacity .3s", ...mono, fontSize: 13, color: k < i ? T.good : T.text }}><span style={{ width: 16 }}>{k < i ? "✓" : k === i ? <span style={{ animation: "pulse 1s infinite" }}>●</span> : "○"}</span>{l}</div>)}</div>);
}

function SessionPrefs({ prefs, setPrefs, profile, setProfile }) {
  const Row = ({ label, desc, k }) => (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderTop: `1px solid ${T.line}` }}><div><div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 11.5, color: T.faint, marginTop: 2, lineHeight: 1.4 }}>{desc}</div></div><Toggle on={prefs[k]} onClick={() => setPrefs((q) => ({ ...q, [k]: !q[k] }))} /></div>);
  const isHyp = profile.goal === "forca";
  return (<div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: "6px 16px 14px", marginBottom: 14 }}><div style={{ paddingTop: 12 }}><Eyebrow>Estrutura da sessão</Eyebrow></div><Row label="Aquecimento" desc="Específico ao treino do dia" k="warmup" /><Row label="Alongamentos" desc="Retorno à calma dirigido" k="cooldown" />
    {isHyp && (<div style={{ padding: "12px 0 0", borderTop: `1px solid ${T.line}` }}><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Estilo de split</div><div style={{ display: "flex", gap: 8 }}><Chip small label="Frequência 2×" active={profile.splitStyle !== "bro"} onClick={() => setProfile((q) => ({ ...q, splitStyle: "freq" }))} /><Chip small label="1 músculo/dia" active={profile.splitStyle === "bro"} onClick={() => setProfile((q) => ({ ...q, splitStyle: "bro" }))} /></div></div>)}
  </div>);
}

/* ==================== WEEK OVERVIEW (navegável) ==================== */
function WeekView({ profile, week, todayIdx, onOpenDay }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
      <Eyebrow>A tua semana · toca num dia para ver e começar</Eyebrow>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {week.map((d) => {
          const today = d.dayIndex === todayIdx;
          return (
            <button key={d.dayIndex} onClick={() => !d.rest && onOpenDay(d.dayIndex)} disabled={d.rest} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, textAlign: "left",
              border: `1px solid ${today ? T.accent : T.line}`, background: today ? T.accentSoft : d.rest ? "transparent" : T.raised,
              cursor: d.rest ? "default" : "pointer", opacity: d.rest ? 0.5 : 1, width: "100%",
            }}>
              <div style={{ ...mono, fontSize: 11, color: today ? T.accent : T.faint, width: 30, fontWeight: 600 }}>{d.dayShort}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 14.5, color: d.rest ? T.faint : T.text }}>{d.rest ? "Descanso" : d.label}</div>
                {today && !d.rest && <div style={{ ...mono, fontSize: 9.5, color: T.accent, marginTop: 2 }}>HOJE · RECOMENDADO</div>}
              </div>
              {!d.rest && <div style={{ color: T.faint, fontSize: 18 }}>›</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ==================== DAY DETAIL ==================== */
function DayDetail({ session, prefs, onReorder, onStart, onBack, isToday }) {
  const [showWhy, setShowWhy] = useState(false);
  const [editOrder, setEditOrder] = useState(false);
  const Block = ({ title, items, color }) => items && items.length ? (<div style={{ background: T.raised, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}><Eyebrow color={color}>{title}</Eyebrow>{items.map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}><span>{r.name}</span><span style={{ ...mono, fontSize: 11, color: T.muted }}>{r.dose}</span></div>)}</div>) : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><Eyebrow color={T.accent}>{session.dayName}{isToday ? " · Hoje" : ""}</Eyebrow><div style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 21, marginTop: 3 }}>{session.title}</div></div>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.faint, fontFamily: "Archivo", fontSize: 13, cursor: "pointer" }}>Voltar</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {session.adjustments.length > 0 && <div style={{ background: "rgba(242,179,61,0.1)", border: "1px solid rgba(242,179,61,0.35)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}><Eyebrow color={T.mid}>O motor adaptou</Eyebrow>{session.adjustments.map((a, i) => <div key={i} style={{ fontSize: 13, color: T.text, marginTop: 4 }}>· {a}</div>)}</div>}
        <Block title="Aquecimento" items={session.warmup} color={T.mid} />
        <Block title="Recuperação · antes do treino" items={session.rehab} color={T.good} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Eyebrow>Exercícios</Eyebrow>
          <button onClick={() => setEditOrder(!editOrder)} style={{ background: "none", border: "none", color: T.accent, fontFamily: "Archivo", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{editOrder ? "Concluir" : "↕ Reordenar"}</button>
        </div>

        {session.exercises.map((ex, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
            {editOrder && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => onReorder(i, i - 1)} disabled={i === 0} style={{ width: 30, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: i === 0 ? "transparent" : T.raised, color: i === 0 ? T.faint : T.text, cursor: i === 0 ? "default" : "pointer", fontSize: 12, opacity: i === 0 ? 0.4 : 1 }}>▲</button>
                <button onClick={() => onReorder(i, i + 1)} disabled={i === session.exercises.length - 1} style={{ width: 30, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: i === session.exercises.length - 1 ? "transparent" : T.raised, color: i === session.exercises.length - 1 ? T.faint : T.text, cursor: i === session.exercises.length - 1 ? "default" : "pointer", fontSize: 12, opacity: i === session.exercises.length - 1 ? 0.4 : 1 }}>▼</button>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{i + 1}. {ex.name}{ex.focusTag && <span style={{ ...mono, fontSize: 9, color: T.accent, border: `1px solid ${T.accent}`, borderRadius: 5, padding: "2px 5px", marginLeft: 7 }}>FOCO</span>}</div>
              {ex.swap && <div style={{ fontSize: 11.5, color: T.mid, marginTop: 2 }}>⇄ {ex.swap}</div>}
              {ex.detail && <div style={{ fontSize: 11.5, color: T.faint, marginTop: 2 }}>{ex.detail}</div>}
            </div>
            <div style={{ ...mono, fontSize: 12.5, color: T.muted, whiteSpace: "nowrap", textAlign: "right" }}>{ex.sets.length > 1 ? `${ex.sets.length}×` : ""}{ex.sets[0].reps > 0 ? ex.sets[0].reps : ""}{ex.sets[0].w ? ` · ${ex.sets[0].w}kg` : ""}<div style={{ fontSize: 9.5, color: T.faint }}>RPE {ex.sets[0].rpe}</div></div>
          </div>
        ))}

        <button onClick={() => setShowWhy(!showWhy)} style={{ background: "none", border: "none", color: T.accent, fontFamily: "Archivo", fontWeight: 600, fontSize: 13, padding: "12px 0", cursor: "pointer" }}>{showWhy ? "Ocultar a ciência" : "Porquê esta sessão? (base científica)"}</button>
        {showWhy && <div>{session.why.map((w, i) => <p key={i} style={{ fontSize: 13, color: i === 0 ? T.text : T.muted, lineHeight: 1.55, margin: "0 0 8px" }}>{w}</p>)}</div>}
      </div>
      <div style={{ borderTop: `1px solid ${T.line}`, padding: "14px 20px 18px", background: T.surface }}>
        <button onClick={onStart} style={{ width: "100%", padding: 15, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontFamily: "Archivo", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Começar este treino</button>
      </div>
    </div>
  );
}

/* ==================== ESCOLHA DE SPLIT (só hipertrofia) ==================== */
function SplitChoice({ profile, onChoose }) {
  const opts = splitOptions(profile);
  const [sel, setSel] = useState("freq");
  const Card = ({ o }) => (
    <button onClick={() => setSel(o.id)} style={{ textAlign: "left", width: "100%", background: sel === o.id ? T.accentSoft : T.surface, border: `1px solid ${sel === o.id ? T.accent : T.line}`, borderRadius: 16, padding: 16, cursor: "pointer", marginBottom: 12, transition: "all .15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 16 }}>{o.title}</div>
        <span style={{ ...mono, fontSize: 9, color: o.id === "freq" ? T.good : T.mid, border: `1px solid ${o.id === "freq" ? T.good : T.mid}`, borderRadius: 5, padding: "2px 6px" }}>{o.tag.toUpperCase()}</span>
      </div>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "8px 0 10px", lineHeight: 1.5 }}>{o.desc}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{o.days.map((d, i) => <span key={i} style={{ ...mono, fontSize: 10.5, background: T.raised, border: `1px solid ${T.line}`, borderRadius: 6, padding: "3px 7px", color: T.muted }}>{d}</span>)}</div>
    </button>
  );
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: 24, overflowY: "auto" }}>
      <Eyebrow color={T.accent}>Dois caminhos para o mesmo objetivo</Eyebrow>
      <h2 style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 24, margin: "6px 0 6px", lineHeight: 1.15 }}>Que estrutura preferes?</h2>
      <p style={{ color: T.muted, fontSize: 13.5, margin: "0 0 20px", lineHeight: 1.5 }}>Criei os dois planos para os teus {profile.days} dias. Escolhe com qual queres avançar — podes trocar mais tarde.</p>
      <div style={{ flex: 1 }}>
        <Card o={opts.freq} />
        <Card o={opts.bro} />
      </div>
      <button onClick={() => onChoose(sel)} style={{ padding: 16, borderRadius: 14, border: "none", cursor: "pointer", background: T.accent, color: "#fff", fontFamily: "Archivo", fontWeight: 700, fontSize: 16, marginTop: 12, flexShrink: 0 }}>Avançar com este plano</button>
    </div>
  );
}

/* ==================== HOME ==================== */
function Home({ profile, setProfile, maxes, prefs, setPrefs, partner, setPartner, R, setScenario, scenario, onOpenDay, onBuild, prog, weekLog, onAdvanceWeek, checkinFlags }) {
  const [showPartner, setShowPartner] = useState(false);
  const [pInput, setPInput] = useState("");
  const week = getWeekPlan(profile);
  const todayIdx = 3; // Quinta, para bater com a demo
  const todaySession = buildDaySession(profile, R, maxes, prefs, todayIdx, prog, checkinFlags);
  const weeksOut = todaySession ? todaySession.weeksOut : weeksUntil(profile.eventDate);
  const phase = todaySession ? todaySession.phase : macroPhase(weeksOut);

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "24px 20px 32px" }}>
      <Eyebrow>{DAY_NAMES[todayIdx]}{phase ? ` · ${phase.name}` : ""} · {(GOALS.find(g=>g.id===profile.goal)||{}).short}</Eyebrow>
      <h1 style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 28, margin: "6px 0 4px" }}>Bom dia.</h1>
      <p style={{ color: T.muted, fontSize: 13, margin: "0 0 16px" }}>A treinar para: <span style={{ color: T.text, fontWeight: 600 }}>{profile.goalLabel}</span></p>

      <MacroBar weeksOut={weeksOut} phase={phase} />

      {/* Progressão semanal — o treino evolui */}
      <div style={{ background: T.surface, border: `1px solid ${prog.deloadWeek ? T.mid : T.line}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow color={prog.deloadWeek ? T.mid : T.accent}>{prog.deloadWeek ? "Semana de descarga" : `Semana ${prog.week} · sobrecarga progressiva`}</Eyebrow>
          {prog.streak > 0 && !prog.deloadWeek && <span style={{ ...mono, fontSize: 10, color: T.good }}>🔥 {prog.streak} sem. a progredir</span>}
        </div>
        {prog.week > 1 && prog.reason ? (
          <p style={{ fontSize: 13, color: T.text, margin: "8px 0 0", lineHeight: 1.5 }}>{prog.reason}</p>
        ) : (
          <p style={{ fontSize: 13, color: T.muted, margin: "8px 0 0", lineHeight: 1.5 }}>À medida que treinas, o motor lê o teu esforço (RPE) e faz as cargas subirem sozinhas — primeiro reps, depois peso. Completa a semana para veres.</p>
        )}
        {prog.loadBonus > 0 && <div style={{ ...mono, fontSize: 11.5, color: T.good, marginTop: 8 }}>+{prog.loadBonus} kg acumulados nos compostos desde o início</div>}
        <button onClick={onAdvanceWeek} style={{ width: "100%", marginTop: 12, padding: 11, borderRadius: 10, border: `1px solid ${T.line}`, background: T.raised, color: T.muted, fontFamily: "Archivo", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          {weekLog.length ? `Avançar para a semana ${prog.week + 1} (${weekLog.length} treino${weekLog.length > 1 ? "s" : ""} registado${weekLog.length > 1 ? "s" : ""})` : "Simular fim da semana → próxima"}
        </button>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <Eyebrow>Simular a manhã</Eyebrow>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><Chip small label="Dormi bem" active={scenario === "boa"} onClick={() => setScenario("boa")} /><Chip small label="Dormi mal · HRV↓" active={scenario === "ma"} onClick={() => setScenario("ma")} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}><ReadinessRings r={R} /><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[["Muscular", R.muscular], ["Cardio", R.cardio], ["SNC", R.snc]].map(([l, v]) => <div key={l}><div style={{ ...mono, fontSize: 10, color: T.faint, letterSpacing: "0.12em" }}>{l.toUpperCase()}</div><div style={{ ...mono, fontSize: 18, fontWeight: 600, color: v >= 70 ? T.good : v >= 55 ? T.mid : T.low }}>{v}</div></div>)}</div></div>
      </div>

      {/* Treino de hoje — destaque */}
      {todaySession && (
        <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <Eyebrow color={T.accent}>Recomendado para hoje</Eyebrow>
          <div style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 20, margin: "6px 0 2px" }}>{todaySession.title}</div>
          <div style={{ ...mono, fontSize: 11.5, color: T.muted, marginBottom: 12 }}>{todaySession.exercises.length} exercícios · {todaySession.exercises.reduce((a, e) => a + e.sets.length, 0)} séries</div>
          <button onClick={() => onOpenDay(todayIdx)} style={{ width: "100%", padding: 15, borderRadius: 12, border: "none", background: T.accent, color: "#fff", fontFamily: "Archivo", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Ver e começar</button>
        </div>
      )}

      <SessionPrefs prefs={prefs} setPrefs={setPrefs} profile={profile} setProfile={setProfile} />

      {/* Semana navegável */}
      <WeekView profile={profile} week={week} todayIdx={todayIdx} onOpenDay={onOpenDay} />

      <div style={{ background: T.surface, border: `1px solid ${partner ? T.accent : T.line}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Eyebrow color={partner ? T.accent : undefined}>Treino a dois</Eyebrow>{partner && <button onClick={() => setPartner(null)} style={{ background: "none", border: "none", color: T.faint, fontSize: 12, cursor: "pointer", fontFamily: "Archivo" }}>Terminar</button>}</div>
        {partner ? <div style={{ marginTop: 8 }}><div style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 16 }}>👥 A treinar com {partner}</div><p style={{ fontSize: 12.5, color: T.muted, margin: "6px 0 0", lineHeight: 1.5 }}>Alternem séries — o descanso de um é a série do outro.</p></div>
        : showPartner ? <div style={{ marginTop: 10 }}><input value={pInput} onChange={(e) => setPInput(e.target.value)} placeholder="Nome ou código (ex.: Rui · APX-2941)" style={{ width: "100%", background: T.raised, border: `1px solid ${T.line}`, borderRadius: 12, color: T.text, fontFamily: "Archivo", fontSize: 14, padding: "11px 13px" }} /><button onClick={() => { if (pInput.trim()) { setPartner(pInput.trim()); setShowPartner(false); setPInput(""); } }} style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "none", background: pInput.trim() ? T.accent : T.raised, color: pInput.trim() ? "#fff" : T.faint, fontFamily: "Archivo", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Ligar sessão conjunta</button></div>
        : <button onClick={() => setShowPartner(true)} style={{ marginTop: 8, background: "none", border: `1px dashed ${T.line}`, borderRadius: 12, padding: "10px 14px", color: T.muted, fontFamily: "Archivo", fontWeight: 600, fontSize: 13.5, cursor: "pointer", width: "100%" }}>+ Vou treinar com alguém</button>}
      </div>

      <button onClick={onBuild} style={{ width: "100%", padding: 14, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.muted, fontFamily: "Archivo", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Prefiro criar o meu próprio treino</button>
    </div>
  );
}

/* ==================== PROGRESSO ==================== */
/* ==================== GRÁFICO DE LINHA (SVG puro, sem dependências) ==================== */
function LineChart({ data, unit, color, height, showDots }) {
  const h = height || 130;
  const w = 300; // viewBox; escala responsiva
  const pad = { l: 34, r: 10, t: 12, b: 20 };
  if (!data || data.length === 0) return <div style={{ ...mono, fontSize: 12, color: T.faint, padding: "20px 0", textAlign: "center" }}>Sem dados ainda — regista para começar a ver a linha.</div>;
  const col = color || T.accent;
  const vals = data.map((d) => d.y);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; } // evita divisão por zero num só ponto
  const range = max - min;
  const pMin = min - range * 0.12, pMax = max + range * 0.12;
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
  const x = (i) => pad.l + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v) => pad.t + plotH - ((v - pMin) / (pMax - pMin)) * plotH;
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.y).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(pad.t + plotH).toFixed(1)} L${x(0).toFixed(1)},${(pad.t + plotH).toFixed(1)} Z`;
  const gridVals = [pMax, (pMax + pMin) / 2, pMin];
  const first = data[0].y, last = data[data.length - 1].y;
  const delta = last - first;
  const gid = "g" + Math.random().toString(36).slice(2, 7);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.28" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
        {gridVals.map((gv, i) => (<g key={i}><line x1={pad.l} y1={y(gv)} x2={w - pad.r} y2={y(gv)} stroke={T.line} strokeWidth="0.6" /><text x={pad.l - 5} y={y(gv) + 3} textAnchor="end" fill={T.faint} style={{ ...mono, fontSize: 8 }}>{Math.round(gv * 10) / 10}</text></g>))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {(showDots || data.length <= 12) && data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.y)} r="2.5" fill={col} />)}
        <circle cx={x(data.length - 1)} cy={y(last)} r="3.5" fill={col} stroke={T.bg} strokeWidth="1.5" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
        <span style={{ ...mono, fontSize: 9.5, color: T.faint }}>{data[0].label} → {data[data.length - 1].label}</span>
        <span style={{ ...mono, fontSize: 11, color: delta > 0 ? T.good : delta < 0 ? T.low : T.faint, fontWeight: 600 }}>{delta > 0 ? "▲ +" : delta < 0 ? "▼ " : ""}{Math.abs(Math.round(delta * 10) / 10)}{delta !== 0 ? ` ${unit || ""}` : "sem variação"}</span>
      </div>
    </div>
  );
}

function Progress({ profile, maxes, logMax, maxHistory, body, setBody, logMetric, metricHistory, history, prog }) {
  const photoRef = useRef(null);
  const [chartLift, setChartLift] = useState("supino");
  const [chartMetric, setChartMetric] = useState("peso");
  const isStrength = STRENGTH_LIFT_GOALS.includes(profile.goal);
  const showBody = ["forca", "powerlifting", "hibrido"].includes(profile.goal);
  // Redimensiona a foto (máx. 600px, JPEG 80%) para caber no armazenamento persistente
  const downscale = (dataUrl) => new Promise((res) => { const img = new Image(); img.onload = () => { const s = Math.min(1, 600 / img.width); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.8)); }; img.onerror = () => res(dataUrl); img.src = dataUrl; });
  const onBodyPhoto = (e) => Array.from(e.target.files || []).forEach((f) => { const r = new FileReader(); r.onload = async () => { const small = await downscale(r.result); setBody((b) => ({ ...b, photos: [{ src: small, date: new Date().toLocaleDateString("pt-PT") }, ...b.photos].slice(0, 9) })); }; r.readAsDataURL(f); });
  const refMax = (k) => round25(E1RM_REF[profile.level][k] * (SEX_MULT_REF[profile.sex] || SEX_MULT_REF.homem)[k]);
  const METRICS = [{ k: "peso", label: "Peso corporal", unit: "kg" }, { k: "gordura", label: "Massa gorda", unit: "%" }, { k: "cintura", label: "Cintura", unit: "cm" }, { k: "braco", label: "Braço", unit: "cm" }, { k: "peito", label: "Peito", unit: "cm" }, { k: "coxa", label: "Coxa", unit: "cm" }];
  const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16, marginBottom: 14 };

  // Preparar séries para gráficos (rótulo = índice de registo)
  const toSeries = (arr) => (arr || []).map((p, i) => ({ y: p.y, label: "#" + (i + 1) }));
  const liftSeries = toSeries(maxHistory[chartLift]);
  const metricSeries = toSeries(metricHistory[chartMetric]);
  // Volume por treino (do histórico, ordem cronológica)
  const volSeries = [...history].reverse().filter((h) => h.volume > 0).map((h, i) => ({ y: Math.round(h.volume), label: "T" + (i + 1) }));
  // Progressão de carga acumulada (do motor)
  const progSeries = (prog && prog.history && prog.history.length) ? prog.history.map((h) => ({ y: h.week, label: "S" + h.week })) : [];

  const Sel = ({ opts, val, set, labelKey }) => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      {opts.map((o) => <Chip key={o.k || o} small label={o.label || LIFT_LABEL[o]} active={val === (o.k || o)} onClick={() => set(o.k || o)} />)}
    </div>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "24px 20px 32px" }}>
      <Eyebrow>A tua evolução em linha</Eyebrow><h1 style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 28, margin: "6px 0 18px" }}>Progresso</h1>

      {/* GRÁFICO: evolução de força (1RM) */}
      {isStrength && (
        <div style={card}>
          <Eyebrow color={T.accent}>Evolução de força (1RM)</Eyebrow>
          <div style={{ marginTop: 10 }}><Sel opts={Object.keys(LIFT_LABEL)} val={chartLift} set={setChartLift} /></div>
          <LineChart data={liftSeries} unit="kg" color={T.accent} />
        </div>
      )}

      {/* GRÁFICO: volume por treino */}
      <div style={card}>
        <Eyebrow color={T.good}>Volume por treino (kg totais)</Eyebrow>
        <p style={{ fontSize: 11.5, color: T.faint, margin: "6px 0 10px", lineHeight: 1.5 }}>Volume = séries × reps × carga. A tendência mostra se estás mesmo a fazer mais trabalho ao longo do tempo.</p>
        <LineChart data={volSeries} unit="kg" color={T.good} />
      </div>

      {/* GRÁFICO: peso / medidas */}
      {showBody && (
        <div style={card}>
          <Eyebrow color={T.mid}>Corpo ao longo do tempo</Eyebrow>
          <div style={{ marginTop: 10 }}><Sel opts={METRICS} val={chartMetric} set={setChartMetric} /></div>
          <LineChart data={metricSeries} unit={(METRICS.find((m) => m.k === chartMetric) || {}).unit} color={T.mid} />
        </div>
      )}

      {/* INPUT: cargas máximas (1RM) */}
      {isStrength && (<div style={card}><Eyebrow color={T.accent}>Registar carga máxima (1RM)</Eyebrow><p style={{ fontSize: 12.5, color: T.muted, margin: "8px 0 12px", lineHeight: 1.5 }}>Escreve os máximos — <span style={{ color: T.text, fontWeight: 600 }}>o motor usa-os nas cargas do plano</span> e cada registo entra no gráfico acima.</p>{Object.keys(LIFT_LABEL).map((k) => { const val = maxes[k]; const n = (maxHistory[k] || []).length; return (<div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${T.line}` }}><div><div style={{ fontSize: 14, fontWeight: 600 }}>{LIFT_LABEL[k]}</div><div style={{ ...mono, fontSize: 10.5, color: val ? T.good : T.faint }}>{val ? `EM USO · ${n} registo${n !== 1 ? "s" : ""}` : `estimativa: ${refMax(k)} kg`}</div></div><div style={{ display: "flex", alignItems: "center", gap: 6, background: T.raised, border: `1px solid ${val ? T.good : T.line}`, borderRadius: 10, padding: "0 12px 0 4px", height: 40 }}><input type="number" inputMode="decimal" step="2.5" defaultValue={val ?? ""} onBlur={(e) => { const v = e.target.value; logMax(k, v === "" ? null : Math.max(0, parseFloat(v))); }} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} placeholder={String(refMax(k))} style={{ width: 66, background: "transparent", border: "none", color: val ? T.text : T.faint, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 600, textAlign: "right", padding: "0 6px" }} /><span style={{ ...mono, fontSize: 12, color: T.faint }}>kg</span></div></div>); })}<p style={{ fontSize: 10.5, color: T.faint, marginTop: 10, lineHeight: 1.4 }}>Cada vez que atualizas um valor, guarda-se um ponto no gráfico. Toca fora do campo para registar.</p></div>)}

      {/* INPUT: métricas corporais */}
      {showBody && (<div style={card}><Eyebrow color={T.accent}>Registar métricas corporais</Eyebrow><p style={{ fontSize: 12.5, color: T.muted, margin: "8px 0 12px", lineHeight: 1.5 }}>Escreve os teus valores — cada registo entra no gráfico "Corpo ao longo do tempo".</p>{METRICS.map((m) => { const nn = (metricHistory[m.k] || []).length; return (<div key={m.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${T.line}` }}><div><span style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</span>{nn > 0 && <div style={{ ...mono, fontSize: 10, color: T.faint }}>{nn} registo{nn !== 1 ? "s" : ""}</div>}</div><div style={{ display: "flex", alignItems: "center", gap: 6, background: T.raised, border: `1px solid ${T.line}`, borderRadius: 10, padding: "0 12px 0 4px", height: 40 }}><input type="number" inputMode="decimal" step="0.5" defaultValue={body.metrics[m.k] ?? ""} onBlur={(e) => { const v = e.target.value; logMetric(m.k, v === "" ? undefined : Math.max(0, parseFloat(v))); }} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} placeholder="—" style={{ width: 70, background: "transparent", border: "none", color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 600, textAlign: "right", padding: "0 6px" }} /><span style={{ ...mono, fontSize: 12, color: T.faint }}>{m.unit}</span></div></div>); })}</div>)}

      {/* Fotos */}
      {showBody && (<div style={card}><Eyebrow color={T.accent}>Fotos de progresso</Eyebrow><p style={{ fontSize: 12.5, color: T.muted, margin: "8px 0 12px", lineHeight: 1.5 }}>O espelho mente menos que a balança. <span style={{ color: T.text }}>Ficam só no teu dispositivo.</span></p><input ref={photoRef} type="file" accept="image/*" multiple onChange={onBodyPhoto} style={{ display: "none" }} /><button onClick={() => photoRef.current && photoRef.current.click()} style={{ width: "100%", padding: 12, borderRadius: 12, cursor: "pointer", border: `1px dashed ${T.line}`, background: "transparent", color: T.muted, fontFamily: "Archivo", fontWeight: 600, fontSize: 14 }}>📷 Adicionar foto de hoje</button>{body.photos.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>{body.photos.map((ph, i) => <div key={i} style={{ position: "relative" }}><img src={ph.src} alt={ph.date} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 10, border: `1px solid ${T.line}` }} /><div style={{ ...mono, position: "absolute", bottom: 5, left: 5, fontSize: 8.5, background: "rgba(15,19,25,0.85)", padding: "2px 6px", borderRadius: 5, color: T.text }}>{ph.date}</div></div>)}</div>}</div>)}

      {/* Histórico */}
      <div style={card}><Eyebrow color={T.accent}>Histórico de treinos</Eyebrow>{history.length === 0 ? <p style={{ fontSize: 13, color: T.faint, margin: "10px 0 0", lineHeight: 1.55 }}>Cada treino concluído fica aqui para sempre.</p> : history.map((h, i) => <div key={i} style={{ padding: "11px 0", borderTop: `1px solid ${T.line}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontSize: 14.5, fontWeight: 700, fontFamily: "Archivo" }}>{h.title}</span><span style={{ ...mono, fontSize: 11, color: T.faint }}>{h.date}</span></div><div style={{ ...mono, fontSize: 11.5, color: T.muted, marginTop: 3 }}>{h.nSets} séries{h.volume > 0 ? ` · ${Math.round(h.volume).toLocaleString("pt-PT")} kg` : ""}{h.avgRpe ? ` · RPE ${Math.round(h.avgRpe * 10) / 10}` : ""}{h.partner ? ` · 👥 ${h.partner}` : ""}</div>{h.checkin && ((h.checkin.zones && h.checkin.zones.length) || h.checkin.note) && <div style={{ fontSize: 11.5, color: T.mid, marginTop: 4, lineHeight: 1.45 }}>{h.checkin.zones && h.checkin.zones.length ? `⚠ Desconforto: ${h.checkin.zones.map((z) => INJ_LABEL[z] || z).join(", ")}` : ""}{h.checkin.note ? `${h.checkin.zones && h.checkin.zones.length ? " · " : ""}"${h.checkin.note}"` : ""}</div>}</div>)}</div>
    </div>
  );
}


/* ==================== BUILDER ==================== */
function Builder({ profile, prefs, onStart, onBack }) {
  const [chosen, setChosen] = useState([]);
  const blocked = (ex) => ex.avoid.some((a) => profile.injuries.includes(a));
  const add = (ex) => { if (blocked(ex) || chosen.find((c) => c.name === ex.name)) return; setChosen([...chosen, { name: ex.name, bw: !!ex.bw, nSets: 3, reps: ex.bw ? 10 : 8, w: ex.bw ? null : 40 }]); };
  const upd = (i, f, d) => setChosen((prev) => { const n = [...prev]; const c = { ...n[i] }; if (f === "nSets") c.nSets = Math.min(8, Math.max(1, c.nSets + d)); if (f === "reps") c.reps = Math.min(30, Math.max(1, c.reps + d)); if (f === "w") c.w = Math.max(0, round25(c.w + d * 2.5)); n[i] = c; return n; });
  const move = (i, j) => setChosen((prev) => { if (j < 0 || j >= prev.length) return prev; const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const remove = (i) => setChosen(chosen.filter((_, k) => k !== i));
  const start = () => onStart({ dayName: "Hoje", title: "Treino manual", type: "strength_lower", weeksOut: null, phase: null, adjustments: [], warmup: prefs.warmup ? [{ name: "Aquecimento geral", dose: "5 min + mobilidade" }] : null, cooldown: prefs.cooldown ? [{ name: "Alongamento full-body", dose: "3 min" }] : null, rehab: profile.injuries.length && profile.physio === "nao" ? profile.injuries.flatMap((i) => REHAB[i] || []) : [], why: ["Treino 100% teu. Cada série alimenta o Athlete Model."], goalShort: "Manual", exercises: chosen.map((c) => ({ name: c.name, swap: null, bw: c.bw, rest: c.bw ? "90 s" : "2 min", sets: Array.from({ length: c.nSets }, () => ({ w: c.w, reps: c.reps, rpe: "—", done: false, loggedRpe: null })) })) });
  const Ctrl = ({ label, value, onDec, onInc }) => <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ ...mono, fontSize: 9.5, color: T.faint, width: 34 }}>{label}</span><button onClick={onDec} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.raised, color: T.text, cursor: "pointer", fontFamily: "Archivo", fontWeight: 700 }}>−</button><span style={{ ...mono, fontSize: 13, color: T.text, minWidth: 32, textAlign: "center", fontWeight: 600 }}>{value}</span><button onClick={onInc} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.line}`, background: T.raised, color: T.text, cursor: "pointer", fontFamily: "Archivo", fontWeight: 700 }}>+</button></div>;
  const groups = [...new Set(LIBRARY.map((e) => e.muscle))];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><Eyebrow color={T.accent}>Treino manual</Eyebrow><div style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 20, marginTop: 4 }}>Constrói à tua maneira</div></div><button onClick={onBack} style={{ background: "none", border: "none", color: T.faint, fontFamily: "Archivo", fontSize: 13, cursor: "pointer" }}>Voltar</button></div>
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {chosen.length === 0 ? <p style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.6, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>Toca nos exercícios para adicionar. Usa as setas para mudar a ordem. Os contraindicados pelas tuas lesões aparecem bloqueados.</p>
        : chosen.map((c, i) => <div key={c.name} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><span style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 15 }}>{i + 1}. {c.name}</span><div style={{ display: "flex", gap: 6, alignItems: "center" }}><button onClick={() => move(i, i - 1)} disabled={i === 0} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${T.line}`, background: T.raised, color: i === 0 ? T.faint : T.text, cursor: i === 0 ? "default" : "pointer", fontSize: 11, opacity: i === 0 ? 0.4 : 1 }}>▲</button><button onClick={() => move(i, i + 1)} disabled={i === chosen.length - 1} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${T.line}`, background: T.raised, color: i === chosen.length - 1 ? T.faint : T.text, cursor: i === chosen.length - 1 ? "default" : "pointer", fontSize: 11, opacity: i === chosen.length - 1 ? 0.4 : 1 }}>▼</button><button onClick={() => remove(i)} style={{ background: "none", border: "none", color: T.low, fontSize: 13, cursor: "pointer", fontFamily: "Archivo", fontWeight: 600, marginLeft: 4 }}>Remover</button></div></div><div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}><Ctrl label="SÉRIES" value={c.nSets} onDec={() => upd(i, "nSets", -1)} onInc={() => upd(i, "nSets", 1)} /><Ctrl label="REPS" value={c.reps} onDec={() => upd(i, "reps", -1)} onInc={() => upd(i, "reps", 1)} />{!c.bw && <Ctrl label="KG" value={c.w} onDec={() => upd(i, "w", -1)} onInc={() => upd(i, "w", 1)} />}</div></div>)}
        <div style={{ marginTop: 18 }}><Eyebrow>Biblioteca</Eyebrow>{groups.map((g) => <div key={g} style={{ marginTop: 12 }}><div style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 13, color: T.muted, marginBottom: 8 }}>{g}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{LIBRARY.filter((e) => e.muscle === g).map((e) => { const b = blocked(e); const a = chosen.find((c) => c.name === e.name); return <Chip key={e.name} small disabled={b} label={b ? `⚠ ${e.name}` : a ? `✓ ${e.name}` : `+ ${e.name}`} active={!!a} onClick={() => add(e)} />; })}</div></div>)}{profile.injuries.length > 0 && <p style={{ fontSize: 11.5, color: T.faint, marginTop: 12, lineHeight: 1.5 }}>⚠ = bloqueado pela lesão. Mesmo no manual, a segurança não é opcional.</p>}</div>
      </div>
      <div style={{ borderTop: `1px solid ${T.line}`, padding: "14px 20px 18px", background: T.surface }}><button onClick={start} disabled={chosen.length === 0} style={{ width: "100%", padding: 15, borderRadius: 12, border: "none", background: chosen.length ? T.accent : T.raised, color: chosen.length ? "#fff" : T.faint, fontFamily: "Archivo", fontWeight: 700, fontSize: 15, cursor: chosen.length ? "pointer" : "default" }}>Começar treino ({chosen.length})</button></div>
    </div>
  );
}

/* ==================== WORKOUT ==================== */
function RPEPicker({ onPick }) { return <div><Eyebrow>Quão difícil foi? (RPE)</Eyebrow><div style={{ display: "flex", gap: 6, marginTop: 8 }}>{[6, 7, 8, 9, 10].map((r) => <button key={r} onClick={() => onPick(r)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: `1px solid ${T.line}`, background: T.raised, color: r >= 9 ? T.low : r === 8 ? T.mid : T.good, ...mono, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>{r}</button>)}</div></div>; }

function Workout({ session: initial, partner, onExit, onFinish }) {
  const [session, setSession] = useState(initial);
  const [exIdx, setExIdx] = useState(0);
  const [picking, setPicking] = useState(null);
  const [rehabDone, setRehabDone] = useState({});
  const [showCheckin, setShowCheckin] = useState(false);
  const [ci, setCi] = useState({ zones: [], feel: null, note: "" });
  const [coach, setCoach] = useState(partner ? `Sessão com ${partner} — alternem séries.` : initial.warmup ? "Faz o aquecimento primeiro." : "Regista cada série e eu ajusto as seguintes.");
  const [rest, setRest] = useState(0);
  const timer = useRef(null);
  useEffect(() => { if (rest > 0) { timer.current = setTimeout(() => setRest(rest - 1), 1000); return () => clearTimeout(timer.current); } }, [rest]);
  const logExercises = session.exercises.filter((e) => e.sets);
  const ex = logExercises[exIdx] || logExercises[0];
  const doneAll = logExercises.every((e) => e.sets.every((s) => s.done));
  const bump = (si, d) => { setSession((prev) => { const n = structuredClone(prev); const e = n.exercises.filter((x) => x.sets)[exIdx]; const s = e.sets[si]; if (e.bw || s.w == null) s.reps = Math.max(0, s.reps + (d > 0 ? 1 : -1)); else s.w = Math.max(0, round25(s.w + d)); return n; }); setCoach("Ajuste registado — recalibro as estimativas."); };
  const log = (si, rpe) => { setSession((prev) => { const n = structuredClone(prev); const e = n.exercises.filter((x) => x.sets)[exIdx]; e.sets[si] = { ...e.sets[si], done: true, loggedRpe: rpe }; const adj = autoregulate(e.sets[si], rpe, e.bw); for (let j = si + 1; j < e.sets.length; j++) { if (e.bw || e.sets[j].w == null) e.sets[j].reps = adj.reps; else e.sets[j].w = adj.w; } setCoach(adj.msg); return n; }); setPicking(null); setRest(90); };
  const toggleZone = (z) => setCi((q) => { if (z === "nenhum") return { ...q, zones: [] }; const has = q.zones.includes(z); return { ...q, zones: has ? q.zones.filter((x) => x !== z) : [...q.zones, z] }; });
  const finish = () => { const allSets = logExercises.flatMap((e) => e.sets); const ds = allSets.filter((s) => s.done); const rpes = ds.map((s) => s.loggedRpe).filter((r) => typeof r === "number"); const avgRpe = rpes.length ? rpes.reduce((a, r) => a + r, 0) / rpes.length : null; const completion = allSets.length ? ds.length / allSets.length : 1; onFinish({ title: session.title, date: new Date().toLocaleDateString("pt-PT") + " · " + new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }), nSets: ds.length, volume: ds.reduce((a, s) => a + (s.w ? s.w * s.reps : 0), 0), partner: partner || null, avgRpe, completion, checkin: ci }); };
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${T.line}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Eyebrow color={T.accent}>Treino ao vivo{partner ? ` · 👥 ${partner}` : ""}</Eyebrow><button onClick={onExit} style={{ background: "none", border: "none", color: T.faint, fontFamily: "Archivo", fontSize: 13, cursor: "pointer" }}>Sair</button></div><div style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 20, marginTop: 4 }}>{session.title}</div><div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto" }}>{logExercises.map((e, i) => <Chip key={i} small label={`${i + 1}. ${e.name.split(" ")[0]}`} active={i === exIdx} onClick={() => { setExIdx(i); setPicking(null); }} />)}</div></div>
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {session.warmup && <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 14 }}><Eyebrow color={T.mid}>Aquecimento</Eyebrow>{session.warmup.map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}><span>{r.name}</span><span style={{ ...mono, fontSize: 11, color: T.muted }}>{r.dose}</span></div>)}</div>}
        {session.rehab.length > 0 && <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}><Eyebrow color={T.good}>Recuperação</Eyebrow>{session.rehab.map((r, i) => <button key={i} onClick={() => setRehabDone({ ...rehabDone, [i]: !rehabDone[i] })} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: "10px 0", cursor: "pointer", borderTop: i ? `1px solid ${T.line}` : "none" }}><span style={{ fontFamily: "Archivo", fontSize: 14, color: rehabDone[i] ? T.good : T.text, textDecoration: rehabDone[i] ? "line-through" : "none" }}>{rehabDone[i] ? "✓ " : "○ "}{r.name}</span><span style={{ ...mono, fontSize: 11, color: T.muted }}>{r.dose}</span></button>)}</div>}
        <div style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 18 }}>{ex.name}{ex.focusTag && <span style={{ ...mono, fontSize: 9, color: T.accent, border: `1px solid ${T.accent}`, borderRadius: 5, padding: "2px 5px", marginLeft: 8 }}>FOCO</span>}</div>
        <div style={{ ...mono, fontSize: 12, color: T.muted, margin: "4px 0 16px" }}>{ex.detail || (ex.sets[0].w ? "carga sugerida — afinável" : "peso corporal")} · descanso {ex.rest} · RPE alvo {ex.sets[0].rpe}</div>
        {ex.sets.map((s, i) => { const prev = i === 0 || ex.sets[i - 1].done; return (<div key={i} style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 12, border: `1px solid ${s.done ? "rgba(63,217,164,0.4)" : picking === i ? T.accent : T.line}`, background: s.done ? "rgba(63,217,164,0.07)" : T.surface, opacity: !prev && !s.done ? 0.45 : 1 }}><button disabled={s.done || !prev} onClick={() => setPicking(i)} style={{ background: "none", border: "none", cursor: s.done || !prev ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: 0, flex: 1 }}><span style={{ fontFamily: "Archivo", fontWeight: 600, fontSize: 13, color: T.muted }}>Série {i + 1}</span><span style={{ ...mono, fontSize: 15, color: s.done ? T.good : T.text, fontWeight: 600 }}>{s.w != null ? `${s.w} kg × ${s.reps}` : s.reps > 0 ? `${s.reps} reps` : "completar"}{s.done ? ` · RPE ${s.loggedRpe} ✓` : ""}</span></button>{!s.done && prev && <Stepper onDec={() => bump(i, -2.5)} onInc={() => bump(i, 2.5)} />}</div>{picking === i && !s.done && <div style={{ marginTop: 8 }}><RPEPicker onPick={(r) => log(i, r)} /></div>}</div>); })}
        {doneAll && !showCheckin && (<div>{session.cooldown && <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, margin: "8px 0 12px" }}><Eyebrow color={T.mid}>Alongamentos · retorno à calma</Eyebrow>{session.cooldown.map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}><span>{r.name}</span><span style={{ ...mono, fontSize: 11, color: T.muted }}>{r.dose}</span></div>)}</div>}<div style={{ background: "rgba(63,217,164,0.08)", border: "1px solid rgba(63,217,164,0.35)", borderRadius: 14, padding: 18 }}><div style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 18, color: T.good }}>Sessão concluída.</div><p style={{ fontSize: 13, color: T.muted, lineHeight: 1.55, margin: "8px 0 12px" }}>Antes de guardar, três perguntas rápidas para preparar o teu próximo treino.</p><button onClick={() => setShowCheckin(true)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: T.good, color: "#0F1319", fontFamily: "Archivo", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Continuar</button></div></div>)}
        {showCheckin && (
          <div style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 16, padding: 18, animation: "fadeUp .3s" }}>
            <Eyebrow color={T.accent}>Check-in pós-treino</Eyebrow>
            <div style={{ fontFamily: "Archivo", fontWeight: 700, fontSize: 16, margin: "8px 0 14px" }}>Como correu?</div>

            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Sentiste desconforto ou dor durante o treino?</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              <Chip small label="Nenhum" active={ci.zones.length === 0} onClick={() => toggleZone("nenhum")} />
              {INJURIES.map((z) => <Chip key={z} small label={INJ_LABEL[z]} active={ci.zones.includes(z)} onClick={() => toggleZone(z)} />)}
            </div>
            {ci.zones.length > 0 && <p style={{ fontSize: 11.5, color: T.mid, margin: "-10px 0 16px", lineHeight: 1.5 }}>Vou aplicar cautela nas cargas ligadas a estas zonas no teu próximo treino.</p>}

            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Como foi o esforço geral desta sessão?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {[["facil", "Abaixo do esperado — podia ter feito mais"], ["equilibrado", "Equilibrado — no ponto certo"], ["limite", "No limite — dei o meu máximo"], ["excesso", "Passei-me — arrependo-me um pouco"]].map(([id, label]) => (
                <Chip key={id} label={label} active={ci.feel === id} onClick={() => setCi({ ...ci, feel: id })} />
              ))}
            </div>

            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Algo mais que devamos saber? (opcional)</div>
            <textarea value={ci.note} onChange={(e) => setCi({ ...ci, note: e.target.value })} rows={2} placeholder="Ex.: «dormi mal», «treinei com fome», «senti-me muito motivado»" style={{ width: "100%", background: T.raised, border: `1px solid ${T.line}`, borderRadius: 12, color: T.text, fontFamily: "Archivo", fontSize: 14, padding: 12, resize: "vertical", marginBottom: 16 }} />

            <button onClick={finish} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: T.good, color: "#0F1319", fontFamily: "Archivo", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Terminar e guardar</button>
          </div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${T.line}`, padding: "12px 20px 18px", background: T.surface }}>{rest > 0 && <div style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: 11, color: T.muted, marginBottom: 4 }}><span>{partner ? `SÉRIE DE ${partner.toUpperCase().slice(0, 10)}` : "DESCANSO"}</span><span>{rest}s</span></div><div style={{ height: 4, borderRadius: 2, background: T.line }}><div style={{ height: 4, borderRadius: 2, background: T.accent, width: `${(rest / 90) * 100}%`, transition: "width 1s linear" }} /></div></div>}<div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><div style={{ width: 30, height: 30, borderRadius: 9, background: T.accentSoft, border: `1px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 12, color: T.accent, flexShrink: 0 }}>AI</div><p style={{ fontSize: 13, color: T.text, lineHeight: 1.5, margin: 0 }}>{coach}</p></div></div>
    </div>
  );
}

/* ==================== APP ==================== */
function TabBar({ tab, setTab }) { return <div style={{ display: "flex", borderTop: `1px solid ${T.line}`, background: T.surface, flexShrink: 0 }}>{[{ id: "hoje", label: "Hoje" }, { id: "progresso", label: "Progresso" }].map((t) => <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "13px 0 15px", background: "none", border: "none", cursor: "pointer", color: tab === t.id ? T.accent : T.faint, fontFamily: "Archivo", fontWeight: 700, fontSize: 13, borderTop: `2px solid ${tab === t.id ? T.accent : "transparent"}`, marginTop: -1 }}>{t.label}</button>)}</div>; }

/* ==================== PERSISTÊNCIA ====================
   Usa a API window.storage dos artifacts (persiste entre sessões).
   Desenho: 1 documento de estado (apex-state) + fotos à parte
   (apex-photos, redimensionadas). Gravação automática com debounce.
   Se window.storage não existir, a app funciona em memória. */

const STORAGE_KEY = "apex-state";
const PHOTOS_KEY = "apex-photos";
const hasStorage = () => typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";

async function loadPersisted() {
  if (!hasStorage()) return { state: null, photos: [] };
  let state = null, photos = [];
  try { const r = await window.storage.get(STORAGE_KEY); if (r && r.value) state = JSON.parse(r.value); } catch (e) { /* sem estado guardado */ }
  try { const r = await window.storage.get(PHOTOS_KEY); if (r && r.value) photos = JSON.parse(r.value); } catch (e) { /* sem fotos */ }
  return { state, photos };
}

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [screen, setScreen] = useState("onboarding");
  const [tab, setTab] = useState("hoje");
  const [profile, setProfile] = useState(null);
  const [scenario, setScenario] = useState("boa");
  const [openDay, setOpenDay] = useState(null);
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [maxes, setMaxes] = useState({});
  const [maxHistory, setMaxHistory] = useState({});
  const [body, setBody] = useState({ photos: [], metrics: {} });
  const [metricHistory, setMetricHistory] = useState({});
  const [partner, setPartner] = useState(null);
  const [prefs, setPrefs] = useState({ warmup: true, cooldown: true });
  const [prog, setProg] = useState(initProgression());
  const [weekLog, setWeekLog] = useState([]);
  const saveTimer = useRef(null);
  const statusTimer = useRef(null);
  const R = scenario === "boa" ? { muscular: 82, cardio: 78, snc: 85 } : { muscular: 48, cardio: 61, snc: 44 };
  const todayIdx = 3;
  // Zonas de desconforto reportadas no último treino → cautela na próxima sessão
  const checkinFlags = (history[0] && history[0].checkin && history[0].checkin.zones) || [];

  // HIDRATAÇÃO: carregar estado guardado no arranque
  useEffect(() => {
    (async () => {
      const { state, photos } = await loadPersisted();
      if (state) {
        if (state.profile) { setProfile(state.profile); setScreen("home"); }
        if (state.prefs) setPrefs(state.prefs);
        if (state.maxes) setMaxes(state.maxes);
        if (state.maxHistory) setMaxHistory(state.maxHistory);
        if (state.metrics || photos.length) setBody({ metrics: state.metrics || {}, photos });
        if (state.metricHistory) setMetricHistory(state.metricHistory);
        if (state.history) setHistory(state.history);
        if (state.prog) setProg(state.prog);
        if (state.weekLog) setWeekLog(state.weekLog);
        if (state.partner) setPartner(state.partner);
      }
      setHydrated(true);
    })();
  }, []);

  // GRAVAÇÃO AUTOMÁTICA: debounce de 800ms sobre o estado relevante
  useEffect(() => {
    if (!hydrated || !hasStorage()) return;
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify({
          profile, prefs, maxes, maxHistory, metrics: body.metrics, metricHistory,
          history: history.slice(0, 100), prog, weekLog, partner, v: 1,
        }));
        setSaveStatus("saved");
        clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
      } catch (e) { setSaveStatus("error"); }
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [hydrated, profile, prefs, maxes, maxHistory, body.metrics, metricHistory, history, prog, weekLog, partner]);

  // FOTOS: gravadas à parte (podem ser pesadas); máx. 9, já redimensionadas no upload
  useEffect(() => {
    if (!hydrated || !hasStorage()) return;
    (async () => {
      try { await window.storage.set(PHOTOS_KEY, JSON.stringify(body.photos.slice(0, 9))); }
      catch (e) { /* excedeu o limite — mantém em memória */ }
    })();
  }, [hydrated, body.photos]);

  const doOpenDay = (dayIndex) => { const s = buildDaySession(profile, R, maxes, prefs, dayIndex, prog, checkinFlags); setOpenDay(s); setScreen("day"); };
  const reorder = (from, to) => { if (to < 0 || to >= openDay.exercises.length) return; setOpenDay((prev) => { const ex = [...prev.exercises]; [ex[from], ex[to]] = [ex[to], ex[from]]; return { ...prev, exercises: ex }; }); };
  const logMax = (k, v) => {
    setMaxes((m) => { const n = { ...m }; if (v == null) delete n[k]; else n[k] = v; return n; });
    if (v != null) setMaxHistory((h) => ({ ...h, [k]: [...(h[k] || []), { t: Date.now(), y: v }] }));
  };
  const logMetric = (k, v) => {
    setBody((b) => ({ ...b, metrics: { ...b.metrics, [k]: v } }));
    if (v != null) setMetricHistory((h) => ({ ...h, [k]: [...(h[k] || []), { t: Date.now(), y: v }] }));
  };
  const finishWorkout = (rec) => { setHistory((h) => [rec, ...h]); if (rec.avgRpe != null) setWeekLog((w) => [...w, { avgRpe: rec.avgRpe, completion: rec.completion }]); setScreen("home"); setTab("hoje"); };
  const advanceToNextWeek = () => {
    const logs = weekLog.length ? weekLog : [{ avgRpe: 7.5, completion: 1 }];
    const avgRpe = logs.reduce((a, l) => a + l.avgRpe, 0) / logs.length;
    const completion = logs.reduce((a, l) => a + l.completion, 0) / logs.length;
    setProg((pr) => advanceWeek(pr, profile, avgRpe, completion));
    setWeekLog([]);
  };
  const reset = async () => {
    setScreen("onboarding"); setProfile(null); setHistory([]); setMaxes({}); setMaxHistory({});
    setBody({ photos: [], metrics: {} }); setMetricHistory({}); setPartner(null); setTab("hoje");
    setOpenDay(null); setProg(initProgression()); setWeekLog([]);
    if (hasStorage()) {
      try { await window.storage.delete(STORAGE_KEY); } catch (e) {}
      try { await window.storage.delete(PHOTOS_KEY); } catch (e) {}
    }
  };

  // Ecrã de arranque enquanto hidrata
  if (!hydrated) {
    return (
      <div style={{ minHeight: "100vh", background: "#080B0F", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Archivo', sans-serif" }}>
        <style>{FONT}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 22, letterSpacing: "0.22em", color: T.text }}>APEX<span style={{ color: T.accent }}>.</span></div>
          <div style={{ ...mono, fontSize: 10, color: T.faint, letterSpacing: "0.15em", marginTop: 10, animation: "pulse 1.2s infinite" }}>A CARREGAR OS TEUS DADOS</div>
        </div>
      </div>
    );
  }

  const savedLabel = saveStatus === "saving" ? "A GUARDAR…" : saveStatus === "saved" ? "✓ GUARDADO" : saveStatus === "error" ? "⚠ ERRO A GUARDAR" : hasStorage() ? "" : "MODO MEMÓRIA";

  return (
    <div style={{ minHeight: "100vh", background: "#080B0F", display: "flex", justifyContent: "center", fontFamily: "'Archivo', sans-serif", color: T.text }}>
      <style>{FONT}</style>
      <div style={{ width: "100%", maxWidth: 430, height: "100vh", maxHeight: 900, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden", borderLeft: `1px solid ${T.line}`, borderRight: `1px solid ${T.line}` }}>
        <div style={{ padding: "14px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "Archivo", fontWeight: 800, fontSize: 15, letterSpacing: "0.22em" }}>APEX<span style={{ color: T.accent }}>.</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {savedLabel && <span style={{ ...mono, fontSize: 8.5, letterSpacing: "0.1em", color: saveStatus === "error" ? T.low : saveStatus === "saved" ? T.good : T.faint, transition: "color .3s" }}>{savedLabel}</span>}
            {screen !== "onboarding" && screen !== "building" && <button onClick={reset} style={{ background: "none", border: "none", color: T.faint, ...mono, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>REINICIAR</button>}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {screen === "onboarding" && <Onboarding onDone={(p) => { setProfile(p); setScreen("building"); }} />}
          {screen === "building" && <Building profile={profile} onDone={() => setScreen(profile.goal === "forca" ? "splitchoice" : "home")} />}
          {screen === "splitchoice" && <SplitChoice profile={profile} onChoose={(style) => { setProfile((q) => ({ ...q, splitStyle: style })); setScreen("home"); }} />}
          {screen === "home" && tab === "hoje" && <Home profile={profile} setProfile={setProfile} maxes={maxes} prefs={prefs} setPrefs={setPrefs} partner={partner} setPartner={setPartner} R={R} scenario={scenario} setScenario={setScenario} onOpenDay={doOpenDay} onBuild={() => setScreen("builder")} prog={prog} weekLog={weekLog} onAdvanceWeek={advanceToNextWeek} checkinFlags={checkinFlags} />}
          {screen === "home" && tab === "progresso" && <Progress profile={profile} maxes={maxes} logMax={logMax} maxHistory={maxHistory} body={body} setBody={setBody} logMetric={logMetric} metricHistory={metricHistory} history={history} prog={prog} />}
          {screen === "day" && openDay && <DayDetail session={openDay} prefs={prefs} isToday={openDay.dayIndex === todayIdx} onReorder={reorder} onStart={() => { setSession(openDay); setScreen("workout"); }} onBack={() => setScreen("home")} />}
          {screen === "builder" && <Builder profile={profile} prefs={prefs} onStart={(s) => { setSession(s); setScreen("workout"); }} onBack={() => setScreen("home")} />}
          {screen === "workout" && <Workout session={session} partner={partner} onExit={() => setScreen("home")} onFinish={finishWorkout} />}
        </div>
        {screen === "home" && <TabBar tab={tab} setTab={setTab} />}
      </div>
    </div>
  );
}
