import type { LedgerKind, Prisma } from '@prisma/client';
import { prisma } from '../../../shared/database.js';

export type Tx = Prisma.TransactionClient;

export interface NewEntry {
  userId: string;
  walletId: string;
  amount: Prisma.Decimal | string;
  kind: LedgerKind;
  effectiveDate: Date;
  description?: string | undefined;
  transactionId?: string | undefined;
  transferId?: string | undefined;
  investmentOpId?: string | undefined;
  reversesEntryId?: string | undefined;
}

type OpenEntries = Awaited<ReturnType<Tx['ledgerEntry']['findMany']>>;

export const LedgerModel = {
  /** Grava o lançamento e atualiza o cache do saldo na MESMA transação (RN010). */
  async post(tx: Tx, e: NewEntry) {
    const entry = await tx.ledgerEntry.create({ data: { ...e, description: e.description ?? null, transactionId: e.transactionId ?? null, transferId: e.transferId ?? null, investmentOpId: e.investmentOpId ?? null, reversesEntryId: e.reversesEntryId ?? null } });
    await tx.wallet.update({ where: { id: e.walletId }, data: { cachedBalance: { increment: e.amount } } });
    return entry;
  },

  /** Lançamentos de uma origem (transação ou transferência) que ainda não foram estornados. */
  async openEntries(tx: Tx, where: { transactionId?: string; transferId?: string; investmentOpId?: string }) {
    const entries = await tx.ledgerEntry.findMany({ where: { ...where, kind: { not: 'REVERSAL' } } });
    if (!entries.length) return [];
    const reversed = await tx.ledgerEntry.findMany({ where: { reversesEntryId: { in: entries.map((e) => e.id) } }, select: { reversesEntryId: true } });
    const done = new Set(reversed.map((r) => r.reversesEntryId));
    return entries.filter((e) => !done.has(e.id));
  },

  /** Estorna: cria o lançamento oposto ligado ao original (nada é apagado). */
  async reverse(tx: Tx, entries: OpenEntries, effectiveDate: Date, reason: string) {
    for (const e of entries) {
      await LedgerModel.post(tx, {
        userId: e.userId, walletId: e.walletId, amount: e.amount.negated(), kind: 'REVERSAL', effectiveDate,
        description: reason, transactionId: e.transactionId ?? undefined, transferId: e.transferId ?? undefined, investmentOpId: e.investmentOpId ?? undefined, reversesEntryId: e.id,
      });
    }
  },

  sumOf: async (walletId: string) => (await prisma.ledgerEntry.aggregate({ where: { walletId }, _sum: { amount: true } }))._sum.amount,
  sumUntil: async (walletId: string, date: Date) => (await prisma.ledgerEntry.aggregate({ where: { walletId, effectiveDate: { lte: date } }, _sum: { amount: true } }))._sum.amount,

  list: (walletId: string, from?: Date, to?: Date) =>
    prisma.ledgerEntry.findMany({
      where: { walletId, ...(from || to ? { effectiveDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    }),
  /** Movimento diário (soma por dia) para a evolução do saldo. */
  dailyDeltas: (walletId: string, from: Date) =>
    prisma.ledgerEntry.groupBy({ by: ['effectiveDate'], where: { walletId, effectiveDate: { gte: from } }, _sum: { amount: true }, orderBy: { effectiveDate: 'asc' } }),
};
