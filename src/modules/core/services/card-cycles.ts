import { addDays } from '../../../shared/dates.js';

/**
 * Regras de ciclo de fatura (RN029/030). Decisão de produto (spec §24.3), configurável no futuro:
 *  - o ciclo vai do dia seguinte ao fechamento anterior até o dia do fechamento, INCLUSIVE;
 *    uma compra feita no próprio dia do fechamento ainda entra na fatura que fecha naquele dia;
 *  - o "melhor dia de compra" é, portanto, o dia seguinte ao fechamento;
 *  - fechamento/vencimento em dias que não existem no mês (29–31) caem no último dia do mês;
 *  - vencimento <= dia de fechamento significa vencimento no mês seguinte ao fechamento.
 * Datas são "AAAA-MM-DD" (calendário, sem fuso).
 */
export interface Cycle {
  startDate: string;
  closingDate: string;
  dueDate: string;
  /** Ano/mês do vencimento: identifica a fatura. */
  refYear: number;
  refMonth: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const parts = (d: string) => d.split('-').map(Number) as [number, number, number];

/** Soma `n` meses a (ano, mês) e devolve o novo (ano, mês). */
export function shiftYm(y: number, m: number, n: number): [number, number] {
  const t = y * 12 + (m - 1) + n;
  return [Math.floor(t / 12), (t % 12) + 1];
}

const closingOf = (y: number, m: number, closingDay: number) => ymd(y, m, Math.min(closingDay, lastDay(y, m)));

/** Ciclo cujo FECHAMENTO cai no mês (y, m). */
export function cycleForClosingMonth(y: number, m: number, closingDay: number, dueDay: number): Cycle {
  const closingDate = closingOf(y, m, closingDay);
  const [py, pm] = shiftYm(y, m, -1);
  const startDate = addDays(closingOf(py, pm, closingDay), 1);
  const [dy, dm] = dueDay > closingDay ? [y, m] : shiftYm(y, m, 1);
  return { startDate, closingDate, dueDate: ymd(dy, dm, Math.min(dueDay, lastDay(dy, dm))), refYear: dy, refMonth: dm };
}

/** Ciclo (fatura) em que uma compra feita em `date` entra. */
export function cycleFor(date: string, closingDay: number, dueDay: number): Cycle {
  const [y, m] = parts(date);
  if (date <= closingOf(y, m, closingDay)) return cycleForClosingMonth(y, m, closingDay, dueDay);
  const [ny, nm] = shiftYm(y, m, 1);
  return cycleForClosingMonth(ny, nm, closingDay, dueDay);
}

/** Ciclo `n` faturas depois do ciclo `base` (usado nas parcelas seguintes). */
export function shiftCycle(base: Cycle, n: number, closingDay: number, dueDay: number): Cycle {
  const [cy, cm] = parts(base.closingDate);
  const [y, m] = shiftYm(cy, cm, n);
  return cycleForClosingMonth(y, m, closingDay, dueDay);
}

/** Data de competência da parcela k (1-based): mesma data da compra, k-1 meses depois (ajustada ao fim do mês). */
export function competenceDate(purchaseDate: string, k: number): string {
  const [y, m, d] = parts(purchaseDate);
  const [ty, tm] = shiftYm(y, m, k - 1);
  return ymd(ty, tm, Math.min(d, lastDay(ty, tm)));
}

export type InvoiceStatus = 'open' | 'closed' | 'partial' | 'paid' | 'overdue';

export const MIN_PAYMENT_RATE = 0.15;

/** Situação da fatura (spec §6.4). `total` e `paid` em centavos para evitar float. */
export function invoiceStatus(inv: { closingDate: string; dueDate: string; totalCents: number; paidCents: number }, today: string): InvoiceStatus {
  const remaining = inv.totalCents - inv.paidCents;
  if (today <= inv.closingDate) return 'open';
  if (inv.totalCents > 0 && remaining <= 0) return 'paid';
  if (inv.totalCents <= 0) return 'paid'; // fechada sem nada a pagar
  if (today > inv.dueDate) return 'overdue';
  return inv.paidCents > 0 ? 'partial' : 'closed';
}
