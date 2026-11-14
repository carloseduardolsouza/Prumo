import { addDays, eachDay } from '../../../shared/dates.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { DashboardModel, type PaidRow } from '../models/dashboard.model.js';
import { CardModel } from '../models/card.model.js';
import { PreferenceModel } from '../models/preference.model.js';
import { todayOf } from './context.js';
import { pendingDebtDues } from './debt-cash.js';
import { CategoryService } from './category.service.js';
import { buildBuckets, bucketIndex, resolvePeriod, sample, type PeriodKey } from './dashboard-periods.js';

const FALLBACK = '#8A9099';
type Cat = Awaited<ReturnType<typeof DashboardModel.categories>>[number];

/** Agrupa por categoria principal: lançamentos de subcategorias somam no pai (RN078). */
export function totalsByCategory(rows: Pick<PaidRow, 'categoryId' | 'paidAmount'>[], cats: Cat[]) {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const acc = new Map<string, { id: string | null; name: string; color: string; amount: ReturnType<typeof money>; children: Map<string, { name: string; amount: ReturnType<typeof money> }> }>();

  for (const r of rows) {
    const own = r.categoryId ? byId.get(r.categoryId) : undefined;
    const top = own?.parentId ? byId.get(own.parentId) ?? own : own;
    const key = top?.id ?? 'none';
    const g = acc.get(key) ?? { id: top?.id ?? null, name: top?.name ?? 'Sem categoria', color: top?.color ?? FALLBACK, amount: money(0), children: new Map() };
    g.amount = g.amount.plus(r.paidAmount.toString());
    if (own && own.id !== top?.id) {
      const c = g.children.get(own.id) ?? { name: own.name, amount: money(0) };
      c.amount = c.amount.plus(r.paidAmount.toString());
      g.children.set(own.id, c);
    }
    acc.set(key, g);
  }

  const total = [...acc.values()].reduce((s, g) => s.plus(g.amount), money(0));
  return [...acc.values()]
    .sort((a, b) => b.amount.comparedTo(a.amount))
    .map((g) => ({
      categoryId: g.id,
      name: g.name,
      color: g.color,
      amount: toMoneyString(g.amount),
      percent: total.isZero() ? 0 : Math.round(g.amount.dividedBy(total).times(1000).toNumber()) / 10,
      children: [...g.children.entries()].map(([id, c]) => ({ categoryId: id, name: c.name, amount: toMoneyString(c.amount) })).sort((a, b) => Number(b.amount) - Number(a.amount)),
    }));
}

/**
 * Compras no cartão são despesa de consumo na data de competência de cada parcela (RN012/RN022), mesmo antes de
 * a fatura ser paga; o pagamento da fatura não conta de novo (RN036). Parcelas futuras ficam de fora do realizado.
 */
export async function cardExpenseRows(userId: string, from: Date, to: Date, today: string): Promise<PaidRow[]> {
  const limit = toDate(today) < to ? toDate(today) : to;
  const items = await CardModel.installmentsInRange(userId, from, limit);
  return items.map((i) => ({ type: 'EXPENSE' as const, categoryId: i.categoryId, paidAmount: i.amount, paidDate: i.competenceDate }));
}

/** Saldo ainda a pagar das faturas com vencimento no intervalo. */
export async function invoicesRemaining(userId: string, from: Date | null, to: Date) {
  const invs = await CardModel.invoicesDueBetween(userId, from, to);
  if (!invs.length) return { amount: money(0), count: 0 };
  const totals = await CardModel.totalsOfInvoices(invs.map((i) => i.id));
  let amount = money(0), count = 0;
  for (const i of invs) {
    const t = totals.get(i.id);
    const rem = money(t?.total ?? 0).minus(t?.paid ?? 0);
    if (rem.gt(0)) { amount = amount.plus(rem); count++; }
  }
  return { amount, count };
}

export const DashboardService = {
  async get(userId: string, q: { period: PeriodKey; from?: string | undefined; to?: string | undefined }) {
    await CategoryService.ensureDefaults(userId);
    const [today, prefs] = await Promise.all([todayOf(userId), PreferenceModel.get(userId)]);
    const period = resolvePeriod(q.period, today, { firstDayOfWeek: prefs.firstDayOfWeek === 1 ? 1 : 0, from: q.from, to: q.to });
    const [from, to] = [toDate(period.from), toDate(period.to)];

    const [txRows, cardRows, cats, bal] = await Promise.all([DashboardModel.paidRows(userId, from, to), cardExpenseRows(userId, from, to, today), DashboardModel.categories(userId), DashboardModel.activeBalance(userId)]);
    const rows = [...txRows, ...cardRows];
    const incomeRows = rows.filter((r) => r.type === 'INCOME');
    const expenseRows = rows.filter((r) => r.type === 'EXPENSE');
    const sum = (rs: typeof rows) => rs.reduce((s, r) => s.plus(r.paidAmount.toString()), money(0));
    const income = sum(incomeRows);
    const expense = sum(expenseRows);

    // Barras receitas × despesas por balde (dia, semana ou mês).
    const buckets = buildBuckets(period.from, period.to, period.bucket);
    const series = buckets.map((b) => ({ label: b.label, from: b.from, to: b.to, income: money(0), expense: money(0) }));
    for (const r of rows) {
      const i = bucketIndex(buckets, fromDate(r.paidDate!));
      if (i < 0) continue;
      const s = series[i]!;
      if (r.type === 'INCOME') s.income = s.income.plus(r.paidAmount.toString());
      else s.expense = s.expense.plus(r.paidAmount.toString());
    }

    // Evolução do saldo total (carteiras ativas): abertura antes do período + movimento diário.
    let running = money((await DashboardModel.ledgerBefore(userId, from))?.toString() ?? 0);
    const deltas = new Map((await DashboardModel.ledgerDeltas(userId, from, to)).map((d): [string, ReturnType<typeof money>] => [fromDate(d.effectiveDate), money(d._sum.amount?.toString() ?? 0)]));
    const upTo = period.to > today ? today : period.to; // não projeta o futuro no saldo realizado
    const evolution = (period.from <= upTo ? eachDay(period.from, upTo) : []).map((date) => {
      running = running.plus(deltas.get(date) ?? 0);
      return { date, balance: toMoneyString(running) };
    });

    // Compromissos futuros: próximos 30 dias e atrasados (RF011).
    const horizon = addDays(today, 30);
    const [next, overdue] = await Promise.all([DashboardModel.openRows(userId, toDate(today), toDate(horizon)), DashboardModel.openRows(userId, null, toDate(addDays(today, -1)))]);
    const remaining = (rs: typeof next, type: 'INCOME' | 'EXPENSE') => rs.filter((r) => r.type === type).reduce((s, r) => s.plus(r.plannedAmount.toString()).minus(r.paidAmount.toString()), money(0));

    const debtNext = await pendingDebtDues(userId, today, horizon);
    const debtLate = (await pendingDebtDues(userId, null, addDays(today, -1)));
    const debtNextSum = debtNext.reduce((s, d) => s.plus(d.amount), money(0));
    const debtLateSum = debtLate.reduce((s, d) => s.plus(d.amount), money(0));
    const invDue = await invoicesRemaining(userId, toDate(today), toDate(horizon));
    const invOverdue = await invoicesRemaining(userId, null, toDate(addDays(today, -1)));
    return {
      period,
      balance: { total: toMoneyString((bal._sum.cachedBalance ?? 0).toString()), activeWallets: bal._count },
      summary: {
        income: toMoneyString(income),
        expense: toMoneyString(expense),
        result: toMoneyString(income.minus(expense)),
        savingsRate: income.isZero() ? null : Math.round(income.minus(expense).dividedBy(income).times(1000).toNumber()) / 10,
      },
      expensesByCategory: totalsByCategory(expenseRows, cats.filter((c) => c.type === 'EXPENSE')),
      incomeByCategory: totalsByCategory(incomeRows, cats.filter((c) => c.type === 'INCOME')),
      series: series.map((s) => ({ label: s.label, from: s.from, to: s.to, income: toMoneyString(s.income), expense: toMoneyString(s.expense) })),
      balanceEvolution: sample(evolution, 60),
      upcoming: {
        from: today,
        to: horizon,
        plannedIncome: toMoneyString(remaining(next, 'INCOME')),
        plannedExpense: toMoneyString(remaining(next, 'EXPENSE').plus(invDue.amount).plus(debtNextSum)),
        debtsDue: toMoneyString(debtNextSum),
        invoicesDue: toMoneyString(invDue.amount),
        overdueCount: overdue.length + invOverdue.count + debtLate.length,
        overdueAmount: toMoneyString(remaining(overdue, 'EXPENSE').plus(remaining(overdue, 'INCOME')).plus(invOverdue.amount).plus(debtLateSum)),
      },
      methodology:
        'Receitas e despesas consideram apenas valores efetivados na data do pagamento (pagamentos parciais contam na data do último pagamento). Transferências entre carteiras próprias e aportes não entram. Cancelados ficam de fora.',
    };
  },
};
