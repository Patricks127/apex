import test from "node:test";
import assert from "node:assert/strict";
import {
  selecionarSemana,
  semanaParaEntradaVolume,
  volumeDireto,
  EQUIP_DISPONIVEL,
  INTERVALO_VOLUME,
  exercicioPorId,
  type PerfilSelecao,
  type Nivel,
  type SemanaSelecionada,
} from "./index.ts";

const NIVEIS: Nivel[] = ["iniciante", "intermedio", "avancado"];
const DIAS = [3, 4, 5, 6];

const base = (o: Partial<PerfilSelecao> = {}): PerfilSelecao => ({
  objetivo: "hipertrofia",
  nivel: "intermedio",
  dias: 4,
  equipamento: EQUIP_DISPONIVEL.ginasio,
  lesoes: [],
  ...o,
});

const todosEx = (s: SemanaSelecionada) =>
  s.dias.flatMap((d) => d.exercicios.map((e) => e.exercicio));

// ===========================================================================
// 1. Nunca dois exercícios da mesma família no mesmo dia
// ===========================================================================
test("nunca dois exercícios da mesma família no mesmo dia (todas as combinações)", () => {
  for (const nivel of NIVEIS) {
    for (const dias of DIAS) {
      for (const foco of [[], ["peito"], ["gluteo"]] as const) {
        const s = selecionarSemana(base({ nivel, dias, foco: [...foco] as PerfilSelecao["foco"] }));
        for (const d of s.dias) {
          const familias = d.exercicios.map((e) => e.exercicio.familia);
          const dup = familias.find((f, i) => familias.indexOf(f) !== i);
          assert.equal(
            dup,
            undefined,
            `${nivel}/${dias}d/${foco.join(",")} — ${d.nome}: família repetida '${dup}'`,
          );
        }
      }
    }
  }
});

// ===========================================================================
// 2. Nunca 3 compostos pesados (fadigaSistemica 3) consecutivos
// ===========================================================================
test("nunca 3 compostos de fadiga sistémica 3 consecutivos", () => {
  for (const nivel of NIVEIS) {
    for (const dias of DIAS) {
      const s = selecionarSemana(base({ nivel, dias }));
      for (const d of s.dias) {
        const seq = d.exercicios.map((e) => e.exercicio.fadigaSistemica);
        for (let i = 0; i + 2 < seq.length; i++) {
          assert.ok(
            !(seq[i] === 3 && seq[i + 1] === 3 && seq[i + 2] === 3),
            `${nivel}/${dias}d — ${d.nome}: 3 fadiga-3 seguidos na pos ${i}`,
          );
        }
        // e no máximo 2 por dia
        assert.ok(
          seq.filter((x) => x === 3).length <= 2,
          `${nivel}/${dias}d — ${d.nome}: mais de 2 compostos pesados no dia`,
        );
      }
    }
  }
});

// ===========================================================================
// 3. Lesão no ombro → nenhum exercício contraindicado, em 50 planos
// ===========================================================================
test("lesão no ombro: nenhum exercício contraindicado em 50 planos", () => {
  let n = 0;
  for (let k = 0; k < 50; k++) {
    const nivel = NIVEIS[k % 3];
    const dias = DIAS[k % 4];
    const foco = ([[], ["peito"], ["deltoide_lateral"], ["dorsais"]] as const)[k % 4];
    const s = selecionarSemana(
      base({ nivel, dias, foco: [...foco] as PerfilSelecao["foco"], lesoes: ["ombro"] }),
    );
    for (const e of todosEx(s)) {
      n++;
      assert.ok(
        !e.contraindicacoes.includes("ombro"),
        `plano ${k} (${nivel}/${dias}d): ${e.id} é contraindicado para ombro`,
      );
    }
  }
  assert.ok(n > 400, `poucos exercícios verificados (${n})`);
});

test("lesão no joelho e na lombar: idem", () => {
  for (const lesao of [["joelho"], ["lombar"], ["joelho", "lombar"]] as const) {
    for (const dias of DIAS) {
      const s = selecionarSemana(base({ dias, lesoes: [...lesao] as PerfilSelecao["lesoes"] }));
      for (const e of todosEx(s)) {
        for (const z of lesao) {
          assert.ok(!e.contraindicacoes.includes(z), `${e.id} contraindicado para ${z}`);
        }
      }
    }
  }
});

// ===========================================================================
// 4. Foco no peito
// ===========================================================================
test("foco no peito: 1ª posição, volume no topo, ≥2 perfis, tríceps reduzido", () => {
  const semFoco = selecionarSemana(base({ nivel: "intermedio", dias: 5 }));
  const comFoco = selecionarSemana(base({ nivel: "intermedio", dias: 5, foco: ["peito"] }));

  // (a) peito em 1ª posição nos dias em que é alvo e aparece
  let diasComPeito = 0;
  for (const d of comFoco.dias) {
    if (!d.musculosAlvo.includes("peito")) continue;
    const temPeito = d.exercicios.some((e) => e.exercicio.primarios.some((p) => p.musculo === "peito"));
    if (!temPeito) continue;
    diasComPeito++;
    assert.ok(
      d.exercicios[0].exercicio.primarios.some((p) => p.musculo === "peito"),
      `${d.nome}: 1º exercício não é de peito (${d.exercicios[0].exercicio.id})`,
    );
  }
  assert.ok(diasComPeito >= 2, `peito só aparece em ${diasComPeito} dias (frequência < 2)`);

  // (b) volume de peito no topo do intervalo do nível
  const r = INTERVALO_VOLUME.intermedio;
  const peitoFoco = comFoco.volume.porMusculo.find((v) => v.musculo === "peito")!;
  assert.ok(
    peitoFoco.direto >= r.max - 2 && peitoFoco.direto <= r.teto,
    `volume de peito = ${peitoFoco.direto}; esperado perto do topo (${r.max}–${r.teto})`,
  );
  const peitoSem = semFoco.volume.porMusculo.find((v) => v.musculo === "peito")!;
  assert.ok(peitoFoco.direto > peitoSem.direto, "foco não aumentou o volume de peito");

  // (c) ≥2 perfis de resistência no peito
  const perfisPeito = new Set(
    todosEx(comFoco)
      .filter((e) => e.primarios.some((p) => p.musculo === "peito"))
      .map((e) => e.perfilResistencia),
  );
  assert.ok(perfisPeito.size >= 2, `peito só com ${perfisPeito.size} perfil(is): ${[...perfisPeito]}`);

  // (d) volume DIRETO de tríceps reduzido face ao plano sem foco (§3.4.5)
  const triFoco = volumeDireto(semanaParaEntradaVolume(comFoco), "triceps");
  const triSem = volumeDireto(semanaParaEntradaVolume(semFoco), "triceps");
  console.log(`  tríceps: sem foco ${triSem} → com foco no peito ${triFoco}`);
  assert.ok(triFoco < triSem, `tríceps não foi reduzido (${triSem} → ${triFoco})`);
});

test("foco nas costas não aumenta o volume direto de bíceps", () => {
  // Ao contrário do peito (que tem aberturas 'limpas'), quase todo o trabalho
  // de dorsais carrega bíceps como secundário — não se exige redução estrita,
  // exige-se que o foco não o empurre para cima (isolamento de bíceps cortado).
  const sem = selecionarSemana(base({ dias: 5 }));
  const com = selecionarSemana(base({ dias: 5, foco: ["dorsais"] }));
  const bSem = volumeDireto(semanaParaEntradaVolume(sem), "biceps");
  const bCom = volumeDireto(semanaParaEntradaVolume(com), "biceps");
  assert.ok(bCom <= bSem, `foco nas costas aumentou o bíceps (${bSem} → ${bCom})`);
});

// ===========================================================================
// 5. Equipamento "casa" → nenhum exercício de máquina
// ===========================================================================
test("equipamento 'casa': todos os exercícios são executáveis em casa, nenhum de máquina", () => {
  const casa = new Set(EQUIP_DISPONIVEL.casa);
  for (const dias of DIAS) {
    for (const nivel of NIVEIS) {
      const s = selecionarSemana(base({ dias, nivel, equipamento: EQUIP_DISPONIVEL.casa }));
      for (const e of todosEx(s)) {
        assert.ok(
          e.equipamento.some((q) => casa.has(q)),
          `${nivel}/${dias}d: ${e.id} precisa de ${e.equipamento} — não disponível em casa`,
        );
        assert.ok(
          e.equipamento.some((q) => casa.has(q) && q !== "maquina" && q !== "cabos"),
          `${nivel}/${dias}d: ${e.id} depende de máquina/cabos`,
        );
      }
    }
  }
});

// ===========================================================================
// 6. Ordem: nenhum isolamento antes de um composto
// ===========================================================================
test("ordem: nenhum isolamento (Tier 3) antes de um composto (Tier 1/2)", () => {
  for (const nivel of NIVEIS) {
    for (const dias of DIAS) {
      for (const foco of [[], ["peito"], ["quadriceps"]] as const) {
        const s = selecionarSemana(base({ nivel, dias, foco: [...foco] as PerfilSelecao["foco"] }));
        for (const d of s.dias) {
          const tiers = d.exercicios.map((e) => e.exercicio.tier);
          for (let i = 0; i < tiers.length; i++) {
            for (let j = i + 1; j < tiers.length; j++) {
              assert.ok(
                !(tiers[i] === 3 && tiers[j] !== 3),
                `${nivel}/${dias}d/${foco.join(",")} — ${d.nome}: isolamento na pos ${i} antes de composto na pos ${j}`,
              );
            }
          }
          // a ordem (`ordem`) está 1..n e sem buracos
          assert.deepEqual(
            d.exercicios.map((e) => e.ordem),
            d.exercicios.map((_, i) => i + 1),
          );
        }
      }
    }
  }
});

// ===========================================================================
// suporte
// ===========================================================================
test("estrutura: dias certos, exercícios em todos, frequência ≥2× para grandes", () => {
  for (const dias of DIAS) {
    const s = selecionarSemana(base({ dias }));
    assert.equal(s.dias.length, dias);
    for (const d of s.dias) assert.ok(d.exercicios.length >= 3, `${d.nome} com poucos exercícios`);

    // cada músculo grande treinado ≥2 dias
    for (const m of ["peito", "dorsais", "quadriceps", "isquiotibiais", "gluteo"]) {
      const nDias = s.dias.filter((d) =>
        d.exercicios.some((e) =>
          [...e.exercicio.primarios, ...e.exercicio.secundarios].some((x) => x.musculo === m),
        ),
      ).length;
      assert.ok(nDias >= 2, `${dias}d: ${m} só em ${nDias} dia(s)`);
    }
  }
});

test("objetivo não-hipertrofia usa o construtor modal (passo 6)", () => {
  const s = selecionarSemana(base({ objetivo: "powerlifting" }));
  // regras da spec §6 vão para os avisos
  assert.ok(s.avisos.some((a) => /RIR 3–5/.test(a)));
  assert.ok(s.dias.length === 4 && todosEx(s).length > 0);
  // dia de levantamento principal existe
  assert.ok(s.dias.some((d) => d.tipo === "forca_principal"));
});

test("todos os ids gerados existem na base", () => {
  const s = selecionarSemana(base({ dias: 6, nivel: "avancado" }));
  for (const e of todosEx(s)) assert.ok(exercicioPorId(e.id), `id inexistente: ${e.id}`);
});
