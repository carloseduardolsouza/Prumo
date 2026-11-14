import { prisma } from '../../../shared/database.js';
import { notFound, unprocessable } from '../../../shared/errors.js';
import { money, splitEvenly, toMoneyString } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { CardModel } from '../models/card.model.js';
import type { PurchaseCreate } from '../models/card.schemas.js';
import { CategoryModel } from '../models/category.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { competenceDate, cycleFor, shiftCycle } from './card-cycles.js';
import { activeCard } from './card.service.js';
import { todayOf } from './context.js';

const toPublic = (p: NonNullable<Awaited<ReturnType<typeof CardModel.findPurchase>>>) => ({
  id: p.id, cardId: p.cardId, cardName: p.card.name, description: p.description, establishment: p.establishment, categoryId: p.categoryId,
  purchaseDate: fromDate(p.purchaseDate), totalAmount: toMoneyString(p.totalAmount.toString()), installments: p.installments,
  refundOfId: p.refundOfId, reason: p.reason, notes: p.notes, canceled: p.canceledAt !== null,
  items: p.items.map((i) => ({ id: i.id, number: i.number, total: i.total, amount: toMoneyString(i.amount.toString()), competenceDate: fromDate(i.competenceDate), invoiceId: i.invoiceId, invoiceDueDate: fromDate(i.invoice.dueDate) })),
});

async function load(userId: string, id: string) {
  const p = await CardModel.findPurchase(userId, id);
  if (!p) throw notFound('Compra');
  return p;
}

export const PurchaseService = {
  /**
   * Compra à vista ou parcelada. Cada parcela vai para a fatura do seu ciclo (RN029-031), a soma das parcelas
   * é exatamente o total (RN032) e a despesa é reconhecida pela competência, sem debitar carteira (RN022).
   */
  async create(userId: string, input: PurchaseCreate) {
    const card = await activeCard(userId, input.cardId);
    if (input.categoryId) {
      const c = await CategoryModel.find(userId, input.categoryId);
      if (!c || c.archivedAt) throw notFound('Categoria');
      if (c.type !== 'EXPENSE') throw unprocessable('Compra no cartão precisa de uma categoria de despesa');
    }
    const today = await todayOf(userId);
    const date = input.purchaseDate ?? today;
    const base = cycleFor(date, card.closingDay, card.dueDay);
    // Fatura já fechada não recebe lançamentos "silenciosos" (RN040): exige justificativa, que fica no histórico.
    if (base.closingDate < today && !input.reason) throw unprocessable('A fatura dessa data já fechou. Informe a justificativa (reason) para lançar mesmo assim.');

    const amounts = splitEvenly(input.amount, input.installments);
    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.cardPurchase.create({
        data: { userId, cardId: card.id, description: input.description, establishment: input.establishment ?? null, categoryId: input.categoryId ?? null, purchaseDate: toDate(date), totalAmount: input.amount, installments: input.installments, notes: input.notes ?? null, reason: input.reason ?? null },
      });
      for (let k = 1; k <= input.installments; k++) {
        const cycle = shiftCycle(base, k - 1, card.closingDay, card.dueDay);
        const inv = await CardModel.ensureInvoice(tx, userId, card.id, cycle);
        await tx.purchaseInstallment.create({
          data: { userId, purchaseId: p.id, invoiceId: inv.id, number: k, total: input.installments, amount: amounts[k - 1]!.toFixed(4), competenceDate: toDate(competenceDate(date, k)), categoryId: input.categoryId ?? null },
        });
      }
      return p;
    });
    await AuditModel.record({ userId, action: 'card_purchase.create', entity: 'card_purchase', entityId: purchase.id, after: { card: card.name, amount: input.amount, installments: input.installments, ...(input.reason ? { reason: input.reason } : {}) } });
    return toPublic(await load(userId, purchase.id));
  },

  get: async (userId: string, id: string) => toPublic(await load(userId, id)),

  /** Só dá para cancelar enquanto todas as faturas da compra ainda estão abertas; depois disso, estorno (RN040). */
  async cancel(userId: string, id: string) {
    const p = await load(userId, id);
    if (p.canceledAt) throw unprocessable('Compra já está cancelada');
    if (p.refundOfId) throw unprocessable('Estornos não podem ser cancelados');
    const today = await todayOf(userId);
    if (p.items.some((i) => fromDate(i.invoice.closingDate) < today)) throw unprocessable('Uma das faturas dessa compra já fechou: registre um estorno em vez de cancelar');
    await prisma.cardPurchase.update({ where: { id }, data: { canceledAt: new Date() } });
    await AuditModel.record({ userId, action: 'card_purchase.cancel', entity: 'card_purchase', entityId: id, before: { amount: toMoneyString(p.totalAmount.toString()) } });
    return toPublic(await load(userId, id));
  },

  /** Estorno: lançamento negativo vinculado à compra original, na fatura do ciclo atual (RN039). */
  async refund(userId: string, id: string, input: { amount?: string | undefined; reason: string }) {
    const original = await load(userId, id);
    if (original.canceledAt || original.refundOfId) throw unprocessable('Esta compra não aceita estorno');
    const already = money((await CardModel.refundedSum(id))?.toString() ?? 0).negated();
    const available = money(original.totalAmount.toString()).minus(already);
    const value = input.amount ? money(input.amount) : available;
    if (value.lte(0) || value.gt(available)) throw unprocessable(`Valor de estorno inválido (disponível: ${available.toFixed(2)})`);

    const card = await activeCard(userId, original.cardId);
    const today = await todayOf(userId);
    const cycle = cycleFor(today, card.closingDay, card.dueDay);
    const refund = await prisma.$transaction(async (tx) => {
      const inv = await CardModel.ensureInvoice(tx, userId, card.id, cycle);
      const r = await tx.cardPurchase.create({
        data: { userId, cardId: card.id, description: `Estorno: ${original.description}`, categoryId: original.categoryId, purchaseDate: toDate(today), totalAmount: value.negated().toFixed(4), installments: 1, refundOfId: id, reason: input.reason },
      });
      await tx.purchaseInstallment.create({ data: { userId, purchaseId: r.id, invoiceId: inv.id, number: 1, total: 1, amount: value.negated().toFixed(4), competenceDate: toDate(today), categoryId: original.categoryId } });
      return r;
    });
    await AuditModel.record({ userId, action: 'card_purchase.refund', entity: 'card_purchase', entityId: refund.id, after: { originalId: id, amount: value.toFixed(2), reason: input.reason } });
    return toPublic(await load(userId, refund.id));
  },
};
