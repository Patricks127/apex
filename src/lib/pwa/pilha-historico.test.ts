import assert from "node:assert/strict";
import { test } from "node:test";
import { avancar, recuar, RAIZES } from "./pilha-historico.ts";

// ---------------------------------------------------------------------------
// avançar
// ---------------------------------------------------------------------------

test("avancar: primeira navegação para uma raiz começa a pilha só com ela", () => {
  assert.deepEqual(avancar([], "/painel"), ["/painel"]);
});

test("avancar: chegar a um ecrã novo empilha por cima", () => {
  assert.deepEqual(avancar(["/painel"], "/pt/alunos"), ["/painel", "/pt/alunos"]);
  assert.deepEqual(
    avancar(["/painel", "/pt/alunos"], "/pt/aluno/abc"),
    ["/painel", "/pt/alunos", "/pt/aluno/abc"]
  );
});

test("avancar: chegar a uma raiz reinicia a pilha, mesmo vindo de longe", () => {
  const funda = ["/painel", "/pt/alunos", "/pt/aluno/abc", "/pt/aluno/abc/chat"];
  assert.deepEqual(avancar(funda, "/painel"), ["/painel"]);
  assert.deepEqual(avancar(funda, "/entrar"), ["/entrar"]);
});

test("avancar: mesma rota (refresh) não muda nada", () => {
  const pilha = ["/painel", "/pt/alunos"];
  assert.deepEqual(avancar(pilha, "/pt/alunos"), pilha);
});

test("avancar: voltar a um ecrã já visitado por um LINK empilha de novo (não deduplica)", () => {
  // de propósito: o histórico nativo do browser também não deduplica — uma
  // revisita por link é uma entrada nova a sério, tal como no nativo. Ver
  // o comentário em avancar() sobre porquê (empilhar sempre é o que mantém
  // a pilha própria e o histórico nativo a par, um nível por popstate).
  const pilha = ["/painel", "/pt/alunos", "/pt/aluno/abc"];
  assert.deepEqual(avancar(pilha, "/pt/alunos"), [
    "/painel",
    "/pt/alunos",
    "/pt/aluno/abc",
    "/pt/alunos",
  ]);
});

test("avancar: oscilar entre dois ecrãs cresce um nível por navegação, mas continua finito e nunca circular", () => {
  let pilha: string[] = ["/painel"];
  const sequencia = ["/a", "/b", "/a", "/b", "/a", "/b", "/a", "/b", "/a", "/b"];
  for (const passo of sequencia) pilha = avancar(pilha, passo);
  assert.equal(pilha.length, 1 + sequencia.length);
  // recuar tantas vezes quantas as navegações reais tem sempre de terminar
  // numa raiz — nunca fica preso, nunca dá voltas.
  let passos = 0;
  while (true) {
    const r = recuar(pilha);
    if (r === null) break;
    pilha = r.pilha;
    passos++;
    assert.ok(passos <= sequencia.length + 1, "recuar não terminou — possível ciclo");
  }
  assert.deepEqual(pilha, ["/painel"]);
});

test("avancar: nunca cresce SEM limite nenhum — um ciclo patológico (ex.: redirect para si próprio) é cortado", () => {
  let pilha: string[] = ["/painel"];
  for (let i = 0; i < 500; i++) pilha = avancar(pilha, `/ecra-${i}`);
  assert.ok(pilha.length <= 50, `pilha cresceu para além do limite defensivo: ${pilha.length}`);
  assert.equal(pilha[0], "/painel", "a raiz do fundo da pilha nunca se perde");
});

// ---------------------------------------------------------------------------
// recuar
// ---------------------------------------------------------------------------

test("recuar: numa raiz (pilha de 1 nível) devolve null — deixa o Android sair da app", () => {
  assert.equal(recuar(["/painel"]), null);
  assert.equal(recuar(["/entrar"]), null);
});

test("recuar: pilha vazia também devolve null (nunca rebenta)", () => {
  assert.equal(recuar([]), null);
});

test("recuar: sobe exatamente um nível de cada vez", () => {
  const r = recuar(["/painel", "/pt/alunos", "/pt/aluno/abc"]);
  assert.deepEqual(r, { pilha: ["/painel", "/pt/alunos"], anterior: "/pt/alunos" });
});

test("recuar repetido chega sempre a uma raiz e para — nunca fica preso nem sobe para negativo", () => {
  let pilha = ["/painel", "/pt/alunos", "/pt/aluno/abc", "/pt/aluno/abc/chat"];
  let passos = 0;
  while (true) {
    const r = recuar(pilha);
    if (r === null) break;
    pilha = r.pilha;
    passos++;
    assert.ok(passos <= 10, "recuar não terminou — possível ciclo");
  }
  assert.equal(pilha.length, 1);
  assert.ok((RAIZES as readonly string[]).includes(pilha[0]) || pilha[0] === "/painel");
});
