import { CalculadoraDiscos } from "./calculadora-discos";

export function formatarNumero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

export function SerieAtual({
  nomeExercicio,
  muscle,
  numero,
  total,
  bw,
  w,
  repsAlvo,
  rpeAlvoTexto,
  usaBarra,
  caution,
  substituted,
  focusTag,
  swap,
  onAjustar,
  onFeito,
}: {
  nomeExercicio: string;
  muscle: string | null;
  numero: number;
  total: number;
  bw: boolean;
  w: number | null;
  repsAlvo: number;
  rpeAlvoTexto: string;
  usaBarra: boolean;
  caution?: boolean;
  substituted?: boolean;
  focusTag?: string;
  swap?: string | null;
  onAjustar: (delta: number) => void;
  onFeito: () => void;
}) {
  const ehCarga = !bw && w != null;
  const bigNumero = ehCarga ? w! : repsAlvo;
  const unidade = ehCarga ? "kg" : repsAlvo === 1 ? "rep" : "reps";
  const passo = ehCarga ? 2.5 : 1;

  return (
    <div className="apex-treino-serie">
      <span className="apex-tipo-etiqueta apex-treino-nome">
        {nomeExercicio}
        {muscle ? ` · ${muscle}` : ""}
      </span>
      <span className="apex-tipo-secundario apex-tabular apex-treino-contagem">
        Série {numero} de {total}
      </span>

      <div className="apex-treino-carga-linha">
        <span className="apex-tipo-carga-treino apex-tabular">{formatarNumero(bigNumero)}</span>
        <span className="apex-tipo-titulo-seccao apex-treino-unidade" style={{ marginTop: 0 }}>
          {unidade}
        </span>
      </div>

      <span className="apex-tipo-secundario apex-tabular apex-treino-alvo">
        {ehCarga ? `${repsAlvo} reps · ${rpeAlvoTexto}` : rpeAlvoTexto}
      </span>

      <div className="apex-stepper">
        <button
          type="button"
          className="apex-stepper__botao"
          onClick={() => onAjustar(-passo)}
          aria-label={ehCarga ? "Menos 2,5 kg" : "Menos 1 rep"}
        >
          −
        </button>
        <button
          type="button"
          className="apex-stepper__botao"
          onClick={() => onAjustar(passo)}
          aria-label={ehCarga ? "Mais 2,5 kg" : "Mais 1 rep"}
        >
          +
        </button>
      </div>

      {usaBarra ? <CalculadoraDiscos pesoTotal={w} /> : null}

      {caution || substituted || focusTag || swap ? (
        <div className="flex flex-col items-center gap-1">
          {caution ? (
            <span className="apex-tipo-secundario" style={{ color: "var(--apex-alerta)" }}>
              Carga cautelar (check-in)
            </span>
          ) : null}
          {substituted ? (
            <span className="apex-tipo-secundario" style={{ color: "var(--apex-alerta)" }}>
              Substituído por lesão
            </span>
          ) : null}
          {focusTag ? (
            <span className="apex-tipo-secundario" style={{ color: "var(--apex-texto-fraco)" }}>
              Foco: {focusTag}
            </span>
          ) : null}
          {swap ? (
            <span className="apex-tipo-secundario" style={{ color: "var(--apex-texto-fraco)" }}>
              {swap}
            </span>
          ) : null}
        </div>
      ) : null}

      <button type="button" className="apex-botao apex-botao--treino" style={{ marginTop: "var(--apex-space-4)" }} onClick={onFeito}>
        Feito
      </button>
    </div>
  );
}
