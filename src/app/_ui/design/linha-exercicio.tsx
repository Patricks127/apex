// Linha de exercício (ecrã do dia, modo claro). Nome + etiqueta por baixo à
// esquerda; carga + séries por baixo à direita — dois níveis, não dois
// iguais: a carga é o que se procura de relance, as séries são contexto.
// Separador de 1px em baixo. Fase 1: só o componente, não ligado a nenhum
// ecrã ainda.

export function LinhaExercicio({
  nome,
  etiqueta,
  carga,
  series,
}: {
  nome: string;
  etiqueta?: string;
  carga?: string;
  series?: string;
}) {
  return (
    <div className="apex-linha-exercicio">
      <div className="apex-linha-exercicio__principal">
        <span className="apex-tipo-nome-exercicio apex-linha-exercicio__nome">{nome}</span>
        {etiqueta ? (
          <span className="apex-tipo-etiqueta apex-linha-exercicio__etiqueta">{etiqueta}</span>
        ) : null}
      </div>
      {carga || series ? (
        <div className="apex-linha-exercicio__valores">
          {carga ? (
            <span className="apex-tabular apex-linha-exercicio__carga">{carga}</span>
          ) : null}
          {series ? (
            <span className="apex-tipo-secundario apex-tabular apex-linha-exercicio__series">
              {series}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
