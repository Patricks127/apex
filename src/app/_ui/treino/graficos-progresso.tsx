/* ============================================================
   Componentes de desenho puros (sem estado, sem forms) por trás dos
   gráficos SVG de /progresso — extraídos para aqui para serem
   reutilizados pela ficha do aluno no lado do PT (read-only: o PT nunca
   regista recordes/métricas por outra pessoa, só vê). A matemática de
   escala vive em @/lib/treino/grafico; aqui só o desenho.
   ============================================================ */
import { escalarPontos, pathLinha, escalarBarras } from "@/lib/treino/grafico";
import type { RecordePessoal, MetricaCorporal } from "@/lib/treino/progresso-dados";

import { FUSO } from "@/lib/fuso";
const COR = {
  tinta: "var(--apex-tinta)",
  branco: "var(--apex-branco)",
  azul: "var(--apex-azul)",
} as const;

// Fuso FIXO — usado nos aria-label dos pontos do gráfico, dentro de
// componentes cliente (progresso-view.tsx, graficos-aluno.tsx). Sem
// timeZone explícito, o servidor (UTC) e o telemóvel (Portugal) podiam
// discordar sobre que dia é perto da meia-noite — hidratação a menos.
// FUSO: fonte única em src/lib/fuso.ts

const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: FUSO });

/** Evolução do 1RM — quadrado cheio = testado no ginásio, círculo vazio =
 *  estimativa do treino ao vivo. Cor azul só no marco de novo recorde. */
export function GraficoForca({ pontos }: { pontos: (RecordePessoal & { novoRecorde: boolean })[] }) {
  const LARGURA = 320;
  const ALTURA = 160;
  const coords = escalarPontos(
    pontos.map((p) => p.valueKg),
    LARGURA,
    ALTURA,
    24,
  );
  const path = pathLinha(coords);

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="apex-grafico__svg"
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Gráfico de evolução do 1RM"
    >
      <path d={path} fill="none" stroke={COR.tinta} strokeWidth={1.5} />
      {coords.map((c, i) => {
        const p = pontos[i];
        const marco = p.novoRecorde;
        const cor = marco ? COR.azul : COR.tinta;
        const titulo = `${p.valueKg} kg · ${p.source === "auto" ? "estimativa do treino" : "testado no ginásio"} · ${dataLonga(p.recordedAt)}${marco ? " · novo recorde" : ""}`;
        // aria-label, não <title> aninhado (o SVGProps do React não o tipa,
        // e um <title> dentro de <svg> é tratado como metadado do
        // documento, saindo vazio do lado do servidor — desalinha SSR).
        return p.source === "auto" ? (
          <circle
            key={p.id}
            cx={c.x}
            cy={c.y}
            r={marco ? 5.5 : 4}
            fill={COR.branco}
            stroke={cor}
            strokeWidth={1.5}
            aria-label={titulo}
          />
        ) : (
          <rect
            key={p.id}
            x={c.x - (marco ? 4.5 : 3.5)}
            y={c.y - (marco ? 4.5 : 3.5)}
            width={marco ? 9 : 7}
            height={marco ? 9 : 7}
            fill={cor}
            aria-label={titulo}
          />
        );
      })}
    </svg>
  );
}

/** Evolução de peso/medida corporal — linha simples, um ponto por registo. */
export function GraficoMetrica({ pontos }: { pontos: MetricaCorporal[] }) {
  const LARGURA = 320;
  const ALTURA = 140;
  const coords = escalarPontos(
    pontos.map((p) => p.value),
    LARGURA,
    ALTURA,
    20,
  );
  const path = pathLinha(coords);

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Gráfico de evolução da métrica corporal"
    >
      <path d={path} fill="none" stroke={COR.tinta} strokeWidth={1.5} />
      {coords.map((c, i) => (
        <circle
          key={pontos[i].id}
          cx={c.x}
          cy={c.y}
          r={3.5}
          fill={COR.tinta}
          aria-label={`${pontos[i].value} · ${dataLonga(pontos[i].recordedAt)}`}
        />
      ))}
    </svg>
  );
}

/** Volume por sessão/semana — barras; azul assinala semana de descarga. */
export function GraficoVolume({ barras }: { barras: { chave: string; valor: number; marco: boolean }[] }) {
  const ALTURA = 120;
  const alturas = escalarBarras(
    barras.map((b) => b.valor),
    ALTURA,
  );

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: ALTURA }}>
      {barras.map((b, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            title={`${b.chave}: ${Math.round(b.valor)} kg${b.marco ? " · descarga" : ""}`}
            style={{
              width: "100%",
              height: Math.max(2, alturas[i]),
              background: b.marco ? COR.azul : COR.tinta,
            }}
          />
        </div>
      ))}
    </div>
  );
}
