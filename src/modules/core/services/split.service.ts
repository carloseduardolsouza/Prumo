import { prisma } from '../../../shared/database.js';
import { conflict, notFound } from '../../../shared/errors.js';
import { money, splitEvenly, toMoneyString } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { LedgerModel } from '../models/ledger.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { CategoryModel } from '../models/category.model.js';
import { activeWallet, dateOrToday } from './context.js';

type SplitFull = NonNullable<Awaited<ReturnType<typeof load>>>;

async function load(userId: string, id: string) {
  return prisma.split.findFirst({ where: { id, userId }, include: { participants: true } });
}

const toPublic = (s: SplitFull) => {
  const pending = s.participants.filter((p) => !p.paidAt);
  return {
    id: s.id, description: s.description, totalAmount: toMoneyString(s.totalAmount.toString()), myShare: toMoneyString(s.myShare.toString()), date: fromDate(s.date), transactionId: s.transactionId,
    participants: s.participants.map((p) => ({ id: p.id, name: p.name, amount: toMoneyString(p.amount.toString()), paid: p.paidAt !== null, paidAt: p.paidAt ? fromDate(p.paidAt) : null })),
    receivable: toMoneyString(pending.reduce((sum, p) => sum.plus(p.amount.toString()), money(0))),
  };
};

export const SplitService = {
  /**
   * Divisão em partes iguais entre você e os participantes. Só a SUA parte vira despesa (relatórios e
   * orçamento); a parte dos outros sai da carteira como "adiantamento a receber" (não é despesa) e volta
   * como reembolso quando cada pessoa paga. O saldo da carteira segue sempre o dinheiro real.
   */
  async create(userId: string, input: { description: string; totalAmount: string; walletId: string; categoryId?: string | undefined; date?: string | undefined; participants: { name: string }[] }) {
    const wallet = await activeWallet(userId, input.walletId);
    if (input.categoryId) {
      const c = await CategoryModel.find(userId, input.categoryId);
      if (!c || c.archivedAt || c.type !== 'EXPENSE') throw notFound('Categoria');
    }
    const date = await dateOrToday(userId, input.date);
    const parts = splitEvenly(input.totalAmount, input.participants.length + 1); // [minha parte, ...outros]
    const mine = parts[0]!;
    const others = parts.slice(1);
    const advance = money(input.totalAmount).minus(mine);

    const split = await prisma.$transaction(async (tx) => {
      const t = await TransactionModel.create(tx, { userId, type: 'EXPENSE', status: 'SETTLED', description: input.description, categoryId: input.categoryId ?? null, walletId: wallet.id, plannedAmount: mine.toFixed(4), paidAmount: mine.toFixed(4), competenceDate: date, paidDate: date, notes: 'Divisão de despesa: só a minha parte' });
      await LedgerModel.post(tx, { userId, walletId: wallet.id, amount: mine.negated().toFixed(4), kind: 'EXPENSE', effectiveDate: date, description: input.description, transactionId: t.id });
      await LedgerModel.post(tx, { userId, walletId: wallet.id, amount: advance.negated().toFixed(4), kind: 'SPLIT_ADVANCE', effectiveDate: date, description: `Parte dos outros: ${input.description}`, transactionId: t.id });
      return tx.split.create({
        data: { userId, description: input.description, totalAmount: input.totalAmount, myShare: mine.toFixed(4), date, walletId: wallet.id, transactionId: t.id, participants: { create: input.participants.map((p, i) => ({ name: p.name, amount: others[i]!.toFixed(4) })) } },
        include: { participants: true },
      });
    });
    await AuditModel.record({ userId, action: 'split.create', entity: 'split', entityId: split.id, after: { total: input.totalAmount, myShare: mine.toFixed(2), participants: input.participants.length } });
    return toPublic(split);
  },

  async list(userId: string) {
    const splits = await prisma.split.findMany({ where: { userId, canceledAt: null }, include: { participants: true }, orderBy: { date: 'desc' }, take: 100 });
    const items = splits.map(toPublic);
    const receivable = items.reduce((s, i) => s.plus(i.receivable), money(0));
    return { splits: items, receivable: toMoneyString(receivable) };
  },

  /** Registra que um participante pagou a parte dele: o dinheiro entra na carteira como reembolso (não é receita). */
  async markPaid(userId: string, splitId: string, participantId: string, input: { walletId: string; date?: string | undefined }) {
    const s = await load(userId, splitId);
    const p = s?.participants.find((x) => x.id === participantId);
    if (!s || !p) throw notFound('Participante');
    if (p.paidAt) throw conflict('Esta parte já foi recebida');
    const wallet = await activeWallet(userId, input.walletId);
    const date = await dateOrToday(userId, input.date);
    await prisma.$transaction(async (tx) => {
      const entry = await LedgerModel.post(tx, { userId, walletId: wallet.id, amount: p.amount, kind: 'REIMBURSEMENT', effectiveDate: date, description: `Reembolso de ${p.name}: ${s.description}`, transactionId: s.transactionId ?? undefined });
      await tx.splitParticipant.update({ where: { id: p.id }, data: { paidAt: date, ledgerEntryId: entry.id } });
    });
    await AuditModel.record({ userId, action: 'split.reimbursement', entity: 'split', entityId: splitId, after: { participant: p.name, amount: toMoneyString(p.amount.toString()) } });
    return toPublic((await load(userId, splitId))!);
  },
};

export const _toDate = toDate;
