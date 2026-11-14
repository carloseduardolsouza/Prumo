import { Decimal } from 'decimal.js';
import { money, round2 } from '../../../shared/money.js';

export type System = 'PRICE' | 'SAC';

export interface ScheduleRow {
  number: number;
  principal: Decimal;
  interest: Decimal;
  /** principal + juros (sem seguros/tarifas, que são somados à parte). */
  payment: Decimal;
  balanceAfter: Decimal;
}

/** Parcela fixa da Price: P·i / (1 − (1+i)^−n). Com taxa zero, divide igualmente. */
export function pricePayment(principal: Decimal.Value, monthlyRate: Decimal.Value, n: number): Decimal {
  const P = money(principal), i = money(monthlyRate);
  if (n < 1) throw new RangeError('n deve ser >= 1');
  if (i.isZero()) return round2(P.dividedBy(n));
  return round2(P.times(i).dividedBy(money(1).minus(money(1).plus(i).pow(-n))));
}

/**
 * Cronograma completo. Price: parcela fixa, juros decrescentes. SAC: amortização fixa, parcela decrescente.
 * Os centavos são ajustados na última parcela para o principal somar EXATAMENTE o valor financiado.
 */
export function buildSchedule(opts: { principal: Decimal.Value; monthlyRate: Decimal.Value; n: number; system: System }): ScheduleRow[] {
  const i = money(opts.monthlyRate);
  let balance = round2(opts.principal);
  const rows: ScheduleRow[] = [];
  const pmt = opts.system === 'PRICE' ? pricePayment(balance, i, opts.n) : null;
  const amort = opts.system === 'SAC' ? round2(balance.dividedBy(opts.n)) : null;
  for (let k = 1; k <= opts.n; k++) {
    const interest = round2(balance.times(i));
    let principal = opts.system === 'PRICE' ? pmt!.minus(interest) : amort!;
    if (k === opts.n || principal.gt(balance)) principal = balance; // última parcela zera o saldo
    balance = balance.minus(principal);
    rows.push({ number: k, principal, interest, payment: principal.plus(interest), balanceAfter: balance });
  }
  return rows;
}

/** Cronograma com parcela fixa até quitar (usado para "amortizar e manter a parcela"). */
export function scheduleFixedPayment(balance: Decimal.Value, monthlyRate: Decimal.Value, payment: Decimal.Value, maxTerms = 1200): ScheduleRow[] {
  const i = money(monthlyRate), pmt = round2(payment);
  let bal = round2(balance);
  const rows: ScheduleRow[] = [];
  if (!i.isZero() && pmt.lte(round2(bal.times(i)))) throw new RangeError('A parcela não cobre os juros: o saldo nunca zera');
  for (let k = 1; bal.gt(0) && k <= maxTerms; k++) {
    const interest = round2(bal.times(i));
    let principal = pmt.minus(interest);
    if (principal.gte(bal)) principal = bal;
    bal = bal.minus(principal);
    rows.push({ number: k, principal, interest, payment: principal.plus(interest), balanceAfter: bal });
  }
  return rows;
}

export const totalOf = (rows: ScheduleRow[]) => rows.reduce((s, r) => s.plus(r.payment), money(0));
export const interestOf = (rows: ScheduleRow[]) => rows.reduce((s, r) => s.plus(r.interest), money(0));

export type ExtraMode = 'REDUCE_TERM' | 'REDUCE_INSTALLMENT';

/**
 * Amortização extraordinária sobre o saldo restante. REDUCE_TERM mantém a parcela (termina antes);
 * REDUCE_INSTALLMENT mantém o prazo (parcela menor). Devolve o novo cronograma e a economia (RN046).
 */
export function simulateExtra(opts: { balance: Decimal.Value; monthlyRate: Decimal.Value; system: System; remainingTerms: number; currentPayment: Decimal.Value; extra: Decimal.Value; mode: ExtraMode }) {
  const bal = round2(opts.balance), extra = round2(opts.extra);
  if (extra.lte(0) || extra.gte(bal)) throw new RangeError('A amortização precisa ser maior que zero e menor que o saldo (para quitar use a quitação)');
  const oldRows = opts.system === 'PRICE' ? scheduleFixedPayment(bal, opts.monthlyRate, opts.currentPayment) : buildSchedule({ principal: bal, monthlyRate: opts.monthlyRate, n: opts.remainingTerms, system: 'SAC' });
  const newBal = bal.minus(extra);
  let newRows: ScheduleRow[];
  if (opts.mode === 'REDUCE_TERM') {
    newRows = opts.system === 'PRICE'
      ? scheduleFixedPayment(newBal, opts.monthlyRate, opts.currentPayment)
      : buildSchedule({ principal: newBal, monthlyRate: opts.monthlyRate, n: Math.max(1, Math.ceil(newBal.dividedBy(round2(bal.dividedBy(opts.remainingTerms))).toNumber())), system: 'SAC' });
  } else {
    newRows = buildSchedule({ principal: newBal, monthlyRate: opts.monthlyRate, n: opts.remainingTerms, system: opts.system });
  }
  return {
    oldTerms: oldRows.length, newTerms: newRows.length, monthsSaved: oldRows.length - newRows.length,
    interestSaved: interestOf(oldRows).minus(interestOf(newRows)), newPayment: newRows[0]?.payment ?? money(0), rows: newRows,
  };
}
