import { prisma } from '../../../shared/database.js';
import { addDays } from '../../../shared/dates.js';
import { emit } from '../../../shared/events-publisher.js';
import { notFound, unprocessable } from '../../../shared/errors.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { DashboardModel } from '../models/dashboard.model.js';
import { toDate } from '../models/finance.schemas.js';
import { todayOf } from './context.js';
import { cardExpenseRows, totalsByCategory } from './dashboard.service.js';

const monthBounds = (ym: string) => ({ from: `${ym}-01`, to: new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10) });
const status = (pct: number) => (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok');

/** Despesas efetivadas do mês por categoria principal (cartão por competência; subcategorias somam no pai, RN078). */
async function spentByCategory(userId: string, ym: string, today: string) {
  const { from, to } = monthBounds(ym);
  const [paid, card, cats] = await Promise.all([DashboardModel.paidRows(userId, toDate(from), toDate(to)), cardExpenseRows(userId, toDate(from), toDate(to), today), DashboardModel.categories(userId)]);
  const rows = [...paid, ...card].filter((r) => r.type === 'EXPENSE');
  return new Map(totalsByCategory(rows, cats.filter((c) => c.type === 'EXPENSE')).map((c) => [c.categoryId ?? 'none', c.amount]));
}

export const BudgetService = {
  async list(userId: string, month?: string) {
    const today = await todayOf(userId);
    const ym = month ?? today.slice(0, 7);
    const [budgets, cats, spent] = await Promise.all([prisma.budget.findMany({ where: { userId } }), DashboardModel.categories(userId), spentByCategory(userId, ym, today)]);
    const byId = new Map(cats.map((c) => [c.id, c]));
    const items = budgets.filter((b) => byId.has(b.categoryId)).map((b) => {
      const c = byId.get(b.categoryId)!;
      const s = money(spent.get(b.categoryId) ?? 0), limit = money(b.amount.toString());
      const percent = limit.isZero() ? 0 : Math.round(s.dividedBy(limit).times(1000).toNumber()) / 10;
      return { categoryId: b.categoryId, name: c.name, color: c.color ?? '#8A9099', limit: toMoneyString(limit), spent: toMoneyString(s), remaining: toMoneyString(limit.minus(s)), percent, status: status(percent) as 'ok' | 'warn' | 'over' };
    }).sort((a, b) => b.percent - a.percent);
    const limit = items.reduce((s, i) => s.plus(i.limit), money(0)), sp = items.reduce((s, i) => s.plus(i.spent), money(0));
    const { to } = monthBounds(ym);
    const open = ym === today.slice(0, 7) ? await DashboardModel.openRows(userId, toDate(today), toDate(to)) : [];
    const planned = open.filter((r) => r.type === 'EXPENSE').reduce((s, r) => s.plus(r.plannedAmount.toString()).minus(r.paidAmount.toString()), money(0));
    return {
      month: ym, items, total: { limit: toMoneyString(limit), spent: toMoneyString(sp), percent: limit.isZero() ? 0 : Math.round(sp.dividedBy(limit).times(1000).toNumber()) / 10 },
      plannedUntilEnd: toMoneyString(planned),
      note: 'O realizado inclui compras no cartão pela data de cada parcela. Valores previstos ficam separados do realizado.',
    };
  },

  async set(userId: string, categoryId: string, amount: string) {
    const c = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!c) throw notFound('Categoria');
    if (c.type !== 'EXPENSE' || c.parentId) throw unprocessable('O orçamento vale para categorias principais de despesa');
    await prisma.budget.upsert({ where: { userId_categoryId: { userId, categoryId } }, update: { amount }, create: { userId, categoryId, amount } });
    return BudgetService.list(userId);
  },

  async remove(userId: string, categoryId: string) {
    if (!(await prisma.budget.deleteMany({ where: { userId, categoryId } })).count) throw notFound('Orçamento');
    return BudgetService.list(userId);
  },

  /**
   * "Quanto posso gastar hoje": o que sobra dos orçamentos do mês (já descontadas as contas previstas até o fim do mês)
   * dividido pelos dias restantes; o que não foi gasto hoje vai para os dias seguintes.
   */
  async spendable(userId: string) {
    const today = await todayOf(userId);
    const b = await BudgetService.list(userId);
    if (!b.items.length) return { hasBudget: false as const };
    const { to } = monthBounds(today.slice(0, 7));
    const daysLeft = Number(to.slice(8)) - Number(today.slice(8)) + 1;
    const [paid, card] = await Promise.all([DashboardModel.paidRows(userId, toDate(addDays(today, -6)), toDate(today)), cardExpenseRows(userId, toDate(addDays(today, -6)), toDate(today), today)]);
    const perDay = new Map<string, ReturnType<typeof money>>();
    for (const r of [...paid, ...card].filter((x) => x.type === 'EXPENSE')) {
      const d = r.paidDate!.toISOString().slice(0, 10);
      perDay.set(d, (perDay.get(d) ?? money(0)).plus(r.paidAmount.toString()));
    }
    const spentToday = perDay.get(today) ?? money(0);
    const free = money(b.total.limit).minus(b.total.spent).minus(b.plannedUntilEnd);
    const dailyLimit = free.plus(spentToday).dividedBy(daysLeft);
    const avail = dailyLimit.minus(spentToday);
    return {
      hasBudget: true as const, today, daysLeft, free: toMoneyString(free), dailyLimit: toMoneyString(dailyLimit.lt(0) ? 0 : dailyLimit),
      availableToday: toMoneyString(avail.lt(0) ? 0 : avail), spentToday: toMoneyString(spentToday),
      week: Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i - 6); return { date: d, spent: toMoneyString(perDay.get(d) ?? 0) }; }),
    };
  },
};

/** Avisos de orçamento em 80% e 100% (um por nível por mês); usado pelo job de lembretes. */
export async function budgetAlerts(userId: string): Promise<number> {
  const b = await BudgetService.list(userId);
  let n = 0;
  for (const i of b.items) {
    const level = i.percent >= 100 ? 100 : i.percent >= 80 ? 80 : 0;
    if (!level) continue;
    await emit('budget.threshold', userId, `budget.threshold__${i.categoryId}__${b.month}__${level}`, { category: i.name, percent: level, spent: i.spent, limit: i.limit });
    n++;
  }
  return n;
}
