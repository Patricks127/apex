import { useCallback, useEffect, useRef, useState } from "react";
import { CalculadoraDiscos } from "./calculadora-discos";

import { formatarNumero, rotuloEsforco, rotuloMusculo } from "@/lib/formato";
// Formato de Portugal ("57,5") — fonte única em src/lib/formato.ts;
// re-exportado para quem já o importava daqui.
export { formatarNumero };

const ATRASO_INICIAL_MS = 400;
const ATRASO_MIN_MS = 60;
const FATOR_ACELERACAO = 0.8;

/** Toque curto = um passo (chama uma vez e para, porque o solta antes do
 *  primeiro atraso). Toque longo/segurar = repete, acelerando até um
 *  mínimo — sem isto, trocar 57,5→70kg eram 5 toques. */
function usePressaoRepetida(callback: () => void) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parar = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const iniciar = useCallback(() => {
    callbackRef.current();
    let atraso = ATRASO_INICIAL_MS;
    const agendar = () => {
      timeoutRef.current = setTimeout(() => {
        callbackRef.current();
        atraso = Math.max(ATRASO_MIN_MS, Math.round(atraso * FATOR_ACELERACAO));
        agendar();
      }, atraso);
    };
    agendar();
  }, []);

  useEffect(() => parar, [parar]);

  return { onPointerDown: iniciar, onPointerUp: parar, onPointerLeave: parar, onPointerCancel: parar };
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
  incrementoKg,
  caution,
  substituted,
  focusTag,
  swap,
  onAjustar,
  onDefinir,
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
  incrementoKg: number;
  caution?: boolean;
  substituted?: boolean;
  focusTag?: string;
  swap?: string | null;
  onAjustar: (delta: number) => void;
  onDefinir: (valor: number) => void;
  onFeito: () => void;
}) {
  const [aEditar, setAEditar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ehCarga = !bw && w != null;
  const bigNumero = ehCarga ? w! : repsAlvo;
  const unidade = ehCarga ? "kg" : repsAlvo === 1 ? "rep" : "reps";
  const passo = ehCarga ? incrementoKg : 1;

  const diminuir = usePressaoRepetida(() => onAjustar(-passo));
  const aumentar = usePressaoRepetida(() => onAjustar(passo));

  useEffect(() => {
    if (aEditar) inputRef.current?.select();
  }, [aEditar]);

  function confirmarEdicao(valorTexto: string) {
    const valor = Number.parseFloat(valorTexto.replace(",", "."));
    if (Number.isFinite(valor)) onDefinir(valor);
    setAEditar(false);
  }

  return (
    <div className="apex-treino-serie">
      <span className="apex-tipo-etiqueta apex-treino-nome">
        {nomeExercicio}
        {rotuloMusculo(muscle) ? ` · ${rotuloMusculo(muscle)}` : ""}
      </span>
      <span className="apex-tipo-secundario apex-tabular apex-treino-contagem">
        Série {numero} de {total}
      </span>

      <div className="apex-treino-carga-linha">
        {aEditar ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step={passo}
            defaultValue={bigNumero}
            autoFocus
            className="apex-tipo-carga-treino apex-tabular apex-treino-input-carga"
            onBlur={(e) => confirmarEdicao(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setAEditar(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="apex-tipo-carga-treino apex-tabular apex-treino-botao-carga"
            onClick={() => setAEditar(true)}
            aria-label="Escrever o valor diretamente"
          >
            {formatarNumero(bigNumero)}
          </button>
        )}
        <span className="apex-tipo-titulo-seccao apex-treino-unidade" style={{ marginTop: 0 }}>
          {unidade}
        </span>
      </div>

      <span className="apex-tipo-secundario apex-tabular apex-treino-alvo">
        {[ehCarga ? `${repsAlvo} reps` : null, rotuloEsforco(rpeAlvoTexto, ehCarga)].filter(Boolean).join(" · ")}
      </span>

      <div className="apex-stepper">
        <button
          type="button"
          className="apex-stepper__botao"
          aria-label={ehCarga ? `Menos ${formatarNumero(passo)} kg` : "Menos 1 rep"}
          {...diminuir}
        >
          −
        </button>
        <button
          type="button"
          className="apex-stepper__botao"
          aria-label={ehCarga ? `Mais ${formatarNumero(passo)} kg` : "Mais 1 rep"}
          {...aumentar}
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
