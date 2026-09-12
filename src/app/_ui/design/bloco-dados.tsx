// Bloco de dados em colunas divididas por linhas de 1px (ex.: "8 exerc. ·
// 24 séries · 65′ estimado"). Fase 1: só o componente, não ligado a nenhum
// ecrã ainda.

export function BlocoDados({ itens }: { itens: { valor: string; etiqueta: string }[] }) {
  return (
    <div className="apex-dados">
      {itens.map((item, i) => (
        <div key={i} className="apex-dados__coluna">
          <span className="apex-tipo-numero-dados apex-tabular apex-dados__valor">{item.valor}</span>
          <span className="apex-tipo-etiqueta apex-dados__etiqueta">{item.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}
