// /estilo — vitrina do sistema de design (fase 1: fundação).
//
// Mostra tokens e os componentes base lado a lado para revisão, antes de
// qualquer ecrã existente ser tocado. Ver referencia/SISTEMA-DESIGN.md.
// Página pública (src/proxy.ts) — não depende de sessão nem de dados.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AvisoApp } from "../_ui/design/aviso-app";
import { BlocoDados } from "../_ui/design/bloco-dados";
import { Botao } from "../_ui/design/botao";
import { CabecalhoEcra } from "../_ui/design/cabecalho-ecra";
import { LinhaExercicio } from "../_ui/design/linha-exercicio";

export const metadata: Metadata = {
  title: "Estilo · APEX",
};

const CORES_CLARO = [
  { nome: "branco", varr: "--apex-branco", valor: "#FFFFFF" },
  { nome: "tinta", varr: "--apex-tinta", valor: "#0A0A0B" },
  { nome: "cinza-texto", varr: "--apex-cinza-texto", valor: "#6B6B70" },
  { nome: "cinza-linha", varr: "--apex-cinza-linha", valor: "#E2E2E4" },
  { nome: "cinza-fundo", varr: "--apex-cinza-fundo", valor: "#F6F6F7" },
  { nome: "azul", varr: "--apex-azul", valor: "#0047FF" },
  { nome: "azul-fundo", varr: "--apex-azul-fundo", valor: "#EDF1FF" },
];

const CORES_TREINO = [
  { nome: "fundo-treino", varr: "--apex-fundo-treino", valor: "#0D0F13" },
  { nome: "superficie", varr: "--apex-superficie", valor: "#171A20" },
  { nome: "linha-treino", varr: "--apex-linha-treino", valor: "#262A31" },
  { nome: "texto-treino", varr: "--apex-texto-treino", valor: "#FFFFFF" },
  { nome: "texto-fraco", varr: "--apex-texto-fraco", valor: "#8A9098" },
  { nome: "verde", varr: "--apex-verde", valor: "#5AC8A0" },
];

const CORES_ESTADO = [
  { nome: "alerta", varr: "--apex-alerta", valor: "#C8761A" },
  { nome: "erro", varr: "--apex-erro", valor: "#C0392B" },
];

const ESPACAMENTO = [4, 8, 12, 16, 20, 24, 32, 48];

const TIPOGRAFIA = [
  { classe: "apex-tipo-titulo-ecra", nome: "Título de ecrã", texto: "Peito e tríceps" },
  { classe: "apex-tipo-titulo-seccao", nome: "Título de secção", texto: "Alunos ligados" },
  { classe: "apex-tipo-nome-exercicio", nome: "Nome de exercício", texto: "Supino com barra" },
  { classe: "apex-tipo-corpo", nome: "Corpo", texto: "Recolhemos o essencial para treinar contigo." },
  { classe: "apex-tipo-secundario", nome: "Secundário", texto: "peito · 90s" },
  { classe: "apex-tipo-etiqueta", nome: "Etiqueta", texto: "exercícios" },
  { classe: "apex-tipo-numero-dados", nome: "Número de dados", texto: "24" },
];

export default function EstiloPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col px-5 py-12">
      <header className="flex flex-col gap-3">
        <p className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>
          Sistema de design — fase 1
        </p>
        <h1 className="apex-tipo-titulo-ecra" style={{ color: "var(--apex-tinta)" }}>
          Fundação
        </h1>
        <p className="apex-tipo-corpo max-w-prose" style={{ color: "var(--apex-cinza-texto)" }}>
          Tokens e componentes base, antes de tocar em qualquer ecrã existente.
          Claro e rigoroso fora do treino; escuro só no treino ao vivo — a
          mudança de modo é deliberada.
        </p>
      </header>

      {/* ---------------------------------------------------------------- */}
      <Seccao titulo="Cor — modo claro">
        <div className="flex flex-wrap gap-4">
          {CORES_CLARO.map((c) => (
            <Amostra key={c.nome} {...c} />
          ))}
        </div>
      </Seccao>

      <Seccao titulo="Cor — modo treino">
        <div
          className="flex flex-wrap gap-4 rounded-none p-5"
          style={{ background: "var(--apex-fundo-treino)" }}
        >
          {CORES_TREINO.map((c) => (
            <Amostra key={c.nome} {...c} escura />
          ))}
        </div>
      </Seccao>

      <Seccao titulo="Estados (comuns aos dois modos)">
        <div className="flex flex-wrap gap-4">
          {CORES_ESTADO.map((c) => (
            <Amostra key={c.nome} {...c} />
          ))}
        </div>
      </Seccao>

      {/* ---------------------------------------------------------------- */}
      <Seccao titulo="Tipografia">
        <div className="flex flex-col gap-5">
          {TIPOGRAFIA.map((t) => (
            <div key={t.classe} className="flex flex-col gap-1">
              <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>
                {t.nome}
              </span>
              <span className={`${t.classe} apex-tabular`} style={{ color: "var(--apex-tinta)" }}>
                {t.texto}
              </span>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>
              Carga (treino) — condensada, 120px
            </span>
            <div className="p-6" style={{ background: "var(--apex-fundo-treino)" }}>
              <span
                className="apex-tipo-carga-treino apex-tabular"
                style={{ color: "var(--apex-texto-treino)" }}
              >
                52,5
              </span>
            </div>
          </div>
        </div>
      </Seccao>

      {/* ---------------------------------------------------------------- */}
      <Seccao titulo="Espaçamento — escala de 4">
        <div className="flex flex-wrap items-end gap-3">
          {ESPACAMENTO.map((px) => (
            <div key={px} className="flex flex-col items-center gap-1.5">
              <div style={{ width: px, height: px, background: "var(--apex-tinta)" }} />
              <span className="apex-tipo-etiqueta apex-tabular" style={{ color: "var(--apex-cinza-texto)" }}>
                {px}
              </span>
            </div>
          ))}
        </div>
      </Seccao>

      {/* ---------------------------------------------------------------- */}
      <Seccao titulo="Cabeçalho de ecrã">
        <CabecalhoEcra marca="APEX" direita="S3 / SEG" />
      </Seccao>

      <Seccao titulo="Bloco de dados em colunas">
        <BlocoDados
          itens={[
            { valor: "8", etiqueta: "exercícios" },
            { valor: "24", etiqueta: "séries" },
            { valor: "65′", etiqueta: "estimado" },
          ]}
        />
      </Seccao>

      <Seccao titulo="Linha de exercício">
        <div>
          <LinhaExercicio nome="Supino com barra" etiqueta="peito · 90s" carga="52,5 kg" series="4 × 6" />
          <LinhaExercicio nome="Remada curvada" etiqueta="dorsal · 90s" carga="60 kg" series="4 × 8" />
          <LinhaExercicio nome="Elevação lateral" etiqueta="deltoide · 60s" carga="12 kg" series="3 × 12" />
        </div>
      </Seccao>

      <Seccao titulo="Aviso da app">
        <AvisoApp titulo="Carga ajustada">
          Reduzimos a carga do supino em 8% porque reportaste desconforto no
          ombro no último check-in.
        </AvisoApp>
      </Seccao>

      <Seccao titulo="Botão — claro">
        <Botao variante="claro" type="button">
          Continuar
        </Botao>
        <p className="apex-tipo-secundario" style={{ color: "var(--apex-cinza-texto)" }}>
          Largura total do ecrã — o botão não tem largura própria, ocupa a do
          contentor.
        </p>
      </Seccao>

      <Seccao titulo="Botão — treino">
        <div
          className="flex flex-col gap-4 p-6"
          style={{ background: "var(--apex-fundo-treino)" }}
        >
          <Botao variante="treino" type="button">
            Série feita
          </Botao>
          <Botao variante="treino" type="button" disabled>
            Série feita
          </Botao>
        </div>
        <p className="apex-tipo-secundario" style={{ color: "var(--apex-cinza-texto)" }}>
          Desativado recua (sem preenchimento, borda fina, texto fraco) — não
          escurece um botão que já é sólido.
        </p>
      </Seccao>

      <footer
        className="apex-tipo-secundario mt-12 pb-8"
        style={{ color: "var(--apex-cinza-texto)" }}
      >
        Alvos de toque ≥44px (claro) e ≥64px (treino). Movimento respeita
        prefers-reduced-motion via <code>--apex-mov-duracao</code>.
      </footer>
    </main>
  );
}

function Seccao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="apex-tipo-titulo-seccao" style={{ color: "var(--apex-tinta)" }}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Amostra({
  nome,
  varr,
  valor,
  escura,
}: {
  nome: string;
  varr: string;
  valor: string;
  escura?: boolean;
}) {
  return (
    <div className="flex w-24 flex-col gap-1.5">
      <div
        className="h-16 w-full"
        style={{ background: `var(${varr})`, border: "1px solid var(--apex-cinza-linha)" }}
      />
      <span
        className="apex-tipo-etiqueta"
        style={{ color: escura ? "var(--apex-texto-treino)" : "var(--apex-tinta)" }}
      >
        {nome}
      </span>
      <span
        className="apex-tipo-secundario apex-tabular"
        style={{ color: escura ? "var(--apex-texto-fraco)" : "var(--apex-cinza-texto)" }}
      >
        {valor}
      </span>
    </div>
  );
}
