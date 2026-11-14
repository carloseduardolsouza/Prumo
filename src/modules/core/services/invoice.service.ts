import { prisma } from '../../../shared/database.js';
import { conflict, notFound, unprocessable } from '../../../shared/errors.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { CardModel } from '../models/card.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { LedgerModel } from '../models/ledger.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { shiftYm, cycleForClosingMonth, cycleFor } from './card-cycles.js';
import { invoiceDto, ownedCard } from './card.service.js';
import { activeWallet, dateOrToday, todayOf } from './context.js';

async function loadInvoice(userId: string, id: string) {
  const inv = await CardModel.findInvoice(userId, id);
  if (!inv) throw notFound('Fatura');
  return inv;
}

export const InvoiceService = {
  /** Faturas do cartão numa janela de meses ao redor do ciclo atual; as que ainda não existem aparecem vazias. */
  async list(userId: string, cardId: string, fromOffset: number, toOffset: number) {
    const card = await ownedCard(userId, cardId);
    const today = await todayOf(userId);
    const [existing, totals] = await Promise.all([CardModel.invoices(userId, cardId), CardModel.invoiceTotals(userId, cardId)]);
    const cur = cycleFor(today, card.closingDay, card.dueDay);
    const [cy, cm] = cur.closingDate.split('-').map(Number) as [number, number];

    const out = [];
    for (let off = fromOffset; off <= toOffset; off++) {
      const [y, m] = shiftYm(cy, cm, off);
      const c = cycleForClosingMonth(y, m, card.closingDay, card.dueDay);
      const found = existing.find((i) => i.refYear === c.refYear && i.refMonth === c.refMonth);
      const inv = found ?? ({ id: '', userId, cardId, refYear: c.refYear, refMonth: c.refMonth, startDate: toDate(c.startDate), closingDate: toDate(c.closingDate), dueDate: toDate(c.dueDate), createdAt: new Date() });
      out.push({ ...invoiceDto(inv, found ? totals.get(found.id) : undefined, today), current: c.refYear === cur.refYear && c.refMonth === cur.refMonth });
    }
    return { invoices: out };
  },

  async get(userId: string, id: string) {
    const inv = await loadInvoice(userId, id);
    const today = await todayOf(userId);
    const [items, payments, totals] = await Promise.all([CardModel.invoiceItems(id), CardModel.invoicePayments(id), CardModel.totalsOfInvoices([id])]);
    return {
      invoice: invoiceDto(inv, totals.get(id), today),
      card: { id: inv.card.id, name: inv.card.name, last4: inv.card.last4 },
      purchases: items.map((i) => ({
        installmentId: i.id, purchaseId: i.purchaseId, description: i.purchase.description, establishment: i.purchase.establishment, amount: toMoneyString(i.amount.toString()),
        date: fromDate(i.purchase.purchaseDate), competenceDate: fromDate(i.competenceDate), number: i.number, total: i.total, refund: i.purchase.refundOfId !== null, categoryId: i.categoryId,
      })),
      payments: payments.map((p) => ({ id: p.id, amount: toMoneyString(p.amount.toString()), date: fromDate(p.paidDate), walletId: p.walletId, canceled: p.canceledAt !== null })),
    };
  },

  /** Parcelas futuras por fatura (RF031): o que ainda vai pesar nas próximas faturas. */
  async future(userId: string, cardId: string) {
    const card = await ownedCard(userId, cardId);
    const today = await todayOf(userId);
    const cur = cycleFor(today, card.closingDay, card.dueDay);
    const [invoices, totals] = await Promise.all([CardModel.invoices(userId, cardId), CardModel.invoiceTotals(userId, cardId)]);
    const months = invoices
      .filter((i) => i.refYear * 12 + i.refMonth > cur.refYear * 12 + cur.refMonth)
      .map((i) => ({ refYear: i.refYear, refMonth: i.refMonth, dueDate: fromDate(i.dueDate), amount: toMoneyString(totals.get(i.id)?.total ?? 0) }))
      .filter((m) => !money(m.amount).isZero());
    return { months, total: toMoneyString(months.reduce((s, m) => s.plus(m.amount), money(0))) };
  },

  /**
   * Pagamento da fatura: sai da carteira e baixa a obrigação, SEM criar nova despesa de consumo
   * (RN035/036). Juros, multa e encargos pagos junto entram como despesa à parte (RN038).
   */
  async pay(userId: string, id: string, input: { walletId: string; amount: string; date?: string | undefined; fees?: string | undefined }) {
    const inv = await loadInvoice(userId, id);
    const wallet = await activeWallet(userId, input.walletId);
    const totals = (await CardModel.totalsOfInvoices([id])).get(id);
    const remaining = money(totals?.total ?? 0).minus(totals?.paid ?? 0);
    if (remaining.lte(0)) throw conflict('Esta fatura não tem saldo a pagar');
    const value = money(input.amount);
    if (value.gt(remaining)) throw unprocessable(`O valor excede o saldo da fatura (${remaining.toFixed(2)})`);
    const date = await dateOrToday(userId, input.date);

    const payment = await prisma.$transaction(async (tx) => {
      let feeTxId: string | null = null;
      if (input.fees) {
        const fee = await TransactionModel.create(tx, { userId, type: 'EXPENSE', status: 'SETTLED', description: `Juros e encargos · ${inv.card.name}`, walletId: wallet.id, plannedAmount: input.fees, paidAmount: input.fees, competenceDate: date, paidDate: date });
        await LedgerModel.post(tx, { userId, walletId: wallet.id, amount: money(input.fees).negated().toFixed(4), kind: 'EXPENSE', effectiveDate: date, description: `Juros e encargos · ${inv.card.name}`, transactionId: fee.id });
        feeTxId = fee.id;
      }
      const entry = await LedgerModel.post(tx, { userId, walletId: wallet.id, amount: value.negated().toFixed(4), kind: 'CARD_PAYMENT', effectiveDate: date, description: `Fatura ${inv.card.name} ${String(inv.refMonth).padStart(2, '0')}/${inv.refYear}` });
      return tx.invoicePayment.create({ data: { userId, invoiceId: id, walletId: wallet.id, amount: input.amount, paidDate: date, feeTxId, ledgerEntryId: entry.id } });
    });
    await AuditModel.record({ userId, action: 'invoice.pay', entity: 'invoice', entityId: id, after: { amount: input.amount, fees: input.fees ?? null, walletId: wallet.id } });
    return { payment: { id: payment.id, amount: toMoneyString(payment.amount.toString()), date: fromDate(payment.paidDate) }, ...(await this.get(userId, id)) };
  },

  /** Cancelar pagamento estorna a saída na carteira (e os encargos) e reabre o saldo da fatura. */
  async cancelPayment(userId: string, paymentId: string) {
    const p = await CardModel.findPayment(userId, paymentId);
    if (!p) throw notFound('Pagamento');
    if (p.canceledAt) throw unprocessable('Pagamento já foi cancelado');
    const date = toDate(await todayOf(userId));
    await prisma.$transaction(async (tx) => {
      if (p.ledgerEntryId) {
        const entry = await tx.ledgerEntry.findUnique({ where: { id: p.ledgerEntryId } });
        if (entry) await LedgerModel.reverse(tx, [entry], date, 'Estorno de pagamento de fatura');
      }
      if (p.feeTxId) {
        await LedgerModel.reverse(tx, await LedgerModel.openEntries(tx, { transactionId: p.feeTxId }), date, 'Estorno de encargos de fatura');
        await TransactionModel.update(tx, p.feeTxId, { status: 'CANCELED', canceledAt: new Date() });
      }
      await tx.invoicePayment.update({ where: { id: paymentId }, data: { canceledAt: new Date() } });
    });
    await AuditModel.record({ userId, action: 'invoice.cancel_payment', entity: 'invoice_payment', entityId: paymentId });
    return this.get(userId, p.invoiceId);
  },
};

