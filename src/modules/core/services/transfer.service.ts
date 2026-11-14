import { prisma } from '../../../shared/database.js';
import { notFound, unprocessable } from '../../../shared/errors.js';
import { money } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { LedgerModel } from '../models/ledger.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { TransferModel, toPublicTransfer } from '../models/transfer.model.js';
import { activeWallet, dateOrToday, todayOf } from './context.js';
import { toDate } from '../models/finance.schemas.js';

export const TransferService = {
  /**
   * Transferência entre carteiras próprias: saída na origem e entrada no destino, ligadas ao mesmo evento
   * (RN014). Não é receita nem despesa (RN015). A taxa, se houver, é uma despesa à parte (RN016/017).
   */
  async create(userId: string, input: { fromWalletId: string; toWalletId: string; amount: string; date?: string | undefined; notes?: string | undefined; fee?: string | undefined }) {
    const [from, to] = await Promise.all([activeWallet(userId, input.fromWalletId), activeWallet(userId, input.toWalletId)]);
    const date = await dateOrToday(userId, input.date);

    const transfer = await prisma.$transaction(async (tx) => {
      const t = await TransferModel.create(tx, { userId, fromWalletId: from.id, toWalletId: to.id, amount: input.amount, date, notes: input.notes ?? null });
      const base = { userId, effectiveDate: date, transferId: t.id };
      await LedgerModel.post(tx, { ...base, walletId: from.id, amount: money(input.amount).negated().toFixed(4), kind: 'TRANSFER_OUT', description: `Transferência para ${to.name}` });
      await LedgerModel.post(tx, { ...base, walletId: to.id, amount: money(input.amount).toFixed(4), kind: 'TRANSFER_IN', description: `Transferência de ${from.name}` });

      if (input.fee) {
        const feeTx = await TransactionModel.create(tx, { userId, type: 'EXPENSE', description: 'Taxa de transferência', walletId: from.id, plannedAmount: input.fee, paidAmount: input.fee, status: 'SETTLED', competenceDate: date, paidDate: date });
        await LedgerModel.post(tx, { userId, walletId: from.id, amount: money(input.fee).negated().toFixed(4), kind: 'EXPENSE', effectiveDate: date, description: 'Taxa de transferência', transactionId: feeTx.id, transferId: t.id });
        return tx.transfer.update({ where: { id: t.id }, data: { feeTxId: feeTx.id } });
      }
      return t;
    });
    await AuditModel.record({ userId, action: 'transfer.create', entity: 'transfer', entityId: transfer.id, after: { from: from.name, to: to.name, amount: input.amount, fee: input.fee ?? null } });
    return toPublicTransfer(transfer);
  },

  /** Cancelar estorna as duas pernas (e a taxa) e preserva o histórico. */
  async cancel(userId: string, id: string) {
    const t = await TransferModel.find(userId, id);
    if (!t) throw notFound('Transferência');
    if (t.canceledAt) throw unprocessable('Transferência já está cancelada');
    const date = toDate(await todayOf(userId));
    const updated = await prisma.$transaction(async (tx) => {
      await LedgerModel.reverse(tx, await LedgerModel.openEntries(tx, { transferId: id }), date, 'Estorno de transferência');
      if (t.feeTxId) await TransactionModel.update(tx, t.feeTxId, { status: 'CANCELED', canceledAt: new Date() });
      return TransferModel.cancel(tx, id);
    });
    await AuditModel.record({ userId, action: 'transfer.cancel', entity: 'transfer', entityId: id });
    return toPublicTransfer(updated);
  },
};
