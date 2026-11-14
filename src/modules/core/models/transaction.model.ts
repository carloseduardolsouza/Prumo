import type { FinancialTransaction, Prisma, TxStatus } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import { toMoneyString } from '../../../shared/money.js';
import { fromDate } from './finance.schemas.js';

export const statusToApi = (s: TxStatus) => s.toLowerCase() as 'planned' | 'partial' | 'settled' | 'canceled';

export const toPublicTransaction = (t: FinancialTransaction & { category?: { name: string } | null }) => ({
  id: t.id,
  type: t.type,
  status: statusToApi(t.status),
  description: t.description,
  categoryId: t.categoryId,
  categoryName: t.category?.name ?? null,
  walletId: t.walletId,
  plannedAmount: toMoneyString(t.plannedAmount.toString()),
  paidAmount: toMoneyString(t.paidAmount.toString()),
  remaining: toMoneyString(t.plannedAmount.minus(t.paidAmount).toString()),
  competenceDate: fromDate(t.competenceDate),
  dueDate: t.dueDate ? fromDate(t.dueDate) : null,
  paidDate: t.paidDate ? fromDate(t.paidDate) : null,
  notes: t.notes,
});

export const TransactionModel = {
  find: (userId: string, id: string) => prisma.financialTransaction.findFirst({ where: { id, userId }, include: { category: { select: { name: true } } } }),
  create: (tx: Prisma.TransactionClient, data: Prisma.FinancialTransactionUncheckedCreateInput) => tx.financialTransaction.create({ data, include: { category: { select: { name: true } } } }),
  update: (tx: Prisma.TransactionClient, id: string, data: Prisma.FinancialTransactionUncheckedUpdateInput) =>
    tx.financialTransaction.update({ where: { id }, data, include: { category: { select: { name: true } } } }),
  /** Lançamentos com data efetiva no período: pagos pela data de pagamento, pendentes pelo vencimento. */
  inRange: (userId: string, from: Date, to: Date, where: Prisma.FinancialTransactionWhereInput = {}) =>
    prisma.financialTransaction.findMany({
      where: {
        userId,
        status: { not: 'CANCELED' },
        AND: [where, { OR: [{ paidDate: { gte: from, lte: to } }, { paidDate: null, dueDate: { gte: from, lte: to } }, { paidDate: null, dueDate: null, competenceDate: { gte: from, lte: to } }] }],
      },
      include: { category: { select: { name: true } } },
    }),
  existingHashes: async (userId: string, hashes: string[]) =>
    new Set((await prisma.financialTransaction.findMany({ where: { userId, externalHash: { in: hashes } }, select: { externalHash: true } })).map((t) => t.externalHash)),
};
