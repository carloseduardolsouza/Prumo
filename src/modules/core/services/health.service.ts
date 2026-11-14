import { prisma } from '../../../shared/database.js';
import { addDays } from '../../../shared/dates.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { DashboardModel } from '../models/dashboard.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { BudgetService } from './budget.service.js';
import { todayOf } from './context.js';
import { cardExpenseRows, invoicesRemaining } from './dashboard.service.js';
import { debtSummary } from './debt-cash.js';
import { InvestmentService, investmentPatrimony, passiveIncomeMonthly } from './investment.service.js';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const pct1 = (v: number) => Math.round(v * 10) / 10;

/** Receita e despesa médias mensais dos últimos 90 dias (despesa de cartão por competência). */
async function monthlyAverages(userId: string, today: string) {
  const from = toDate(addDays(today, -89)), to = toDate(today);
  const [paid, card] = await Promise.all([DashboardModel.paidRows(userId, from, to), cardExpenseRows(userId, from, to, today)]);
  const sum = (rows: { type: string; paidAmount: { toString(): string } }[], t: string) => rows.filter((r) => r.type === t).reduce((s, r) => s.plus(r.paidAmount.toString()), money(0));
  return { income: sum(paid, 'INCOME').dividedBy(3), expense: sum([...paid, ...card], 'EXPENSE').dividedBy(3) };
}

export const HealthService = {
  /**
   * Nota de 0 a 100 a partir de cinco pilares, usando só dados registrados nos últimos 3 meses.
   * Pilares sem dados (ex.: sem orçamentos) saem da média. É um guia: não é análise de crédito.
   */
  async score(userId: string) {
    const today = await todayOf(userId);
    const [avg, debt, bal, budgets, patrimony] = await Promise.all([monthlyAverages(userId, today), debtSummary(userId), DashboardModel.activeBalance(userId), BudgetService.list(userId), investmentPatrimony(userId)]);
    const liquid = money(bal._sum.cachedBalance?.toString() ?? 0);
    const pillars: { id: string; name: string; value: string; reference: string; score: number; ok: boolean }[] = [];

    if (!avg.income.isZero()) {
      const rate = avg.income.minus(avg.expense).dividedBy(avg.income).toNumber();
      pillars.push({ id: 'savings', name: 'Taxa de poupança', value: `${pct1(rate * 100)}%`, reference: 'ideal acima de 20%', score: clamp(rate / 0.2), ok: rate >= 0.2 });
    }
    if (debt.incomeCommittedPercent !== null) {
      const x = debt.incomeCommittedPercent;
      pillars.push({ id: 'debt', name: 'Renda comprometida com dívidas', value: `${x}%`, reference: 'ideal abaixo de 30%', score: x <= 30 ? 1 : clamp(1 - (x - 30) / 30), ok: x <= 30 });
    }
    if (!avg.expense.isZero()) {
      const months = Math.max(0, liquid.dividedBy(avg.expense).toNumber());
      pillars.push({ id: 'reserve', name: 'Reserva de emergência', value: `${pct1(months)} meses`, reference: 'meta de 6 meses de despesas', score: clamp(months / 6), ok: months >= 6 });
    }
    if (budgets.items.length) {
      const ok = budgets.items.filter((i) => i.status !== 'over').length;
      const worst = budgets.items.filter((i) => i.status === 'over').map((i) => i.name).slice(0, 2).join(' e ');
      pillars.push({ id: 'budgets', name: 'Orçamentos em dia', value: `${ok} de ${budgets.items.length}`, reference: worst ? `${worst} estourado(s)` : 'nenhum orçamento estourado', score: ok / budgets.items.length, ok: ok === budgets.items.length });
    }
    const assets = liquid.plus(patrimony);
    if (assets.gt(0) || money(debt.estimatedBalance).gt(0)) {
      const ratio = assets.lte(0) ? 1 : money(debt.estimatedBalance).dividedBy(assets).toNumber();
      pillars.push({ id: 'leverage', name: 'Dívidas sobre patrimônio', value: `${pct1(ratio * 100)}%`, reference: 'ideal abaixo de 30%', score: ratio <= 0.3 ? 1 : clamp(1 - (ratio - 0.3) / 0.3), ok: ratio <= 0.3 });
    }

    const score = pillars.length ? Math.round((pillars.reduce((s, p) => s + p.score, 0) / pillars.length) * 100) : null;
    const label = score === null ? null : score >= 80 ? 'EXCELENTE' : score >= 60 ? 'BOA' : score >= 40 ? 'REGULAR' : 'ATENÇÃO';
    const TIP: Record<string, { title: string; text: string; href: string }> = {
      savings: { title: 'Aumente a taxa de poupança', text: 'Gastar menos do que ganha é o que mais pesa na nota. Defina orçamentos para as maiores categorias.', href: '/planejamento' },
      debt: { title: 'Reduza o peso das dívidas', text: 'Simule uma amortização extra e veja quanto de juros você economiza.', href: '/dividas' },
      reserve: { title: 'Monte a reserva de emergência', text: 'Crie uma meta de 6 meses de despesas e aporte todo mês.', href: '/nova-meta' },
      budgets: { title: 'Ajuste os orçamentos estourados', text: 'Revise os limites das categorias que passaram de 100%.', href: '/planejamento' },
      leverage: { title: 'Dívidas altas perto do patrimônio', text: 'Priorize quitar as dívidas com juros mais altos.', href: '/dividas' },
    };
    const tips = [...pillars].filter((p) => !p.ok).sort((a, b) => a.score - b.score).slice(0, 3).map((p) => TIP[p.id]!);
    return {
      score, label, pillars, tips, window: { days: 90, averageIncome: toMoneyString(avg.income), averageExpense: toMoneyString(avg.expense) },
      note: 'A nota usa só os dados registrados no app (últimos 3 meses) e serve como guia. Não é análise de crédito nem consultoria. O histórico da nota ainda não é guardado.',
    };
  },

  /**
   * Patrimônio líquido = carteiras pessoais + investimentos − dívidas, sem dupla contagem: aportes saem da carteira
   * quando entram nos investimentos, metas são só reservas simbólicas e consórcios entram como informação (carta não é dinheiro livre).
   */
  async netWorth(userId: string) {
    const today = await todayOf(userId);
    const [bal, inv, debt, invoices, avg, passive] = await Promise.all([DashboardModel.activeBalance(userId), InvestmentService.overview(userId), debtSummary(userId), invoicesRemaining(userId, null, toDate('9999-12-31')), monthlyAverages(userId, today), passiveIncomeMonthly(userId)]);
    const personal = money(bal._sum.cachedBalance?.toString() ?? 0);
    const investments = money(inv.patrimony);
    const financing = money(debt.estimatedBalance), cards = invoices.amount;
    const total = personal.plus(investments).minus(financing).minus(cards);

    const months = inv.series.map((s) => s.month);
    const personalSeries = await Promise.all(months.map(async (m, i) => {
      const next = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1));
      const asOf = i === months.length - 1 ? addDays(today, 1) : fromDate(next);
      return money((await DashboardModel.ledgerBefore(userId, toDate(asOf)))?.toString() ?? 0);
    }));
    const series = months.map((m, i) => ({ month: m, personal: Number(personalSeries[i]!.toFixed(2)), investments: inv.series[i]!.value }));
    const first = series[0]!;

    const rules = await prisma.recurringRule.findMany({ where: { userId, active: true, type: 'EXPENSE' }, orderBy: { amount: 'asc' }, take: 12 });
    let rest = passive;
    const coverage = rules.map((r) => { const v = money(r.amount.toString()); const paid = rest.gt(v) ? v : rest.lt(0) ? money(0) : rest; rest = rest.minus(paid); return { name: r.description, amount: toMoneyString(v), covered: v.isZero() ? 0 : Math.round(paid.dividedBy(v).times(100).toNumber()) / 100 }; });

    return {
      total: toMoneyString(total),
      parts: { personal: toMoneyString(personal), investments: toMoneyString(investments), financings: toMoneyString(financing.negated()), cardInvoices: toMoneyString(cards.negated()) },
      consortiumObligations: debt.consortiumObligations,
      change12m: toMoneyString(personal.plus(investments).minus(first.personal).minus(first.investments)),
      series,
      freedom: { passiveMonthly: toMoneyString(passive), averageExpense: toMoneyString(avg.expense), coveragePercent: avg.expense.isZero() ? null : Math.round(passive.dividedBy(avg.expense).times(1000).toNumber()) / 10, coverage },
      note: 'Dívidas usam saldos estimados pelo app. Parcelas futuras de cartão e consórcios não entram como dívida. A variação em 12 meses considera só carteiras e investimentos.',
    };
  },
};
