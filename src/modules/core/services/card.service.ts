import type { CardStatus, CreditCard, Invoice } from '@prisma/client';
import { conflict, notFound, unprocessable } from '../../../shared/errors.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { prisma } from '../../../shared/database.js';
import { AuditModel } from '../models/audit.model.js';
import type { CardCreate } from '../models/card.schemas.js';
import { CardModel, InvoiceDates, toPublicCard } from '../models/card.model.js';
import { MIN_PAYMENT_RATE, cycleFor, invoiceStatus, type InvoiceStatus } from './card-cycles.js';
import { todayOf } from './context.js';

export async function ownedCard(userId: string, id: string) {
  const c = await CardModel.find(userId, id);
  if (!c) throw notFound('Cartão');
  return c;
}

export async function activeCard(userId: string, id: string) {
  const c = await ownedCard(userId, id);
  if (c.status !== 'ACTIVE') throw unprocessable(`Cartão ${c.status === 'BLOCKED' ? 'bloqueado' : c.status === 'CANCELED' ? 'cancelado' : 'arquivado'}: não aceita novas compras`);
  return c;
}

const cents = (v: string) => money(v).times(100).toDecimalPlaces(0).toNumber();

export function invoiceDto(inv: Invoice, totals: { total: string; paid: string } | undefined, today: string) {
  const total = money(totals?.total ?? 0);
  const paid = money(totals?.paid ?? 0);
  const d = InvoiceDates(inv);
  const status: InvoiceStatus = invoiceStatus({ closingDate: d.closingDate, dueDate: d.dueDate, totalCents: cents(total.toString()), paidCents: cents(paid.toString()) }, today);
  const remaining = total.minus(paid);
  return {
    id: inv.id, cardId: inv.cardId, refYear: inv.refYear, refMonth: inv.refMonth, ...d, status,
    total: toMoneyString(total), paid: toMoneyString(paid), remaining: toMoneyString(remaining.isNegative() ? 0 : remaining),
    minimumPayment: status === 'open' || remaining.lte(0) ? null : toMoneyString(remaining.times(MIN_PAYMENT_RATE)),
  };
}

/**
 * Limite estimado (RN033/034/041): o oficial é o do emissor. Política conservadora compromete todas as
 * parcelas ainda não pagas; "só faturas" compromete apenas as faturas cujo ciclo já começou.
 */
async function summaryOf(userId: string, card: CreditCard, today: string) {
  const [invoices, totals] = await Promise.all([CardModel.invoices(userId, card.id), CardModel.invoiceTotals(userId, card.id)]);
  let allOwed = money(0), startedOwed = money(0);
  for (const inv of invoices) {
    const t = totals.get(inv.id);
    const owed = money(t?.total ?? 0).minus(t?.paid ?? 0);
    allOwed = allOwed.plus(owed);
    if (InvoiceDates(inv).startDate <= today) startedOwed = startedOwed.plus(owed);
  }
  const committed = (card.limitPolicy === 'CONSERVATIVE' ? allOwed : startedOwed);
  const committedSafe = committed.isNegative() ? money(0) : committed;
  const limit = money(card.limit.toString());
  const current = cycleFor(today, card.closingDay, card.dueDay);
  const currentInv = invoices.find((i) => i.refYear === current.refYear && i.refMonth === current.refMonth);
  return {
    limit: toMoneyString(limit),
    committed: toMoneyString(committedSafe),
    available: toMoneyString(limit.minus(committedSafe)),
    usedPercent: limit.isZero() ? 0 : Math.round(committedSafe.dividedBy(limit).times(1000).toNumber()) / 10,
    currentInvoice: invoiceDto(
      currentInv ?? ({ id: '', cardId: card.id, refYear: current.refYear, refMonth: current.refMonth, startDate: new Date(`${current.startDate}T00:00:00Z`), closingDate: new Date(`${current.closingDate}T00:00:00Z`), dueDate: new Date(`${current.dueDate}T00:00:00Z`), createdAt: new Date(), userId } as Invoice),
      currentInv ? totals.get(currentInv.id) : undefined, today,
    ),
    futureInstallments: toMoneyString(allOwed.minus(startedOwed).isNegative() ? 0 : allOwed.minus(startedOwed)),
    note: 'Limite estimado pelo app com base nas compras e parcelas registradas; o limite oficial é o informado pelo banco.',
  };
}

export const CardService = {
  async create(userId: string, input: CardCreate) {
    const card = await CardModel.create({
      userId, name: input.name, issuer: input.issuer ?? null, brand: input.brand ?? null, holder: input.holder ?? null, last4: input.last4 ?? null,
      limit: input.limit, closingDay: input.closingDay, dueDay: input.dueDay, color: input.color ?? null, limitPolicy: input.limitPolicy, notes: input.notes ?? null,
    });
    await AuditModel.record({ userId, action: 'card.create', entity: 'card', entityId: card.id, after: { name: card.name, limit: input.limit, closingDay: card.closingDay, dueDay: card.dueDay } });
    return toPublicCard(card);
  },

  async list(userId: string, includeArchived = false) {
    const today = await todayOf(userId);
    const cards = await CardModel.list(userId, includeArchived);
    const items = await Promise.all(cards.map(async (c) => ({ ...toPublicCard(c), summary: await summaryOf(userId, c, today) })));
    const totalAvailable = items.filter((i) => i.status === 'ACTIVE').reduce((s, i) => s.plus(i.summary.available), money(0));
    return { cards: items, totals: { availableLimit: toMoneyString(totalAvailable) } };
  },

  async get(userId: string, id: string) {
    const c = await ownedCard(userId, id);
    return { ...toPublicCard(c), summary: await summaryOf(userId, c, await todayOf(userId)) };
  },

  async update(userId: string, id: string, patch: Record<string, string | undefined>) {
    const before = await ownedCard(userId, id);
    const data = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const c = await CardModel.update(id, data);
    await AuditModel.record({ userId, action: 'card.update', entity: 'card', entityId: id, before: { name: before.name }, after: { name: c.name } });
    return toPublicCard(c);
  },

  async setStatus(userId: string, id: string, status: CardStatus) {
    const c = await ownedCard(userId, id);
    if (c.status === status) throw conflict('O cartão já está nessa situação');
    const u = await CardModel.update(id, { status });
    await AuditModel.record({ userId, action: 'card.status', entity: 'card', entityId: id, before: { status: c.status }, after: { status } });
    return toPublicCard(u);
  },

  /** Ajuste manual de limite com justificativa e histórico (spec §6.3). */
  async adjustLimit(userId: string, id: string, limit: string, reason: string) {
    const c = await ownedCard(userId, id);
    if (money(limit).equals(c.limit.toString())) throw conflict('O limite já é esse');
    const u = await prisma.$transaction(async (tx) => {
      await tx.cardLimitAdjustment.create({ data: { userId, cardId: id, previous: c.limit, next: limit, reason } });
      return tx.creditCard.update({ where: { id }, data: { limit } });
    });
    await AuditModel.record({ userId, action: 'card.adjust_limit', entity: 'card', entityId: id, before: { limit: toMoneyString(c.limit.toString()) }, after: { limit, reason } });
    return toPublicCard(u);
  },
};
