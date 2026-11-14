import type { CreditCard, Invoice, Prisma } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import { toMoneyString } from '../../../shared/money.js';
import { fromDate } from './finance.schemas.js';

export const toPublicCard = (c: CreditCard) => ({
  id: c.id, name: c.name, issuer: c.issuer, brand: c.brand, holder: c.holder, last4: c.last4, limit: toMoneyString(c.limit.toString()),
  closingDay: c.closingDay, dueDay: c.dueDay, color: c.color, limitPolicy: c.limitPolicy, status: c.status, notes: c.notes,
});

export const InvoiceDates = (i: Invoice) => ({ startDate: fromDate(i.startDate), closingDate: fromDate(i.closingDate), dueDate: fromDate(i.dueDate) });

export const CardModel = {
  list: (userId: string, includeArchived = false) =>
    prisma.creditCard.findMany({ where: { userId, ...(includeArchived ? {} : { status: { not: 'ARCHIVED' } }) }, orderBy: { createdAt: 'asc' } }),
  find: (userId: string, id: string) => prisma.creditCard.findFirst({ where: { id, userId } }),
  create: (data: Prisma.CreditCardUncheckedCreateInput) => prisma.creditCard.create({ data }),
  update: (id: string, data: Prisma.CreditCardUncheckedUpdateInput) => prisma.creditCard.update({ where: { id }, data }),

  /** Total e pago por fatura (só compras não canceladas e pagamentos não cancelados). */
  async invoiceTotals(userId: string, cardId: string) {
    const [inst, pay] = await Promise.all([
      prisma.purchaseInstallment.groupBy({ by: ['invoiceId'], where: { userId, invoice: { cardId }, purchase: { canceledAt: null } }, _sum: { amount: true } }),
      prisma.invoicePayment.groupBy({ by: ['invoiceId'], where: { userId, invoice: { cardId }, canceledAt: null }, _sum: { amount: true } }),
    ]);
    const map = new Map<string, { total: string; paid: string }>();
    for (const r of inst) map.set(r.invoiceId, { total: r._sum.amount?.toString() ?? '0', paid: '0' });
    for (const r of pay) map.set(r.invoiceId, { total: map.get(r.invoiceId)?.total ?? '0', paid: r._sum.amount?.toString() ?? '0' });
    return map;
  },

  invoices: (userId: string, cardId: string) => prisma.invoice.findMany({ where: { userId, cardId }, orderBy: [{ refYear: 'asc' }, { refMonth: 'asc' }] }),
  findInvoice: (userId: string, id: string) => prisma.invoice.findFirst({ where: { id, userId }, include: { card: true } }),
  ensureInvoice: (tx: Prisma.TransactionClient, userId: string, cardId: string, c: { startDate: string; closingDate: string; dueDate: string; refYear: number; refMonth: number }) =>
    tx.invoice.upsert({
      where: { cardId_refYear_refMonth: { cardId, refYear: c.refYear, refMonth: c.refMonth } },
      update: {},
      create: { userId, cardId, refYear: c.refYear, refMonth: c.refMonth, startDate: new Date(`${c.startDate}T00:00:00Z`), closingDate: new Date(`${c.closingDate}T00:00:00Z`), dueDate: new Date(`${c.dueDate}T00:00:00Z`) },
    }),
  invoiceItems: (invoiceId: string) =>
    prisma.purchaseInstallment.findMany({ where: { invoiceId, purchase: { canceledAt: null } }, include: { purchase: true }, orderBy: [{ competenceDate: 'desc' }, { number: 'asc' }] }),
  invoicePayments: (invoiceId: string) => prisma.invoicePayment.findMany({ where: { invoiceId }, orderBy: { paidDate: 'desc' } }),

  findPurchase: (userId: string, id: string) => prisma.cardPurchase.findFirst({ where: { id, userId }, include: { items: { include: { invoice: true } }, card: true } }),
  findPayment: (userId: string, id: string) => prisma.invoicePayment.findFirst({ where: { id, userId }, include: { invoice: { include: { card: true } } } }),
  refundedSum: async (originalId: string) => (await prisma.cardPurchase.aggregate({ where: { refundOfId: originalId, canceledAt: null }, _sum: { totalAmount: true } }))._sum.totalAmount,

  /** Parcelas (compras e estornos) com competência no período, para o extrato, dashboard e relatórios. */
  installmentsInRange: (userId: string, from: Date, to: Date) =>
    prisma.purchaseInstallment.findMany({
      where: { userId, competenceDate: { gte: from, lte: to }, purchase: { canceledAt: null } },
      include: { purchase: { include: { card: { select: { name: true } } } } },
    }),

  /** Faturas com vencimento no intervalo (para "compromissos futuros"). */
  invoicesDueBetween: (userId: string, from: Date | null, to: Date) => prisma.invoice.findMany({ where: { userId, dueDate: { ...(from ? { gte: from } : {}), lte: to }, card: { status: { not: 'ARCHIVED' } } } }),
  totalsOfInvoices: async (invoiceIds: string[]) => {
    const [inst, pay] = await Promise.all([
      prisma.purchaseInstallment.groupBy({ by: ['invoiceId'], where: { invoiceId: { in: invoiceIds }, purchase: { canceledAt: null } }, _sum: { amount: true } }),
      prisma.invoicePayment.groupBy({ by: ['invoiceId'], where: { invoiceId: { in: invoiceIds }, canceledAt: null }, _sum: { amount: true } }),
    ]);
    const map = new Map<string, { total: string; paid: string }>();
    for (const r of inst) map.set(r.invoiceId, { total: r._sum.amount?.toString() ?? '0', paid: '0' });
    for (const r of pay) map.set(r.invoiceId, { total: map.get(r.invoiceId)?.total ?? '0', paid: r._sum.amount?.toString() ?? '0' });
    return map;
  },
};
