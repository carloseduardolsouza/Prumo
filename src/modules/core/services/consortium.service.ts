import type { Consortium, ConsortiumInstallment } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import { conflict, notFound, unprocessable } from '../../../shared/errors.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { activeWallet, dateOrToday, todayOf } from './context.js';
import { debtCategoryId, monthlyDueDates, postDebtExpense, reverseDebtExpense } from './debt-common.js';

const M = (v: { toString(): string } | string | number) => toMoneyString(typeof v === 'object' ? v.toString() : v);

async function owned(userId: string, id: string) {
  const c = await prisma.consortium.findFirst({ where: { id, userId }, include: { items: { orderBy: { number: 'asc' } }, adjustments: { orderBy: { effectiveDate: 'desc' } }, events: { orderBy: { date: 'desc' } } } });
  if (!c) throw notFound('Consórcio');
  return c;
}
type Full = Awaited<ReturnType<typeof owned>>;

/**
 * Separa o que é dinheiro seu do que é a carta (RN054/058): total pago, valor atualizado da carta, reajuste
 * acumulado, obrigações restantes e o que foi efetivamente recebido/utilizado. A valorização da carta NUNCA
 * é saldo disponível, receita ou lucro.
 */
function summarize(c: Full) {
  const paid = c.items.filter((i) => i.status === 'PAID');
  const pending = c.items.filter((i) => i.status === 'PENDING');
  const sum = (xs: ConsortiumInstallment[], pick: (i: ConsortiumInstallment) => { toString(): string }) => xs.reduce((s, i) => s.plus(pick(i).toString()), money(0));
  const totalPaid = sum(paid, (i) => i.paidAmount).plus(sum(paid, (i) => i.lateFee));
  const letter = money(c.currentLetter.toString());
  const initial = money(c.initialLetter.toString());
  const used = c.events.filter((e) => e.kind === 'USE' || e.kind === 'RELEASE').reduce((s, e) => s.plus(e.amount?.toString() ?? 0), money(0));
  const next = pending[0];
  return {
    initialLetter: M(initial), currentLetter: M(letter),
    letterGrowthPercent: initial.isZero() ? 0 : Math.round(letter.minus(initial).dividedBy(initial).times(1000).toNumber()) / 10,
    totalPaid: M(totalPaid), paidCount: paid.length, remainingCount: pending.length, totalCount: c.items.length,
    remainingObligations: M(sum(pending, (i) => i.amount)),
    paidOverLetterPercent: letter.isZero() ? 0 : Math.round(totalPaid.dividedBy(letter).times(1000).toNumber()) / 10,
    receivedOrUsed: M(used),
    nextDue: next ? { number: next.number, dueDate: fromDate(next.dueDate), amount: M(next.amount) } : null,
    note: 'A valorização da carta não é dinheiro disponível nem lucro: só vale após a contemplação e conforme o contrato.',
  };
}

const toPublic = (c: Full) => ({
  id: c.id, name: c.name, administrator: c.administrator, groupNumber: c.groupNumber, quota: c.quota, kind: c.kind, status: c.status, installments: c.installments,
  installmentAmount: M(c.installmentAmount), contractDate: fromDate(c.contractDate), firstDueDate: fromDate(c.firstDueDate), dueDay: c.dueDay,
  adminFeeRate: c.adminFeeRate.toString(), reserveFundRate: c.reserveFundRate.toString(), insuranceFee: M(c.insuranceFee), adjustmentRule: c.adjustmentRule,
  nextAssemblyDate: c.nextAssemblyDate ? fromDate(c.nextAssemblyDate) : null, walletId: c.walletId, notes: c.notes, summary: summarize(c),
});

const detail = (c: Full) => ({
  consortium: toPublic(c),
  schedule: c.items.map((i) => ({ number: i.number, dueDate: fromDate(i.dueDate), amount: M(i.amount), status: i.status.toLowerCase(), paidAmount: M(i.paidAmount), lateFee: M(i.lateFee), paidDate: i.paidDate ? fromDate(i.paidDate) : null })),
  adjustments: c.adjustments.map((a) => ({ id: a.id, target: a.target, mode: a.mode, value: M(a.value), previous: M(a.previous), next: M(a.next), effectiveDate: fromDate(a.effectiveDate), source: a.source, note: a.note })),
  events: c.events.map((e) => ({ id: e.id, kind: e.kind, date: fromDate(e.date), modality: e.modality, amount: e.amount ? M(e.amount) : null, description: e.description })),
});

export const ConsortiumService = {
  async create(userId: string, input: any) {
    if (input.walletId) await activeWallet(userId, input.walletId);
    const today = await todayOf(userId);
    const dueDay = input.dueDay ?? Number(input.firstDueDate.slice(8, 10));
    const dates = monthlyDueDates(input.firstDueDate, dueDay, input.installments);
    const letter = input.currentLetter ?? input.initialLetter;
    const already = Math.min(input.alreadyPaid, input.installments);
    const c = await prisma.consortium.create({
      data: {
        userId, name: input.name, administrator: input.administrator ?? null, groupNumber: input.groupNumber ?? null, quota: input.quota ?? null, kind: input.kind, initialLetter: input.initialLetter, currentLetter: letter,
        installments: input.installments, installmentAmount: input.installmentAmount, contractDate: toDate(input.contractDate ?? today), firstDueDate: toDate(dates[0]!), dueDay, adminFeeRate: input.adminFeeRate ?? 0,
        reserveFundRate: input.reserveFundRate ?? 0, insuranceFee: input.insuranceFee ?? 0, adjustmentRule: input.adjustmentRule ?? null, nextAssemblyDate: input.nextAssemblyDate ? toDate(input.nextAssemblyDate) : null,
        walletId: input.walletId ?? null, notes: input.notes ?? null,
        items: { create: dates.map((d, k) => ({ userId, number: k + 1, dueDate: toDate(d), amount: input.installmentAmount, ...(k < already ? { status: 'PAID' as const, paidAmount: input.installmentAmount, paidDate: toDate(d) } : {}) })) },
      },
    });
    await AuditModel.record({ userId, action: 'consortium.create', entity: 'consortium', entityId: c.id, after: { name: c.name, letter: M(letter), installments: input.installments, alreadyPaid: already } });
    return detail(await owned(userId, c.id));
  },

  async list(userId: string) {
    const list = await prisma.consortium.findMany({ where: { userId, status: { not: 'CANCELED' } }, include: { items: { orderBy: { number: 'asc' } }, adjustments: true, events: true }, orderBy: { createdAt: 'asc' } });
    return { consortiums: list.map(toPublic) };
  },

  get: async (userId: string, id: string) => detail(await owned(userId, id)),

  async patch(userId: string, id: string, patch: { nextAssemblyDate?: string | null | undefined; notes?: string | undefined; adjustmentRule?: string | undefined; status?: 'ACTIVE' | 'CANCELED' | 'CLOSED' | undefined }) {
    await owned(userId, id);
    await prisma.consortium.update({ where: { id }, data: { ...(patch.nextAssemblyDate !== undefined ? { nextAssemblyDate: patch.nextAssemblyDate ? toDate(patch.nextAssemblyDate) : null } : {}), ...(patch.notes !== undefined ? { notes: patch.notes } : {}), ...(patch.adjustmentRule !== undefined ? { adjustmentRule: patch.adjustmentRule } : {}), ...(patch.status ? { status: patch.status } : {}) } });
    return detail(await owned(userId, id));
  },

  /** Paga uma ou mais parcelas (inclusive antecipação). Multa/juros de atraso entram à parte (RN047). */
  async pay(userId: string, id: string, input: { walletId: string; numbers: number[]; date?: string | undefined; lateFee?: string | undefined }) {
    const c = await owned(userId, id);
    const nums = [...new Set(input.numbers)];
    const targets = nums.map((n) => c.items.find((i) => i.number === n));
    if (targets.some((t) => !t)) throw notFound('Parcela');
    if (targets.some((t) => t!.status !== 'PENDING')) throw unprocessable('Há parcela que não está pendente');
    const wallet = await activeWallet(userId, input.walletId);
    const date = (await dateOrToday(userId, input.date)).toISOString().slice(0, 10);
    const cat = await debtCategoryId(userId);
    await prisma.$transaction(async (tx) => {
      for (const t of targets as ConsortiumInstallment[]) {
        const tr = await postDebtExpense(tx, { userId, walletId: wallet.id, amount: t.amount.toString(), description: `Consórcio ${c.name} ${t.number}/${c.installments}`, date, categoryId: cat });
        await tx.consortiumInstallment.update({ where: { id: t.id }, data: { status: 'PAID', paidAmount: t.amount, paidDate: toDate(date), transactionId: tr.id } });
      }
      if (input.lateFee) {
        await postDebtExpense(tx, { userId, walletId: wallet.id, amount: input.lateFee, description: `Multa e juros de atraso · consórcio ${c.name}`, date, categoryId: cat });
        await tx.consortiumInstallment.update({ where: { id: (targets[0] as ConsortiumInstallment).id }, data: { lateFee: input.lateFee } });
      }
    });
    await AuditModel.record({ userId, action: 'consortium.pay', entity: 'consortium', entityId: id, after: { numbers: nums, lateFee: input.lateFee ?? null } });
    return detail(await owned(userId, id));
  },

  async cancelPayment(userId: string, id: string, number: number) {
    const c = await owned(userId, id);
    const inst = c.items.find((i) => i.number === number);
    if (!inst) throw notFound('Parcela');
    if (inst.status !== 'PAID' || !inst.transactionId) throw unprocessable('Esta parcela não tem pagamento registrado pelo app');
    const today = await todayOf(userId);
    await prisma.$transaction(async (tx) => {
      await reverseDebtExpense(tx, inst.transactionId, today, 'Estorno de pagamento de consórcio');
      await tx.consortiumInstallment.update({ where: { id: inst.id }, data: { status: 'PENDING', paidAmount: 0, lateFee: 0, paidDate: null, transactionId: null } });
    });
    return detail(await owned(userId, id));
  },

  /** Reajuste da carta ou da parcela, em reais ou %, com vigência e origem (RN052/053). Parcelas pendentes passam a valer o novo valor. */
  async adjust(userId: string, id: string, input: { target: 'LETTER' | 'INSTALLMENT'; mode: 'AMOUNT' | 'PERCENT'; value: string; effectiveDate?: string | undefined; source: 'USER' | 'ADMINISTRATOR'; note?: string | undefined }) {
    const c = await owned(userId, id);
    const date = (await dateOrToday(userId, input.effectiveDate)).toISOString().slice(0, 10);
    const previous = money((input.target === 'LETTER' ? c.currentLetter : c.installmentAmount).toString());
    const next = input.mode === 'AMOUNT' ? previous.plus(input.value) : previous.times(money(1).plus(money(input.value).dividedBy(100)));
    if (next.lte(0)) throw unprocessable('O reajuste leva o valor a zero ou negativo');
    const nextR = money(next.toFixed(2));
    await prisma.$transaction(async (tx) => {
      await tx.consortiumAdjustment.create({ data: { userId, consortiumId: id, target: input.target, mode: input.mode, value: input.value, previous: previous.toFixed(4), next: nextR.toFixed(4), effectiveDate: toDate(date), source: input.source, note: input.note ?? null } });
      if (input.target === 'LETTER') await tx.consortium.update({ where: { id }, data: { currentLetter: nextR.toFixed(4) } });
      else {
        await tx.consortium.update({ where: { id }, data: { installmentAmount: nextR.toFixed(4) } });
        await tx.consortiumInstallment.updateMany({ where: { consortiumId: id, status: 'PENDING', dueDate: { gte: toDate(date) } }, data: { amount: nextR.toFixed(4) } });
      }
    });
    await AuditModel.record({ userId, action: 'consortium.adjust', entity: 'consortium', entityId: id, before: { value: previous.toFixed(2) }, after: { target: input.target, next: nextR.toFixed(2), source: input.source } });
    return detail(await owned(userId, id));
  },

  /** Lance, contemplação, liberação e uso da carta: eventos do usuário, sem movimentar saldo (RN055/056/058). */
  async addEvent(userId: string, id: string, input: { kind: 'BID' | 'CONTEMPLATION' | 'RELEASE' | 'USE'; date?: string | undefined; modality?: string | undefined; amount?: string | undefined; description?: string | undefined }) {
    const c = await owned(userId, id);
    if (c.status === 'CANCELED' || c.status === 'CLOSED') throw unprocessable('Consórcio encerrado');
    if ((input.kind === 'RELEASE' || input.kind === 'USE') && c.status !== 'CONTEMPLATED') throw unprocessable('Libere ou use a carta somente depois da contemplação');
    if (input.kind === 'CONTEMPLATION' && c.status === 'CONTEMPLATED') throw conflict('Este consórcio já foi contemplado');
    const date = (await dateOrToday(userId, input.date)).toISOString().slice(0, 10);
    await prisma.$transaction(async (tx) => {
      await tx.consortiumEvent.create({ data: { userId, consortiumId: id, kind: input.kind, date: toDate(date), modality: input.modality ?? null, amount: input.amount ?? null, description: input.description ?? null } });
      if (input.kind === 'CONTEMPLATION') await tx.consortium.update({ where: { id }, data: { status: 'CONTEMPLATED' } });
    });
    await AuditModel.record({ userId, action: `consortium.${input.kind.toLowerCase()}`, entity: 'consortium', entityId: id, after: { amount: input.amount ?? null, modality: input.modality ?? null } });
    return detail(await owned(userId, id));
  },
};

export type { Consortium };
