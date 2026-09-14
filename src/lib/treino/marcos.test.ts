import assert from "node:assert/strict";
import { test } from "node:test";
import { marcarNovosRecordes } from "./marcos.ts";

type Ponto = { lift: string; valueKg: number; recordedAt: string };

const chave = (p: Ponto) => p.lift;
const valor = (p: Ponto) => p.valueKg;
const quando = (p: Ponto) => p.recordedAt;

test("primeiro ponto de uma chave é sempre um novo recorde", () => {
  const out = marcarNovosRecordes<Ponto>(
    [{ lift: "supino", valueKg: 80, recordedAt: "2026-01-01" }],
    chave,
    valor,
    quando,
  );
  assert.equal(out[0].novoRecorde, true);
});

test("ponto que supera o máximo anterior é marco; que não supera, não é", () => {
  const out = marcarNovosRecordes<Ponto>(
    [
      { lift: "supino", valueKg: 80, recordedAt: "2026-01-01" },
      { lift: "supino", valueKg: 82.5, recordedAt: "2026-01-08" },
      { lift: "supino", valueKg: 80, recordedAt: "2026-01-15" },
      { lift: "supino", valueKg: 85, recordedAt: "2026-01-22" },
    ],
    chave,
    valor,
    quando,
  );
  assert.deepEqual(
    out.map((o) => o.novoRecorde),
    [true, true, false, true],
  );
});

test("chaves diferentes (levantamentos diferentes) têm recordes independentes", () => {
  const out = marcarNovosRecordes<Ponto>(
    [
      { lift: "supino", valueKg: 80, recordedAt: "2026-01-01" },
      { lift: "agachamento", valueKg: 100, recordedAt: "2026-01-02" },
      { lift: "supino", valueKg: 70, recordedAt: "2026-01-03" },
    ],
    chave,
    valor,
    quando,
  );
  assert.equal(out.find((o) => o.lift === "agachamento")!.novoRecorde, true);
  assert.equal(out.find((o) => o.valueKg === 70)!.novoRecorde, false);
});

test("ordena cronologicamente antes de marcar, mesmo que a entrada venha desordenada", () => {
  const out = marcarNovosRecordes<Ponto>(
    [
      { lift: "supino", valueKg: 80, recordedAt: "2026-01-15" }, // vem primeiro na lista, mas é o mais recente
      { lift: "supino", valueKg: 90, recordedAt: "2026-01-01" }, // mais antigo, valor mais alto
    ],
    chave,
    valor,
    quando,
  );
  // por ordem cronológica: 90 (01-01) é o 1º marco; 80 (01-15) não supera 90
  const porData = [...out].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  assert.equal(porData[0].novoRecorde, true);
  assert.equal(porData[1].novoRecorde, false);
});
