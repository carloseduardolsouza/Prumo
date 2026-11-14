import type { Prisma, Wallet } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import { toMoneyString } from '../../../shared/money.js';
import { fromDate } from './finance.schemas.js';

export const toPublicWallet = (w: Wallet) => ({
  id: w.id,
  name: w.name,
  type: w.type,
  institution: w.institution,
  currency: w.currency,
  color: w.color,
  icon: w.icon,
  notes: w.notes,
  openingDate: fromDate(w.openingDate),
  balance: toMoneyString(w.cachedBalance.toString()),
  negative: w.cachedBalance.isNegative(),
  archived: w.archivedAt !== null,
});

export const WalletModel = {
  list: (userId: string, status: 'active' | 'archived' | 'all') =>
    prisma.wallet.findMany({ where: { userId, ...(status === 'all' ? {} : { archivedAt: status === 'active' ? null : { not: null } }) }, orderBy: [{ createdAt: 'asc' }] }),
  find: (userId: string, id: string) => prisma.wallet.findFirst({ where: { id, userId } }),
  findMany: (userId: string, ids: string[]) => prisma.wallet.findMany({ where: { userId, id: { in: ids } } }),
  create: (tx: Prisma.TransactionClient, data: Prisma.WalletUncheckedCreateInput) => tx.wallet.create({ data }),
  update: (id: string, data: Prisma.WalletUpdateInput) => prisma.wallet.update({ where: { id }, data }),
  setBalance: (id: string, balance: Prisma.Decimal | string) => prisma.wallet.update({ where: { id }, data: { cachedBalance: balance } }),
};
