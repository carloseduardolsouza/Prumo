import type { Prisma, Transfer } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import { toMoneyString } from '../../../shared/money.js';
import { fromDate } from './finance.schemas.js';

export const toPublicTransfer = (t: Transfer) => ({
  id: t.id,
  fromWalletId: t.fromWalletId,
  toWalletId: t.toWalletId,
  amount: toMoneyString(t.amount.toString()),
  date: fromDate(t.date),
  notes: t.notes,
  feeTxId: t.feeTxId,
  canceled: t.canceledAt !== null,
});

export const TransferModel = {
  find: (userId: string, id: string) => prisma.transfer.findFirst({ where: { id, userId } }),
  create: (tx: Prisma.TransactionClient, data: Prisma.TransferUncheckedCreateInput) => tx.transfer.create({ data }),
  cancel: (tx: Prisma.TransactionClient, id: string) => tx.transfer.update({ where: { id }, data: { canceledAt: new Date() } }),
  inRange: (userId: string, from: Date, to: Date) => prisma.transfer.findMany({ where: { userId, canceledAt: null, date: { gte: from, lte: to } } }),
};
