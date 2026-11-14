import { money, toMoneyString } from '../../../shared/money.js';
import { DashboardModel } from '../models/dashboard.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { toPublicTransfer } from '../models/transfer.model.js';
import { todayOf } from './context.js';
import { cardExpenseRows, totalsByCategory } from './dashboard.service.js';

const METHOD = 'Considera apenas valores efetivados (data do pagamento), sem transferências entre carteiras próprias nem aportes de investimento.';

export const ReportService = {
  /** Receitas ou despesas por categoria (com subcategorias) no período. */
  async byCategory(userId: string, type: 'INCOME' | 'EXPENSE', from: string, to: string) {
    const today = await todayOf(userId);
    const [tx, card, cats] = await Promise.all([DashboardModel.paidRows(userId, toDate(from), toDate(to)), type === 'EXPENSE' ? cardExpenseRows(userId, toDate(from), toDate(to), today) : Promise.resolve([]), DashboardModel.categories(userId)]);
    const rows = [...tx, ...card];
    const items = totalsByCategory(rows.filter((r) => r.type === type), cats.filter((c) => c.type === type));
    const total = items.reduce((s, i) => s.plus(i.amount), money(0));
    return { type, period: { from, to }, total: toMoneyString(total), items, methodology: METHOD };
  },

  /** Resultado mês a mês de um ano (receitas, despesas, resultado e taxa de poupança). */
  async monthlyResult(userId: string, year?: number) {
    const y = year ?? Number((await todayOf(userId)).slice(0, 4));
    const today = await todayOf(userId);
    const rows = [...(await DashboardModel.paidRows(userId, toDate(`${y}-01-01`), toDate(`${y}-12-31`))), ...(await cardExpenseRows(userId, toDate(`${y}-01-01`), toDate(`${y}-12-31`), today))];
    const months = Array.from({ length: 12 }, (_, i) => ({ month: `${y}-${String(i + 1).padStart(2, '0')}`, income: money(0), expense: money(0) }));
    for (const r of rows) {
      const m = months[Number(fromDate(r.paidDate!).slice(5, 7)) - 1]!;
      if (r.type === 'INCOME') m.income = m.income.plus(r.paidAmount.toString());
      else m.expense = m.expense.plus(r.paidAmount.toString());
    }
    const income = months.reduce((s, m) => s.plus(m.income), money(0));
    const expense = months.reduce((s, m) => s.plus(m.expense), money(0));
    const active = months.filter((m) => !m.income.isZero() || !m.expense.isZero()).length || 1;
    return {
      year: y,
      months: months.map((m) => ({ month: m.month, income: toMoneyString(m.income), expense: toMoneyString(m.expense), result: toMoneyString(m.income.minus(m.expense)), savingsRate: m.income.isZero() ? null : Math.round(m.income.minus(m.expense).dividedBy(m.income).times(1000).toNumber()) / 10 })),
      totals: { income: toMoneyString(income), expense: toMoneyString(expense), result: toMoneyString(income.minus(expense)), averageIncome: toMoneyString(income.dividedBy(active)), averageExpense: toMoneyString(expense.dividedBy(active)) },
      methodology: `${METHOD} Médias consideram só os meses com movimento.`,
    };
  },

  /** Transferências entre carteiras próprias no período (RF: relatório de transferências). */
  async transfers(userId: string, from: string, to: string) {
    const [list, names] = await Promise.all([DashboardModel.transfers(userId, toDate(from), toDate(to)), DashboardModel.walletNames(userId)]);
    const total = list.reduce((s, t) => s.plus(t.amount.toString()), money(0));
    return {
      period: { from, to },
      total: toMoneyString(total),
      items: list.map((t) => ({ ...toPublicTransfer(t), fromWalletName: names.get(t.fromWalletId) ?? null, toWalletName: names.get(t.toWalletId) ?? null })),
      methodology: 'Transferências entre carteiras próprias não são receita nem despesa e não alteram o patrimônio.',
    };
  },
};
