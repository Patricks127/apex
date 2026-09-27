"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import type { PlanoGerado, DiaGerado, ExercicioGerado, Movimento, Lift } from "@/lib/motor";
import { regenerarPlano, avancarSemana, type EstadoAvanco } from "@/app/actions/treino";
import { construirLinhaTempo, type ItemLinhaTempo } from "@/lib/treino/linha-tempo";
import { formatarHora } from "@/lib/fuso";
import { CabecalhoEcra } from "../_ui/design/cabecalho-ecra";
import { BlocoDados } from "../_ui/design/bloco-dados";
import { AvisoApp } from "../_ui/design/aviso-app";
import { Botao } from "../_ui/design/botao";

const LIFT_LABEL: Record<Lift, string> = {
  agachamento: "Agach.",
  terra: "Terra",
  supino: "Supino",
  press: "Press",
};

export function VistaPlano({
  plano,
  nome,
  indiceHoje,
  hojeFeito,
}: {
  plano: PlanoGerado;
  nome: string;
  indiceHoje: number;
  hojeFeito: boolean;
}) {
  const meta = plano.meta;
  const dePt = meta.origem === "pt";
  const primeiroTreino = plano.days.findIndex((d) => !d.rest);
  const [sel, setSel] = useState(primeiroTreino < 0 ? 0 : primeiroTreino);
  const dia = plano.days[sel];
  const ehHoje = dia.dayIndex === indiceHoje;

  const cargas =
    meta.origem === "pt"
      ? null
      : (Object.keys(meta.maxes.used) as Lift[])
          .map((k) => `${LIFT_LABEL[k]} ${meta.maxes.used[k]} kg${meta.maxes.real.includes(k) ? "" : "*"}`)
          .join(" · ");

  return (
    <div className="apex-ecra-claro flex flex-col gap-5">
      <CabecalhoEcra marca="APEX" direita={`semana ${meta.week ?? 1}${meta.deloadWeek ? " · descarga" : ""}`} />

      <div className="flex flex-col gap-1">
        <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>
          {dePt ? "Plano do teu PT" : "O teu plano"}
        </span>
        <h1 className="apex-tipo-titulo-ecra" style={{ color: "var(--apex-tinta)" }}>
          {nome}
        </h1>
        <p className="apex-tipo-corpo" style={{ color: "var(--apex-cinza-texto)" }}>
          {meta.origem === "pt" ? `Atribuído por ${meta.ptNome}.` : meta.science}
        </p>
      </div>

      {/* Tira da semana */}
      <div className="grid grid-cols-7 gap-1.5">
        {plano.days.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSel(i)}
            className="apex-tipo-etiqueta flex flex-col items-center gap-1 border py-2"
            style={{
              borderColor: i === sel ? "var(--apex-tinta)" : "var(--apex-cinza-linha)",
              color: i === sel ? "var(--apex-tinta)" : d.rest ? "var(--apex-cinza-texto)" : "var(--apex-tinta)",
              background: i === sel ? "var(--apex-cinza-fundo)" : "var(--apex-branco)",
            }}
          >
            <span>{d.dayShort}</span>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: d.rest ? "var(--apex-cinza-linha)" : "var(--apex-tinta)",
              }}
            />
          </button>
        ))}
      </div>

      <DiaDetalhe dia={dia} ehHoje={ehHoje} hojeFeito={hojeFeito} />

      {cargas ? (
        <p className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>
          Cargas de referência: {cargas} — * estimado do nível/sexo, sem * é recorde teu.
        </p>
      ) : null}

      <AvancarSemana />

      {dePt ? null : (
        <form action={regenerarPlano}>
          <button
            type="submit"
            className="apex-tipo-secundario w-full border py-3"
            style={{ borderColor: "var(--apex-cinza-linha)", color: "var(--apex-cinza-texto)" }}
          >
            Regenerar plano (reinicia a progressão)
          </button>
        </form>
      )}
    </div>
  );
}

function AvancarSemana() {
  const [estado, acao, pendente] = useActionState(avancarSemana, {} as EstadoAvanco);

  return (
    <form action={acao} className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--apex-cinza-linha)" }}>
      <div>
        <p className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>Fechar a semana</p>
        <p className="apex-tipo-secundario" style={{ color: "var(--apex-cinza-texto)" }}>
          Junta o RPE e o volume das sessões desta semana e decide a próxima: progride, mantém ou descarga.
        </p>
      </div>

      {estado.erro ? (
        <p className="apex-tipo-secundario" style={{ color: "var(--apex-erro)" }} role="alert">
          {estado.erro}
        </p>
      ) : null}

      {estado.ok ? (
        <div className="flex flex-col gap-2 border py-3" style={{ borderColor: "var(--apex-cinza-linha)" }}>
          <p className="apex-tipo-nome-exercicio px-3" style={{ color: "var(--apex-tinta)" }}>
            Semana {estado.semana}
            {estado.deload ? " · descarga" : ""}
          </p>
          {estado.reason ? (
            <p className="apex-tipo-secundario px-3" style={{ color: "var(--apex-cinza-texto)" }}>
              {estado.reason}
            </p>
          ) : null}
          <table className="apex-tabular apex-tipo-secundario w-full px-3">
            <tbody>
              {estado.cargas?.map((c) => (
                <tr key={c.lift}>
                  <td className="py-0.5 pl-3 pr-3" style={{ color: "var(--apex-tinta)" }}>{c.lift}</td>
                  <td className="py-0.5 pr-2" style={{ color: "var(--apex-cinza-texto)" }}>{c.antes} kg</td>
                  <td className="py-0.5 pr-2" style={{ color: "var(--apex-cinza-texto)" }}>→</td>
                  <td className="py-0.5 pr-3" style={{ color: "var(--apex-tinta)" }}>{c.depois} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Botao variante="claro" type="submit" disabled={pendente}>
        {pendente ? "A calcular…" : "Avançar para a próxima semana"}
      </Botao>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Detalhe do dia — Estrutura C: linha do tempo (tempo à esquerda, marcador
// ao centro, conteúdo à direita). Ver referencia/SISTEMA-DESIGN.md.
// ---------------------------------------------------------------------------

function DiaDetalhe({ dia, ehHoje, hojeFeito }: { dia: DiaGerado; ehHoje: boolean; hojeFeito: boolean }) {
  if (dia.rest) {
    return (
      <section className="flex flex-col items-center gap-1 border-t border-b py-8 text-center" style={{ borderColor: "var(--apex-cinza-linha)" }}>
        <p className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>{dia.dayName}</p>
        <p className="apex-tipo-secundario" style={{ color: "var(--apex-cinza-texto)" }}>
          Descanso. Recuperar faz parte do treino.
        </p>
      </section>
    );
  }

  const estadoDia = !ehHoje ? "neutro" : hojeFeito ? "feito" : "hoje_por_comecar";
  const { itens, duracaoTotalMin, duracaoRestanteMin } = construirLinhaTempo(dia, { estadoDia });
  const nExercicios = dia.exercises?.length ?? 0;
  const nSeries = (dia.exercises ?? []).reduce((s, e) => s + e.sets.length, 0);

  const quantoFalta =
    estadoDia === "feito"
      ? "Feito"
      : estadoDia === "hoje_por_comecar"
        ? `Sai às ${horaSaida(duracaoRestanteMin)}`
        : `${duracaoTotalMin}′ estimados`;

  return (
    <section className="flex flex-col gap-4">
      <CabecalhoEcra marca={dia.dayName} direita={quantoFalta} />

      <BlocoDados
        itens={[
          { valor: String(nExercicios), etiqueta: "exercícios" },
          { valor: String(nSeries), etiqueta: "séries" },
          { valor: `${duracaoTotalMin}′`, etiqueta: "estimado" },
        ]}
      />

      <Link href={`/treino/${dia.dayIndex}`} className="apex-botao apex-botao--claro">
        Registar treino
      </Link>

      {dia.why && dia.why.length > 0 ? (
        <AvisoApp titulo="Porquê este treino">
          <ul className="flex flex-col gap-0.5 pl-4" style={{ listStyle: "disc" }}>
            {dia.why.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </AvisoApp>
      ) : null}

      <LinhaTempo itens={itens} />
    </section>
  );
}

// Hora de Lisboa, não a do fuso do aparelho (src/lib/fuso.ts).
function horaSaida(minutosRestantes: number): string {
  return formatarHora(Date.now() + minutosRestantes * 60_000);
}

function LinhaTempo({ itens }: { itens: ItemLinhaTempo[] }) {
  return (
    <div className="apex-linha-tempo">
      {itens.map((item, i) => (
        <div key={i} className={`apex-linha-tempo__item apex-linha-tempo__item--${item.estado}`}>
          <span className="apex-tipo-etiqueta apex-tabular apex-linha-tempo__hora">{item.inicioMin}′</span>
          <div className="apex-linha-tempo__marcador-col">
            <span className="apex-linha-tempo__marcador" />
            {i < itens.length - 1 ? <span className="apex-linha-tempo__traco" /> : null}
          </div>
          <div className="apex-linha-tempo__conteudo">
            <ConteudoBloco item={item} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConteudoBloco({ item }: { item: ItemLinhaTempo }) {
  switch (item.tipo) {
    case "aquecimento":
      return <ConteudoMovimentos titulo="Aquecimento" movimentos={item.movimentos} />;
    case "mobilidade":
      return <ConteudoMovimentos titulo="Mobilidade / prevenção" movimentos={item.movimentos} />;
    case "alongamento":
      return <ConteudoMovimentos titulo="Alongamentos" movimentos={item.movimentos} />;
    case "descanso":
      return (
        <span className="apex-tipo-secundario" style={{ color: "var(--apex-cinza-texto)" }}>
          Descanso · {item.label}
        </span>
      );
    case "exercicio":
      return (
        <ConteudoExercicio
          exercicio={item.exercicio}
          indice={item.indice}
          mostrarQuadrados={item.estado === "a_decorrer"}
        />
      );
  }
}

function ConteudoMovimentos({ titulo, movimentos }: { titulo: string; movimentos: Movimento[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>{titulo}</span>
      <ul className="flex flex-col gap-0.5">
        {movimentos.map((m, i) => (
          <li key={i} className="apex-tipo-secundario" style={{ color: "var(--apex-cinza-texto)" }}>
            {m.name} — {m.dose}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConteudoExercicio({
  exercicio,
  indice,
  mostrarQuadrados,
}: {
  exercicio: ExercicioGerado;
  indice: number;
  mostrarQuadrados: boolean;
}) {
  const s = exercicio.sets[0];
  const carga = s.w != null ? `${s.w} kg` : exercicio.bw ? "peso corporal" : "—";
  const series = s.reps > 0 ? `${exercicio.sets.length} × ${s.reps}` : `${exercicio.sets.length} séries`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>
          {indice + 1}. {exercicio.name}
        </span>
        {!mostrarQuadrados ? (
          <div className="apex-linha-exercicio__valores">
            <span className="apex-tabular apex-linha-exercicio__carga">{carga}</span>
            <span className="apex-tipo-secundario apex-tabular apex-linha-exercicio__series">{series}</span>
          </div>
        ) : null}
      </div>

      <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-cinza-texto)" }}>
        {[exercicio.muscle, `RPE ${s.rpe}`].filter(Boolean).join(" · ")}
      </span>

      {mostrarQuadrados ? (
        <div className="mt-1 flex items-center gap-3">
          <span className="apex-tabular apex-linha-exercicio__carga">{carga}</span>
          <span className="apex-tipo-secundario apex-tabular" style={{ color: "var(--apex-cinza-texto)" }}>
            {series}
          </span>
          <div className="apex-quadrados-series">
            {exercicio.sets.map((_, i) => (
              <span key={i} className="apex-quadrado-serie" />
            ))}
          </div>
        </div>
      ) : null}

      {exercicio.substituted ? (
        <span className="apex-tipo-secundario" style={{ color: "var(--apex-azul)" }}>
          Substituído por lesão
        </span>
      ) : null}
      {exercicio.focusTag ? (
        <span className="apex-tipo-secundario" style={{ color: "var(--apex-azul)" }}>
          Foco: {exercicio.focusTag}
        </span>
      ) : null}
      {exercicio.swap ? (
        <p className="apex-tipo-secundario" style={{ color: "var(--apex-alerta)" }}>{exercicio.swap}</p>
      ) : null}
      {exercicio.detail ? (
        <p className="apex-tipo-secundario" style={{ color: "var(--apex-cinza-texto)" }}>{exercicio.detail}</p>
      ) : null}
      {exercicio.nota ? (
        <p className="apex-tipo-secundario" style={{ color: "var(--apex-azul)" }}>Nota do PT: {exercicio.nota}</p>
      ) : null}
    </div>
  );
}
