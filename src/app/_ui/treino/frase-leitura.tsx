import type { Leitura } from "@/lib/treino/leituras";

/** A frase de leitura de um gráfico (src/lib/treino/leituras.ts), por baixo
 *  dele. Sem dados no gráfico → nada (o gráfico já tem o estado vazio). Com
 *  dados mas sem tendência sustentável → diz isso, nunca inventa. O sentido
 *  está nas palavras; o traço lateral só o reforça (nunca só cor). */
export function FraseLeitura({ leitura, temDados }: { leitura: Leitura | null; temDados: boolean }) {
  if (!temDados) return null;
  if (!leitura) {
    return <p className="apex-leitura apex-leitura--sem-tendencia apex-tipo-secundario">Ainda sem dados suficientes para uma tendência.</p>;
  }
  return (
    <p className="apex-leitura apex-tipo-secundario" data-sentido={leitura.sentido}>
      {leitura.texto}
    </p>
  );
}
