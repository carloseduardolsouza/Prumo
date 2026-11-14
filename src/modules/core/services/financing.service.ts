import type { Financing, FinancingInstallment } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import { badRequest, conflict, notFound, unprocessable } from '../../../shared/errors.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { activeWallet, dateOrToday, todayOf } from './context.js';
import { buildSchedule, simulateExtra, type ExtraMode } from './amortization.js';
import { debtCategoryId, monthlyDueDates, postDebtExpense, reverseDebtExpense } from './debt-common.js';

const M = (v: { toString(): string } | string | number) => toMoneyString(typeof v === 'object' ? v.toString() : v);

const instDto = (i: FinancingInstallment, n: number) => ({
  number: i.number, of: n, dueDate: fromDate(i.dueDate), principal: M(i.principal), interest: M(i.interest), fees: M(i.fees), total: M(i.total),
  status: i.status.toLowerCase(), paidAmount: M(i.paidAmount), lateFee: M(i.lateFee), paidDate: i.paidDate ? fromDate(i.paidDate) : null,
});

async function owned(userId: string, id: string) {
  const f = await prisma.financing.findFirst({ where: { id, userId }, include: { items: { orderBy: { number: 'asc' } } } });
  if (!f) throw notFound('Contrato');
  return f;
}
type Full = Awaited<ReturnType<typeof owned>>;

/** Estimativa do saldo devedor = principal das parcelas ainda pendentes. Nunca é apresentada como saldo oficial (RN044/049). */
function summarize(f: Full, today: string) {
  const pending = f.items.filter((i) => i.status === 'PENDING');
  const paid = f.items.filter((i) => i.status === 'PAID');
  const sum = (xs: FinancingInstallment[], pick: (i: FinancingInstallment) => { toString(): string }) => xs.reduce((s, i) => s.plus(pick(i).toString()), money(0));
  const balance = sum(pending, (i) => i.principal);
  const next = pending[0];
  const official = f.officialBalance ? money(f.officialBalance.toString()) : null;
  return {
    estimatedBalance: toMoneyString(balance),
    isEstimate: true,
    estimateNote: 'Saldo estimado pelo app com base no cronograma. O saldo oficial é o informado pelo credor.',
    officialBalance: official ? toMoneyString(official) : null,
    officialBalanceAt: f.officialBalanceAt ? fromDate(f.officialBalanceAt) : null,
    divergence: official ? toMoneyString(official.minus(balance)) : null,
    totalContracted: toMoneyString(f.financedAmount.toString()),
    totalPaid: toMoneyString(sum(paid, (i) => i.paidAmount).plus(sum(paid, (i) => i.lateFee))),
    principalAmortized: toMoneyString(sum(paid, (i) => i.principal)),
    interestPaid: toMoneyString(sum(paid, (i) => i.interest)),
    feesPaid: toMoneyString(sum(paid, (i) => i.fees)),
    lateFeesPaid: toMoneyString(sum(paid, (i) => i.lateFee)),
    paidCount: paid.length,
    remainingCount: pending.length,
    totalCount: f.items.filter((i) => i.status !== 'CANCELED_PAYOFF').length,
    nextDue: next ? { number: next.number, dueDate: fromDate(next.dueDate), total: M(next.total), overdue: fromDate(next.dueDate) < today } : null,
    estimatedPayoffDate: pending.length ? fromDate(pending.at(-1)!.dueDate) : null,
  };
}

const toPublic = (f: Full, today: string) => ({
  id: f.id, name: f.name, creditor: f.creditor, kind: f.kind, system: f.system, monthlyRatePercent: toMoneyString(money(f.monthlyRate.toString()).times(100)).replace(/(\.\d{2})$/, '$1'), annualCet: f.annualCet?.toString() ?? null,
  contractedAmount: M(f.contractedAmount), downPayment: M(f.downPayment), financedAmount: M(f.financedAmount), installments: f.installments, feePerInstallment: M(f.feePerInstallment),
  contractDate: fromDate(f.contractDate), firstDueDate: fromDate(f.firstDueDate), dueDay: f.dueDay, walletId: f.walletId, scheduleSource: f.scheduleSource, status: f.status, paidOffDate: f.paidOffDate ? fromDate(f.paidOffDate) : null, notes: f.notes,
  summary: summarize(f, today),
});

export const FinancingService = {
  async create(userId: string, input: any) {
    if (input.walletId) await activeWallet(userId, input.walletId);
    const today = await todayOf(userId);
    const financed = money(input.financedAmount ?? money(input.contractedAmount).minus(input.downPayment ?? 0).toString());
    if (financed.lte(0)) throw badRequest('O valor financiado precisa ser maior que zero');
    const rate = money(input.monthlyRatePercent).dividedBy(100);
    const fee = money(input.feePerInstallment ?? 0);
    const dueDay = input.dueDay ?? Number(input.firstDueDate.slice(8, 10));

    let rows: { dueDate: string; principal: string; interest: string; fees: string; total: string }[];
    let source: 'CALCULATED' | 'IMPORTED' | 'MANUAL';
    if (input.schedule) {
      source = 'IMPORTED';
      rows = input.schedule.map((s: any) => ({ dueDate: s.dueDate, principal: s.principal ?? s.total, interest: s.interest ?? '0', fees: '0', total: s.total }));
    } else if (input.manualInstallmentAmount) {
      source = 'MANUAL';
      const dates = monthlyDueDates(input.firstDueDate, dueDay, input.installments);
      rows = dates.map((d) => ({ dueDate: d, principal: input.manualInstallmentAmount, interest: '0', fees: '0', total: input.manualInstallmentAmount }));
    } else {
      source = 'CALCULATED';
      const dates = monthlyDueDates(input.firstDueDate, dueDay, input.installments);
      rows = buildSchedule({ principal: financed, monthlyRate: rate, n: input.installments, system: input.system }).map((r, k) => ({
        dueDate: dates[k]!, principal: r.principal.toFixed(2), interest: r.interest.toFixed(2), fees: fee.toFixed(2), total: r.payment.plus(fee).toFixed(2),
      }));
    }

    const created = await prisma.financing.create({
      data: {
        userId, name: input.name, creditor: input.creditor ?? null, kind: input.kind, contractedAmount: input.contractedAmount ?? financed.toFixed(4), downPayment: input.downPayment ?? 0, financedAmount: financed.toFixed(4),
        monthlyRate: rate.toFixed(6), annualCet: input.annualCet ?? null, system: input.system, installments: rows.length, feePerInstallment: fee.toFixed(4), contractDate: toDate(input.contractDate ?? today), firstDueDate: toDate(rows[0]!.dueDate),
        dueDay, walletId: input.walletId ?? null, scheduleSource: source, notes: input.notes ?? null,
        items: { create: rows.map((r, k) => ({ userId, number: k + 1, dueDate: toDate(r.dueDate), principal: r.principal, interest: r.interest, fees: r.fees, total: r.total })) },
      },
    });
    await AuditModel.record({ userId, action: 'financing.create', entity: 'financing', entityId: created.id, after: { name: created.name, financed: financed.toFixed(2), installments: rows.length, system: input.system, source } });
    return this.get(userId, created.id);
  },

  async list(userId: string) {
    const today = await todayOf(userId);
    const list = await prisma.financing.findMany({ where: { userId, status: { not: 'CANCELED' } }, include: { items: { orderBy: { number: 'asc' } } }, orderBy: { createdAt: 'asc' } });
    return { financings: list.map((f) => toPublic(f, today)) };
  },

  async get(userId: string, id: string) {
    const f = await owned(userId, id);
    const today = await todayOf(userId);
    return { financing: toPublic(f, today), schedule: f.items.map((i) => instDto(i, f.installments)) };
  },

  /** Pagamento de uma parcela (inclusive antecipação). Multa/juros de atraso entram como despesa à parte (RN047). */
  async payInstallment(userId: string, id: string, number: number, input: { walletId: string; date?: string | undefined; amount?: string | undefined; lateFee?: string | undefined }) {
    const f = await owned(userId, id);
    const inst = f.items.find((i) => i.number === number);
    if (!inst) throw notFound('Parcela');
    if (inst.status !== 'PENDING') throw unprocessable('Esta parcela não está pendente');
    const wallet = await activeWallet(userId, input.walletId);
    const date = (await dateOrToday(userId, input.date)).toISOString().slice(0, 10);
    const value = money(input.amount ?? inst.total.toString());
    const cat = await debtCategoryId(userId);

    await prisma.$transaction(async (tx) => {
      const t = await postDebtExpense(tx, { userId, walletId: wallet.id, amount: value, description: `Parcela ${number}/${f.installments} · ${f.name}`, date, categoryId: cat });
      if (input.lateFee) await postDebtExpense(tx, { userId, walletId: wallet.id, amount: input.lateFee, description: `Multa e juros de atraso · ${f.name}`, date, categoryId: cat });
      await tx.financingInstallment.update({ where: { id: inst.id }, data: { status: 'PAID', paidAmount: value.toFixed(4), lateFee: input.lateFee ?? 0, paidDate: toDate(date), transactionId: t.id } });
    });
    await AuditModel.record({ userId, action: 'financing.pay_installment', entity: 'financing', entityId: id, after: { number, amount: value.toFixed(2), lateFee: input.lateFee ?? null } });
    return this.get(userId, id);
  },

  async cancelPayment(userId: string, id: string, number: number) {
    const f = await owned(userId, id);
    const inst = f.items.find((i) => i.number === number);
    if (!inst) throw notFound('Parcela');
    if (inst.status !== 'PAID') throw unprocessable('Esta parcela não foi paga');
    const today = await todayOf(userId);
    await prisma.$transaction(async (tx) => {
      await reverseDebtExpense(tx, inst.transactionId, today, 'Estorno de pagamento de parcela');
      await tx.financingInstallment.update({ where: { id: inst.id }, data: { status: 'PENDING', paidAmount: 0, lateFee: 0, paidDate: null, transactionId: null } });
    });
    await AuditModel.record({ userId, action: 'financing.cancel_payment', entity: 'financing', entityId: id, after: { number } });
    return this.get(userId, id);
  },

  /**
   * Amortização extraordinária (RN046): simula (sem gravar) ou aplica. REDUCE_TERM mantém a parcela e
   * encurta o prazo; REDUCE_INSTALLMENT mantém o prazo e reduz a parcela. Só vale para cronograma calculado.
   */
  async extra(userId: string, id: string, input: { amount: string; mode: ExtraMode; walletId?: string | undefined; date?: string | undefined; simulate: boolean }) {
    const f = await owned(userId, id);
    if (f.status !== 'ACTIVE') throw unprocessable('Contrato encerrado');
    if (f.scheduleSource !== 'CALCULATED') throw unprocessable('Amortização automática só funciona com cronograma calculado pelo app; atualize o saldo oficial manualmente');
    const pending = f.items.filter((i) => i.status === 'PENDING');
    if (pending.length < 2) throw unprocessable('Restam poucas parcelas: use a quitação');
    const balance = pending.reduce((s, i) => s.plus(i.principal.toString()), money(0));
    const fee = money(f.feePerInstallment.toString());
    const next = pending[0]!;
    const sim = (() => {
      try {
        return simulateExtra({ balance, monthlyRate: f.monthlyRate.toString(), system: f.system, remainingTerms: pending.length, currentPayment: money(next.principal.toString()).plus(next.interest.toString()), extra: input.amount, mode: input.mode });
      } catch (e) {
        throw unprocessable((e as Error).message);
      }
    })();
    const result = { balanceBefore: toMoneyString(balance), extra: input.amount, mode: input.mode, termsBefore: pending.length, termsAfter: sim.newTerms, monthsSaved: sim.monthsSaved, interestSaved: toMoneyString(sim.interestSaved), newPayment: toMoneyString(sim.newPayment.plus(fee)), estimate: true };
    if (input.simulate) return { simulation: result };

    if (!input.walletId) throw badRequest('Informe a carteira de origem do pagamento');
    const wallet = await activeWallet(userId, input.walletId);
    const date = (await dateOrToday(userId, input.date)).toISOString().slice(0, 10);
    const cat = await debtCategoryId(userId);
    const paidCount = f.items.filter((i) => i.status === 'PAID').length;
    const dates = monthlyDueDates(fromDate(next.dueDate), f.dueDay, sim.newTerms);

    await prisma.$transaction(async (tx) => {
      const t = await postDebtExpense(tx, { userId, walletId: wallet.id, amount: input.amount, description: `Amortização extra · ${f.name}`, date, categoryId: cat });
      await tx.financingInstallment.deleteMany({ where: { financingId: id, status: 'PENDING' } });
      await tx.financingInstallment.createMany({
        data: sim.rows.map((r, k) => ({ userId, financingId: id, number: paidCount + k + 1, dueDate: toDate(dates[k]!), principal: r.principal.toFixed(4), interest: r.interest.toFixed(4), fees: fee.toFixed(4), total: r.payment.plus(fee).toFixed(4) })),
      });
      await tx.financing.update({ where: { id }, data: { installments: paidCount + sim.newTerms } });
      await tx.financingExtraPayment.create({ data: { userId, financingId: id, amount: input.amount, mode: input.mode, date: toDate(date), transactionId: t.id } });
    });
    await AuditModel.record({ userId, action: 'financing.extra_amortization', entity: 'financing', entityId: id, after: { amount: input.amount, mode: input.mode, termsAfter: sim.newTerms } });
    return { applied: result, ...(await this.get(userId, id)) };
  },

  /** Quitação: cancela as parcelas futuras por quitação, preservando o histórico (RN048). */
  async payoff(userId: string, id: string, input: { walletId: string; amount?: string | undefined; date?: string | undefined }) {
    const f = await owned(userId, id);
    if (f.status !== 'ACTIVE') throw unprocessable('Contrato já encerrado');
    const pending = f.items.filter((i) => i.status === 'PENDING');
    if (!pending.length) throw conflict('Não há parcelas pendentes');
    const wallet = await activeWallet(userId, input.walletId);
    const date = (await dateOrToday(userId, input.date)).toISOString().slice(0, 10);
    const amount = money(input.amount ?? pending.reduce((s, i) => s.plus(i.principal.toString()), money(0)).toString());
    const cat = await debtCategoryId(userId);
    await prisma.$transaction(async (tx) => {
      const t = await postDebtExpense(tx, { userId, walletId: wallet.id, amount, description: `Quitação · ${f.name}`, date, categoryId: cat });
      await tx.financingInstallment.updateMany({ where: { financingId: id, status: 'PENDING' }, data: { status: 'CANCELED_PAYOFF' } });
      await tx.financing.update({ where: { id }, data: { status: 'PAID_OFF', paidOffDate: toDate(date) } });
      await tx.financingExtraPayment.create({ data: { userId, financingId: id, amount: amount.toFixed(4), mode: 'PAYOFF', date: toDate(date), transactionId: t.id } });
    });
    await AuditModel.record({ userId, action: 'financing.payoff', entity: 'financing', entityId: id, after: { amount: amount.toFixed(2) } });
    return this.get(userId, id);
  },

  /** Registra o saldo informado pelo credor para comparar com a estimativa do app. */
  async setOfficialBalance(userId: string, id: string, amount: string, date?: string) {
    await owned(userId, id);
    await prisma.financing.update({ where: { id }, data: { officialBalance: amount, officialBalanceAt: toDate(date ?? (await todayOf(userId))) } });
    await AuditModel.record({ userId, action: 'financing.official_balance', entity: 'financing', entityId: id, after: { amount } });
    return this.get(userId, id);
  },
};
