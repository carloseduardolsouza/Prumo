import type { RecurringRule } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import { addDays } from '../../../shared/dates.js';
import { notFound, unprocessable } from '../../../shared/errors.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { CategoryModel } from '../models/category.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import type { RuleCreate, RuleUpdate } from '../models/recurring.schemas.js';
import { activeWallet, todayOf } from './context.js';
import { monthlyFactor, occurrencesBetween, type RuleSpec } from './recurrence.js';
import { TransactionService } from './transaction.service.js';

const HORIZON_DAYS = 90;

const spec = (r: RecurringRule): RuleSpec => ({
  frequency: r.frequency, intervalDays: r.intervalDays, dayOfMonth: r.dayOfMonth, startDate: fromDate(r.startDate), endDate: r.endDate ? fromDate(r.endDate) : null, maxOccurrences: r.maxOccurrences,
});

const toPublic = (r: RecurringRule, extra: { next?: string | null; walletName?: string | null; categoryName?: string | null; lastPaid?: string | null } = {}) => ({
  id: r.id, type: r.type, description: r.description, categoryId: r.categoryId, categoryName: extra.categoryName ?? null, walletId: r.walletId, walletName: extra.walletName ?? null,
  amount: toMoneyString(r.amount.toString()), monthlyAmount: toMoneyString(money(r.amount.toString()).times(monthlyFactor(r))), frequency: r.frequency, intervalDays: r.intervalDays, dayOfMonth: r.dayOfMonth,
  startDate: fromDate(r.startDate), endDate: r.endDate ? fromDate(r.endDate) : null, maxOccurrences: r.maxOccurrences, isSubscription: r.isSubscription, active: r.active, notes: r.notes,
  nextDate: extra.next ?? null,
});

async function owned(userId: string, id: string) {
  const r = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!r) throw notFound('Recorrência');
  return r;
}

export const RecurringService = {
  /**
   * Gera as ocorrências previstas até o horizonte. NUNCA marca como paga (RN023) e nunca repete uma
   * ocorrência já gerada (unique regra+data, RN025): pode rodar quantas vezes quiser.
   */
  async materialize(userId: string, ruleId?: string, horizonDays = HORIZON_DAYS): Promise<number> {
    const today = await todayOf(userId);
    const to = addDays(today, horizonDays);
    const rules = await prisma.recurringRule.findMany({ where: { userId, active: true, ...(ruleId ? { id: ruleId } : {}) } });
    let created = 0;
    for (const r of rules) {
      const dates = occurrencesBetween(spec(r), fromDate(r.startDate), to);
      if (!dates.length) continue;
      const res = await prisma.financialTransaction.createMany({
        skipDuplicates: true,
        data: dates.map((d) => ({
          userId, type: r.type, status: 'PLANNED' as const, description: r.description, categoryId: r.categoryId, walletId: r.walletId, plannedAmount: r.amount, competenceDate: toDate(d), dueDate: toDate(d),
          recurrenceRuleId: r.id, occurrenceDate: toDate(d),
        })),
      });
      created += res.count;
    }
    return created;
  },

  async create(userId: string, input: RuleCreate) {
    if (input.categoryId) {
      const c = await CategoryModel.find(userId, input.categoryId);
      if (!c || c.archivedAt) throw notFound('Categoria');
      if (c.type !== input.type) throw unprocessable('A categoria precisa ser do mesmo tipo (receita ou despesa)');
    }
    if (input.walletId) await activeWallet(userId, input.walletId);
    const today = await todayOf(userId);
    if (input.startDate < addDays(today, -366)) throw unprocessable('A data inicial não pode ser anterior a 1 ano');

    const rule = await prisma.recurringRule.create({
      data: {
        userId, type: input.type, description: input.description, categoryId: input.categoryId ?? null, walletId: input.walletId ?? null, amount: input.amount, frequency: input.frequency,
        intervalDays: input.intervalDays ?? null, dayOfMonth: input.dayOfMonth ?? null, startDate: toDate(input.startDate), endDate: input.endDate ? toDate(input.endDate) : null,
        maxOccurrences: input.maxOccurrences ?? null, isSubscription: input.isSubscription, notes: input.notes ?? null,
      },
    });
    await this.materialize(userId, rule.id);
    if (input.settleFirst) {
      const first = await prisma.financialTransaction.findFirst({ where: { recurrenceRuleId: rule.id }, orderBy: { occurrenceDate: 'asc' } });
      if (first) await TransactionService.settle(userId, first.id, { walletId: input.walletId!, date: input.startDate });
    }
    await AuditModel.record({ userId, action: 'recurring.create', entity: 'recurring_rule', entityId: rule.id, after: { description: rule.description, amount: input.amount, frequency: input.frequency } });
    return this.get(userId, rule.id);
  },

  async get(userId: string, id: string) {
    const r = await owned(userId, id);
    const [next, wallet, cat] = await Promise.all([
      prisma.financialTransaction.findFirst({ where: { recurrenceRuleId: id, status: { in: ['PLANNED', 'PARTIAL'] } }, orderBy: { occurrenceDate: 'asc' }, select: { occurrenceDate: true } }),
      r.walletId ? prisma.wallet.findUnique({ where: { id: r.walletId }, select: { name: true } }) : null,
      r.categoryId ? prisma.category.findUnique({ where: { id: r.categoryId }, select: { name: true } }) : null,
    ]);
    return toPublic(r, { next: next?.occurrenceDate ? fromDate(next.occurrenceDate) : null, walletName: wallet?.name ?? null, categoryName: cat?.name ?? null });
  },

  /** Lista as regras e o resumo do que se repete (spec: contas fixas × assinaturas, total por mês, alertas). */
  async summary(userId: string) {
    await this.materialize(userId);
    const rules = await prisma.recurringRule.findMany({ where: { userId, active: true }, orderBy: { description: 'asc' } });
    const [wallets, cats, nexts] = await Promise.all([
      prisma.wallet.findMany({ where: { userId }, select: { id: true, name: true } }),
      prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }),
      prisma.financialTransaction.groupBy({ by: ['recurrenceRuleId'], where: { userId, recurrenceRuleId: { in: rules.map((r) => r.id) }, status: { in: ['PLANNED', 'PARTIAL'] } }, _min: { occurrenceDate: true } }),
    ]);
    const wn = new Map(wallets.map((w) => [w.id, w.name])), cn = new Map(cats.map((c) => [c.id, c.name])), nx = new Map(nexts.map((n) => [n.recurrenceRuleId, n._min.occurrenceDate]));
    const items = rules.map((r) => toPublic(r, { next: nx.get(r.id) ? fromDate(nx.get(r.id)!) : null, walletName: r.walletId ? wn.get(r.walletId) : null, categoryName: r.categoryId ? cn.get(r.categoryId) : null }));

    const expenses = items.filter((i) => i.type === 'EXPENSE');
    const fixed = expenses.filter((i) => !i.isSubscription);
    const subs = expenses.filter((i) => i.isSubscription);
    const sum = (xs: typeof items) => toMoneyString(xs.reduce((s, i) => s.plus(i.monthlyAmount), money(0)));

    // Alertas: assinatura que ficou mais cara entre as duas últimas ocorrências efetivadas.
    const alerts: { kind: 'price_increase'; ruleId: string; description: string; from: string; to: string; yearlyImpact: string }[] = [];
    for (const s of subs) {
      const last2 = await prisma.financialTransaction.findMany({ where: { recurrenceRuleId: s.id, status: 'SETTLED' }, orderBy: [{ paidDate: 'desc' }, { updatedAt: 'desc' }], take: 2, select: { paidAmount: true } });
      if (last2.length === 2 && last2[0]!.paidAmount.gt(last2[1]!.paidAmount)) {
        const diff = money(last2[0]!.paidAmount.toString()).minus(last2[1]!.paidAmount.toString());
        alerts.push({ kind: 'price_increase', ruleId: s.id, description: s.description, from: toMoneyString(last2[1]!.paidAmount.toString()), to: toMoneyString(last2[0]!.paidAmount.toString()), yearlyImpact: toMoneyString(diff.times(12)) });
      }
    }
    return {
      monthlyTotal: toMoneyString(money(sum(fixed)).plus(sum(subs))),
      fixed: { total: sum(fixed), items: fixed },
      subscriptions: { total: sum(subs), items: subs },
      income: { total: sum(items.filter((i) => i.type === 'INCOME')), items: items.filter((i) => i.type === 'INCOME') },
      alerts,
      note: 'Totais mensais são equivalentes aproximados para frequências diferentes de mensal.',
    };
  },

  /** Edita a regra. As ocorrências futuras são regeradas; com future_and_open também as vencidas ainda abertas (RN024). */
  async update(userId: string, id: string, input: RuleUpdate) {
    const r = await owned(userId, id);
    if (input.categoryId) {
      const c = await CategoryModel.find(userId, input.categoryId);
      if (!c || c.archivedAt || c.type !== r.type) throw unprocessable('Categoria inválida para esta recorrência');
    }
    if (input.walletId) await activeWallet(userId, input.walletId);
    const today = await todayOf(userId);
    const data = {
      ...(input.description ? { description: input.description } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.walletId !== undefined ? { walletId: input.walletId } : {}),
      ...(input.amount ? { amount: input.amount } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ? toDate(input.endDate) : null } : {}),
      ...(input.isSubscription !== undefined ? { isSubscription: input.isSubscription } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    };
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.recurringRule.update({ where: { id }, data });
      const open = { recurrenceRuleId: id, status: 'PLANNED' as const, paidAmount: 0 };
      await tx.financialTransaction.deleteMany({ where: { ...open, occurrenceDate: { gt: toDate(today) } } }); // regeradas abaixo com os novos valores
      if (input.scope === 'future_and_open') {
        await tx.financialTransaction.updateMany({
          where: { ...open, occurrenceDate: { lte: toDate(today) } },
          data: { ...(input.description ? { description: input.description } : {}), ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}), ...(input.walletId !== undefined ? { walletId: input.walletId } : {}), ...(input.amount ? { plannedAmount: input.amount } : {}) },
        });
      }
      return u;
    });
    await this.materialize(userId, id);
    await AuditModel.record({ userId, action: 'recurring.update', entity: 'recurring_rule', entityId: id, before: { description: r.description, amount: r.amount.toString() }, after: { description: updated.description, amount: updated.amount.toString(), scope: input.scope } });
    return this.get(userId, id);
  },

  /** Encerra a recorrência: nada mais é gerado e as ocorrências futuras ainda abertas saem do planejamento. */
  async stop(userId: string, id: string) {
    const r = await owned(userId, id);
    const today = await todayOf(userId);
    await prisma.$transaction([
      prisma.recurringRule.update({ where: { id }, data: { active: false, endDate: toDate(today) } }),
      prisma.financialTransaction.deleteMany({ where: { recurrenceRuleId: id, status: 'PLANNED', paidAmount: 0, occurrenceDate: { gt: toDate(today) } } }),
    ]);
    await AuditModel.record({ userId, action: 'recurring.stop', entity: 'recurring_rule', entityId: id, before: { description: r.description } });
    return { stopped: true };
  },
};
