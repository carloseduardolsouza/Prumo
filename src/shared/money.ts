import { Decimal } from 'decimal.js';

// Valores monetários nunca usam ponto flutuante binário (RN002). Escala de 2 casas para BRL.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal.Value;
export const money = (v: MoneyInput): Decimal => new Decimal(v);
export const round2 = (v: MoneyInput): Decimal => money(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
/** String com 2 casas, como a API devolve valores (nunca number). */
export const toMoneyString = (v: MoneyInput): string => round2(v).toFixed(2);

/**
 * Divide `total` em `parts` partes de 2 casas cuja soma é exatamente `total` (RN032).
 * Os centavos que sobram vão uma vez para cada uma das primeiras parcelas.
 */
export function splitEvenly(total: MoneyInput, parts: number): Decimal[] {
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError('parts deve ser um inteiro >= 1');
  const cents = round2(total).times(100).toDecimalPlaces(0);
  const base = cents.dividedToIntegerBy(parts);
  const remainder = cents.minus(base.times(parts)).toNumber();
  return Array.from({ length: parts }, (_, i) => base.plus(i < remainder ? 1 : 0).dividedBy(100));
}
