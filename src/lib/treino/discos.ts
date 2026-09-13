/**
 * Calculadora de discos — que pôr de cada lado da barra, com as cores de
 * competição pedidas: 20 vermelho, 15 azul, 10 verde, 5 branco, 2,5 e 1,25
 * pretos (as duas denominações pretas distinguem-se por tamanho no
 * desenho, não por cor — como os discos físicos).
 *
 * Puro — não sabe nada de UI nem de exercícios; recebe a carga TOTAL da
 * barra (o que já está em `SerieGerada.w`) e devolve os discos de UM lado.
 */

export type Disco = { kg: number; cor: string };

export const DENOMINACOES_DISCOS: Disco[] = [
  { kg: 20, cor: "#D5342B" }, // vermelho
  { kg: 15, cor: "#2159C9" }, // azul
  { kg: 10, cor: "#22935A" }, // verde
  { kg: 5, cor: "#F2F2F0" }, // branco
  { kg: 2.5, cor: "#26262A" }, // preto (maior dos dois)
  { kg: 1.25, cor: "#26262A" }, // preto (menor)
];

const PESO_BARRA_OMISSO = 20;
const MENOR_DENOMINACAO = 1.25;

/**
 * Discos a pôr de CADA lado, do maior para o mais próximo da barra — a
 * ordem física real (os maiores entram primeiro, mais perto do colar).
 * Devolve `[]` se a carga total não passar do peso da barra vazia (nada a
 * carregar) ou se `pesoTotal` for `null` (peso corporal).
 */
export function calcularDiscosPorLado(
  pesoTotal: number | null,
  pesoBarra: number = PESO_BARRA_OMISSO,
): Disco[] {
  if (pesoTotal == null) return [];
  // arredonda à menor denominação para absorver erro de vírgula flutuante
  // e cargas que não sejam múltiplos exatos (o motor já usa múltiplos de
  // 2,5; o ajuste manual −/+ na app também).
  let restante = Math.round((pesoTotal - pesoBarra) / 2 / MENOR_DENOMINACAO) * MENOR_DENOMINACAO;
  if (restante <= 0) return [];

  const discos: Disco[] = [];
  for (const d of DENOMINACOES_DISCOS) {
    while (restante + 1e-9 >= d.kg) {
      discos.push(d);
      restante = Math.round((restante - d.kg) * 100) / 100;
    }
  }
  return discos;
}
