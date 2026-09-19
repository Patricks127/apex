import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizePost, prepararPost, type FontePost } from "./sanitizar-post.ts";

const SESSAO_RICA = {
  title: "Peito + Tríceps",
  nSets: 22,
  volumeKg: 6750,
  // dados que NUNCA podem chegar a um post:
  avgRpe: 9.2,
  completion: 0.95,
  checkin: {
    discomfortZones: ["ombro"],
    effort: "limite",
    note: "dor aguda no ombro direito ao final da sessão",
  },
};

const VIDEO_RICO = {
  storagePath: "user-x/videos/abc.mp4",
  // feedback do PT — privado, nunca pode chegar a um post (nem há coluna
  // para o guardar, mas mesmo assim nunca deve ser lido daqui):
  feedback: [{ body: "joelho a colapsar na subida, cuidado com o desconforto no joelho" }],
};

// ---------------------------------------------------------------------------
// GUARDA-COSTAS: as colunas nunca contêm check-in/RPE/desconforto/feedback
// ---------------------------------------------------------------------------

test("sanitizePost(treino): só workoutTitle/workoutSets/workoutVolume ficam preenchidos, o resto fica null", () => {
  const r = sanitizePost({ kind: "treino", authorId: "u1", sessao: SESSAO_RICA }, "Bom treino hoje!");
  assert.ok(!("erro" in r));
  assert.equal(r.workoutTitle, "Peito + Tríceps");
  assert.equal(r.workoutSets, 22);
  assert.equal(r.workoutVolume, 6750);
  assert.equal(r.recordLift, null);
  assert.equal(r.recordValue, null);
  assert.equal(r.mediaPath, null);
  assert.equal(r.mediaKind, null);
  // a chave 'workoutRpe' nem sequer existe no tipo — confirma que o
  // objeto devolvido não tem essa propriedade de forma nenhuma.
  assert.equal(Object.prototype.hasOwnProperty.call(r, "workoutRpe"), false);
});

test("sanitizePost(treino): o texto do check-in/desconforto não aparece em lado nenhum do resultado", () => {
  const r = sanitizePost({ kind: "treino", authorId: "u1", sessao: SESSAO_RICA }, "Bom treino hoje!");
  assert.ok(!("erro" in r));
  const serializado = JSON.stringify(r);
  assert.equal(serializado.includes("ombro"), false);
  assert.equal(serializado.includes("limite"), false);
  assert.equal(serializado.includes("dor aguda"), false);
  assert.equal(serializado.includes("9.2"), false); // avgRpe
  assert.equal(serializado.includes("0.95"), false); // completion
});

test("sanitizePost(video): feedback do PT nunca chega ao resultado", () => {
  const r = sanitizePost({ kind: "video", authorId: "u1", video: VIDEO_RICO }, "Como saiu este agachamento?");
  assert.ok(!("erro" in r));
  assert.equal(r.mediaPath, "user-x/videos/abc.mp4");
  assert.equal(r.mediaKind, "video");
  assert.equal(JSON.stringify(r).includes("colapsar"), false);
  assert.equal(JSON.stringify(r).includes("feedback"), false);
});

test("sanitizePost(imagem): mediaPath/mediaKind='image' ficam preenchidos, o resto null", () => {
  const r = sanitizePost({ kind: "imagem", authorId: "u1", imagem: { storagePath: "u1/abc.jpg" } }, "Olha o pump");
  assert.ok(!("erro" in r));
  assert.equal(r.mediaPath, "u1/abc.jpg");
  assert.equal(r.mediaKind, "image");
  assert.equal(r.workoutTitle, null);
  assert.equal(r.recordLift, null);
});

test("sanitizePost(recorde): só recordLift/recordValue ficam preenchidos", () => {
  const r = sanitizePost({ kind: "recorde", authorId: "u1", recorde: { lift: "supino", valueKg: 85 } }, "Novo recorde!");
  assert.ok(!("erro" in r));
  assert.equal(r.recordLift, "supino");
  assert.equal(r.recordValue, 85);
  assert.equal(r.workoutTitle, null);
  assert.equal(r.mediaPath, null);
});

test("sanitizePost(texto/conquista): todas as colunas estruturadas ficam null, sem texto → erro", () => {
  const r1 = sanitizePost({ kind: "texto", texto: "" }, "Hoje foi um bom dia de treino.");
  assert.ok(!("erro" in r1));
  assert.equal(r1.body, "Hoje foi um bom dia de treino.");
  assert.equal(r1.workoutTitle, null);
  assert.equal(r1.recordLift, null);
  assert.equal(r1.mediaPath, null);

  const r2 = sanitizePost({ kind: "conquista", texto: "" }, "   ");
  assert.ok("erro" in r2);
});

// ---------------------------------------------------------------------------
// A PROVA de que o teste testa mesmo algo: uma versão INGÉNUA (o erro fácil
// de cometer — espalhar o objeto de origem inteiro num campo qualquer) FALHA
// a mesma asserção.
// ---------------------------------------------------------------------------

function sanitizePostIngenuo(fonte: FontePost, bodyBruto: string) {
  const body = bodyBruto.trim();
  switch (fonte.kind) {
    case "treino":
      return { body, ...fonte.sessao }; // <- o erro: spread do objeto rico (traz avgRpe/checkin)
    case "video":
      return { body, ...fonte.video }; // <- traz feedback
    case "recorde":
      return { body, ...fonte.recorde };
    default:
      return { body };
  }
}

test("GUARDA-COSTAS confirmado: a versão ingénua (spread) FALHA a asserção de isolamento — prova que o teste não é vazio", () => {
  const ingenuo = sanitizePostIngenuo({ kind: "treino", authorId: "u1", sessao: SESSAO_RICA }, "Bom treino!");
  const serializadoIngenuo = JSON.stringify(ingenuo);
  // a versão sem proteção DEIXA passar o desconforto — é isto que a real impede
  assert.equal(serializadoIngenuo.includes("ombro"), true);
  assert.equal(serializadoIngenuo.includes("dor aguda"), true);

  const ingenuoVideo = sanitizePostIngenuo({ kind: "video", authorId: "u1", video: VIDEO_RICO }, "Como saiu?");
  assert.equal(JSON.stringify(ingenuoVideo).includes("colapsar"), true);

  // e a versão REAL, com os mesmos dados de entrada, não deixa:
  const real = sanitizePost({ kind: "treino", authorId: "u1", sessao: SESSAO_RICA }, "Bom treino!");
  assert.ok(!("erro" in real));
  assert.equal(JSON.stringify(real).includes("ombro"), false);
});

// ---------------------------------------------------------------------------
// GUARDA-COSTAS: publicar a fonte de OUTRO utilizador é sempre bloqueado —
// mesmo que a leitura da BD tenha tido sucesso (ex.: PT com scope_treinos
// consegue LER a sessão do aluno; isso não pode virar "publicar como seu").
// ---------------------------------------------------------------------------

test("prepararPost: bloqueia publicar o TREINO de outro utilizador", () => {
  const fonte: FontePost = { kind: "treino", authorId: "aluno-x", sessao: SESSAO_RICA };
  const r = prepararPost(fonte, "pt-y-com-scope-treinos", "Vejam o treino dele!");
  assert.ok("erro" in r);
});

test("prepararPost: bloqueia publicar o RECORDE de outro utilizador", () => {
  const fonte: FontePost = { kind: "recorde", authorId: "aluno-x", recorde: { lift: "supino", valueKg: 999 } };
  const r = prepararPost(fonte, "terceiro-sem-relacao-nenhuma", "Olha o recorde dele!");
  assert.ok("erro" in r);
});

test("prepararPost: bloqueia publicar o VÍDEO de outro utilizador (mesmo um PT com scope_videos)", () => {
  const fonte: FontePost = { kind: "video", authorId: "aluno-x", video: VIDEO_RICO };
  const r = prepararPost(fonte, "pt-y-com-scope-videos", "Vídeo do meu aluno!");
  assert.ok("erro" in r);
});

test("prepararPost: bloqueia publicar a IMAGEM de outro utilizador (a Server Action nunca deveria construir isto, mas o guarda-costas não confia só nela)", () => {
  const fonte: FontePost = { kind: "imagem", authorId: "aluno-x", imagem: { storagePath: "aluno-x/foto.jpg" } };
  const r = prepararPost(fonte, "outro-qualquer", "Bela foto!");
  assert.ok("erro" in r);
});

test("prepararPost: publicar a PRÓPRIA fonte funciona normalmente", () => {
  const fonte: FontePost = { kind: "treino", authorId: "eu-mesmo", sessao: SESSAO_RICA };
  const r = prepararPost(fonte, "eu-mesmo", "Bom treino!");
  assert.ok(!("erro" in r));
  assert.equal(r.kind, "treino");
});

test("prepararPost: fonte null (source_id inexistente ou RLS bloqueou a leitura) → erro, nunca colunas vazias silenciosas", () => {
  const r = prepararPost(null, "qualquer-um", "texto");
  assert.ok("erro" in r);
});

test("prepararPost: conquista/texto não têm dono a verificar — sempre passam pela sanitização normal", () => {
  const r = prepararPost({ kind: "conquista", texto: "" }, "qualquer-um", "Terminei o meu primeiro mês!");
  assert.ok(!("erro" in r));
  assert.equal(r.body, "Terminei o meu primeiro mês!");
});
