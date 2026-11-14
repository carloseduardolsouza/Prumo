import { prisma } from '../../../shared/database.js';
import { emit } from '../../../shared/events-publisher.js';
import { notFound, unprocessable } from '../../../shared/errors.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { todayOf } from './context.js';
import { InvestmentService, passiveIncomeMonthly } from './investment.service.js';

type GoalRow = Awaited<ReturnType<typeof prisma.goal.findFirstOrThrow>>;

const monthsBetween = (from: string, to: string) => Math.max(1, (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + (Number(to.slice(8)) > Number(from.slice(8)) ? 1 : 0));

/** Metas de poupança acumulam aportes simbólicos (não movem dinheiro); a meta de liberdade mede a renda passiva mensal já alcançada. */
async function dto(g: GoalRow, saved: ReturnType<typeof money>, today: string) {
  const target = money(g.targetAmount.toString());
  const percent = target.isZero() ? 0 : Math.round(saved.dividedBy(target).times(1000).toNumber()) / 10;
  const date = g.targetDate ? fromDate(g.targetDate) : null;
  const left = target.minus(saved);
  return {
    id: g.id, name: g.name, kind: g.kind as 'SAVING' | 'FREEDOM', color: g.color, target: toMoneyString(target), saved: toMoneyString(saved), percent, status: g.status as 'ACTIVE' | 'REACHED' | 'CANCELED',
    targetDate: date, monthsLeft: date && date > today ? monthsBetween(today, date) : null,
    monthlyNeeded: date && date > today && left.gt(0) && g.kind === 'SAVING' ? toMoneyString(left.dividedBy(monthsBetween(today, date))) : null,
  };
}

async function owned(userId: string, id: string) {
  const g = await prisma.goal.findFirst({ where: { id, userId, status: { not: 'CANCELED' } } });
  if (!g) throw notFound('Meta');
  return g;
}

const savedOf = async (g: GoalRow, userId: string) =>
  g.kind === 'FREEDOM' ? passiveIncomeMonthly(userId) : money((await prisma.goalContribution.aggregate({ where: { goalId: g.id, canceledAt: null }, _sum: { amount: true } }))._sum.amount?.toString() ?? 0);

export const GoalService = {
  async list(userId: string) {
    const today = await todayOf(userId);
    const goals = await prisma.goal.findMany({ where: { userId, status: { not: 'CANCELED' } }, orderBy: { createdAt: 'asc' } });
    return { goals: await Promise.all(goals.map(async (g) => dto(g, await savedOf(g, userId), today))), note: 'Metas guardam valores como reserva simbólica: o dinheiro continua nas suas carteiras e não é contado duas vezes.' };
  },

  async create(userId: string, input: { name: string; kind: 'SAVING' | 'FREEDOM'; targetAmount: string; targetDate?: string | undefined; initialAmount?: string | undefined; color?: string | undefined }) {
    const today = await todayOf(userId);
    if (input.targetDate && input.targetDate <= today) throw unprocessable('O prazo precisa estar no futuro');
    const g = await prisma.goal.create({ data: { userId, name: input.name, kind: input.kind, targetAmount: input.targetAmount, targetDate: input.targetDate ? toDate(input.targetDate) : null, color: input.color ?? null } });
    if (input.initialAmount && input.kind === 'SAVING') await prisma.goalContribution.create({ data: { userId, goalId: g.id, amount: input.initialAmount, date: toDate(today), note: 'Valor inicial' } });
    await AuditModel.record({ userId, action: 'goal.create', entity: 'goal', entityId: g.id, after: { name: g.name, target: input.targetAmount } });
    return dto(g, await savedOf(g, userId), today);
  },

  async get(userId: string, id: string) {
    const g = await owned(userId, id);
    const today = await todayOf(userId);
    const cs = await prisma.goalContribution.findMany({ where: { goalId: id, canceledAt: null }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 50 });
    return { goal: await dto(g, await savedOf(g, userId), today), contributions: cs.map((c) => ({ id: c.id, amount: toMoneyString(c.amount.toString()), date: fromDate(c.date), note: c.note })) };
  },

  async patch(userId: string, id: string, p: { name?: string | undefined; targetAmount?: string | undefined; targetDate?: string | null | undefined; color?: string | undefined; status?: 'CANCELED' | undefined }) {
    await owned(userId, id);
    const g = await prisma.goal.update({ where: { id }, data: { ...(p.name ? { name: p.name } : {}), ...(p.targetAmount ? { targetAmount: p.targetAmount } : {}), ...(p.targetDate !== undefined ? { targetDate: p.targetDate ? toDate(p.targetDate) : null } : {}), ...(p.color ? { color: p.color } : {}), ...(p.status ? { status: p.status } : {}) } });
    await AuditModel.record({ userId, action: p.status ? 'goal.cancel' : 'goal.update', entity: 'goal', entityId: id });
    return dto(g, await savedOf(g, userId), await todayOf(userId));
  },

  /** Aporte (positivo) ou retirada (negativo) da reserva da meta. Ao chegar no valor, a meta é concluída e o usuário é avisado. */
  async contribute(userId: string, id: string, input: { amount: string; date?: string | undefined; note?: string | undefined }) {
    const g = await owned(userId, id);
    if (g.kind === 'FREEDOM') throw unprocessable('A meta de liberdade financeira acompanha a renda passiva e não recebe aportes');
    const saved = await savedOf(g, userId);
    if (saved.plus(input.amount).lt(0)) throw unprocessable('A retirada é maior que o valor guardado na meta');
    const today = await todayOf(userId);
    await prisma.goalContribution.create({ data: { userId, goalId: id, amount: input.amount, date: toDate(input.date ?? today), note: input.note ?? null } });
    return GoalService.settle(userId, id);
  },

  async removeContribution(userId: string, id: string, contributionId: string) {
    const g = await owned(userId, id);
    const c = await prisma.goalContribution.findFirst({ where: { id: contributionId, goalId: id, canceledAt: null } });
    if (!c) throw notFound('Aporte da meta');
    if ((await savedOf(g, userId)).minus(c.amount.toString()).lt(0)) throw unprocessable('Cancelar esse aporte deixaria o saldo da meta negativo');
    await prisma.goalContribution.update({ where: { id: contributionId }, data: { canceledAt: new Date() } });
    return GoalService.settle(userId, id);
  },

  async settle(userId: string, id: string) {
    const g = await owned(userId, id);
    const saved = await savedOf(g, userId);
    const reached = saved.gte(g.targetAmount.toString());
    let row = g;
    if (reached && g.status === 'ACTIVE') {
      row = await prisma.goal.update({ where: { id }, data: { status: 'REACHED', reachedAt: new Date() } });
      await emit('goal.reached', userId, `goal.reached__${id}`, { goal: g.name });
    } else if (!reached && g.status === 'REACHED') row = await prisma.goal.update({ where: { id }, data: { status: 'ACTIVE', reachedAt: null } });
    return GoalService.get(userId, row.id);
  },
};

// ───────── Aporte automático: regra mensal que o usuário confirma; nada move dinheiro sozinho ─────────
export const AutoInvestService = {
  async list(userId: string) {
    const today = await todayOf(userId);
    const [rules, wallets, brokerages] = await Promise.all([prisma.autoInvestRule.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }), prisma.wallet.findMany({ where: { userId }, select: { id: true, name: true } }), prisma.brokerage.findMany({ where: { userId }, select: { id: true, name: true } })]);
    const wn = new Map(wallets.map((w) => [w.id, w.name])), bn = new Map(brokerages.map((b) => [b.id, b.name]));
    return {
      rules: rules.map((r) => ({
        id: r.id, walletId: r.walletId, wallet: wn.get(r.walletId) ?? '', brokerageId: r.brokerageId, brokerage: bn.get(r.brokerageId) ?? '', amount: toMoneyString(r.amount.toString()), dayOfMonth: r.dayOfMonth, active: r.active, lastRunMonth: r.lastRunMonth,
        due: r.active && Number(today.slice(8)) >= r.dayOfMonth && r.lastRunMonth !== today.slice(0, 7),
      })),
      note: 'O app só lembra e registra a transferência quando você confirma. Nada é movimentado no banco sem a sua ação.',
    };
  },

  async create(userId: string, input: { walletId: string; brokerageId: string; amount: string; dayOfMonth: number }) {
    if (!(await prisma.wallet.findFirst({ where: { id: input.walletId, userId, archivedAt: null } }))) throw notFound('Carteira');
    if (!(await prisma.brokerage.findFirst({ where: { id: input.brokerageId, userId, archivedAt: null } }))) throw notFound('Instituição');
    await prisma.autoInvestRule.create({ data: { userId, ...input } });
    return AutoInvestService.list(userId);
  },

  async patch(userId: string, id: string, p: { active?: boolean | undefined; amount?: string | undefined; dayOfMonth?: number | undefined }) {
    const n = await prisma.autoInvestRule.updateMany({ where: { id, userId }, data: { ...(p.active !== undefined ? { active: p.active } : {}), ...(p.amount ? { amount: p.amount } : {}), ...(p.dayOfMonth ? { dayOfMonth: p.dayOfMonth } : {}) } });
    if (!n.count) throw notFound('Regra');
    return AutoInvestService.list(userId);
  },

  async remove(userId: string, id: string) {
    if (!(await prisma.autoInvestRule.deleteMany({ where: { id, userId } })).count) throw notFound('Regra');
    return AutoInvestService.list(userId);
  },

  /** Confirma o aporte do mês: sai da carteira (transferência, não despesa) e entra na instituição. Uma vez por mês. */
  async confirm(userId: string, id: string) {
    const r = await prisma.autoInvestRule.findFirst({ where: { id, userId } });
    if (!r) throw notFound('Regra');
    const month = (await todayOf(userId)).slice(0, 7);
    if (r.lastRunMonth === month) throw unprocessable('O aporte deste mês já foi confirmado');
    await InvestmentService.addOperation(userId, { kind: 'CONTRIBUTION', brokerageId: r.brokerageId, walletId: r.walletId, amount: r.amount.toString(), fees: '0', note: 'Aporte automático confirmado' });
    await prisma.autoInvestRule.update({ where: { id }, data: { lastRunMonth: month } });
    return AutoInvestService.list(userId);
  },
};
