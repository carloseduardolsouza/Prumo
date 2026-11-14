import type { TxType } from '@prisma/client';
import { prisma } from '../../../shared/database.js';

// Consultas de agregação do dashboard e dos relatórios. Sempre por userId (RN001).
export const DashboardModel = {
  /** Lançamentos efetivados (inclui parciais) com data de pagamento no período. Cancelados ficam de fora. */
  paidRows: (userId: string, from: Date, to: Date) =>
    prisma.financialTransaction.findMany({
      where: { userId, status: { in: ['SETTLED', 'PARTIAL'] }, paidDate: { gte: from, lte: to } },
      select: { type: true, categoryId: true, paidAmount: true, paidDate: true },
    }),

  categories: (userId: string) => prisma.category.findMany({ where: { userId }, select: { id: true, name: true, color: true, parentId: true, type: true } }),

  /** Saldo somado das carteiras ativas (cache reconciliável). */
  activeBalance: (userId: string) => prisma.wallet.aggregate({ where: { userId, archivedAt: null }, _sum: { cachedBalance: true }, _count: true }),

  /** Soma do ledger das carteiras ativas antes de `date` (saldo de abertura do gráfico). */
  ledgerBefore: async (userId: string, date: Date) =>
    (await prisma.ledgerEntry.aggregate({ where: { userId, effectiveDate: { lt: date }, wallet: { archivedAt: null } }, _sum: { amount: true } }))._sum.amount,

  ledgerDeltas: (userId: string, from: Date, to: Date) =>
    prisma.ledgerEntry.groupBy({ by: ['effectiveDate'], where: { userId, effectiveDate: { gte: from, lte: to }, wallet: { archivedAt: null } }, _sum: { amount: true }, orderBy: { effectiveDate: 'asc' } }),

  /** Pendentes (previstos e parciais) com vencimento no intervalo. */
  openRows: (userId: string, from: Date | null, to: Date) =>
    prisma.financialTransaction.findMany({
      where: { userId, status: { in: ['PLANNED', 'PARTIAL'] }, dueDate: { ...(from ? { gte: from } : {}), lte: to } },
      select: { type: true, plannedAmount: true, paidAmount: true },
    }),

  transfers: (userId: string, from: Date, to: Date) => prisma.transfer.findMany({ where: { userId, canceledAt: null, date: { gte: from, lte: to } }, orderBy: { date: 'desc' } }),
  walletNames: async (userId: string) => new Map((await prisma.wallet.findMany({ where: { userId }, select: { id: true, name: true } })).map((w) => [w.id, w.name])),
};

export type PaidRow = Awaited<ReturnType<typeof DashboardModel.paidRows>>[number];
export type TypeOf = TxType;
