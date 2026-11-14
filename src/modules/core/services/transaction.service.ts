import type { FinancialTransaction, TxType } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import { notFound, unprocessable } from '../../../shared/errors.js';
import { money } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { CategoryModel } from '../models/category.model.js';
import { toDate, type TxCreate, type TxUpdate } from '../models/finance.schemas.js';
import { LedgerModel, type Tx } from '../models/ledger.model.js';
import { TransactionModel, toPublicTransaction } from '../models/transaction.model.js';
import { activeWallet, dateOrToday, todayOf } from './context.js';
import { CategoryService } from './category.service.js';
import { checkSubscriptionIncrease } from './subscription-alerts.js';

const signed = (type: TxType, value: string) => (type === 'INCOME' ? money(value) : money(value).negated()).toFixed(4);

async function checkCategory(userId: string, categoryId: string | undefined | null, type: TxType) {
  if (!categoryId) return;
  const c = await CategoryModel.find(userId, categoryId);
  if (!c || c.archivedAt) throw notFound('Categoria');
  if (c.type !== type) throw unprocessable('A categoria precisa ser do mesmo tipo do lançamento (receita ou despesa)');
}

/** Registra um pagamento/recebimento: ledger + soma no lançamento (status PARTIAL ou SETTLED). */
async function applyPayment(tx: Tx, t: FinancialTransaction, walletId: string, value: string, date: Date) {
  await LedgerModel.post(tx, {
    userId: t.userId, walletId, amount: signed(t.type, value), kind: t.type === 'INCOME' ? 'INCOME' : 'EXPENSE', effectiveDate: date, description: t.description, transactionId: t.id,
  });
  const paid = money(t.paidAmount.toString()).plus(value);
  return TransactionModel.update(tx, t.id, { paidAmount: paid.toFixed(4), paidDate: date, walletId, status: paid.gte(t.plannedAmount.toString()) ? 'SETTLED' : 'PARTIAL' });
}

async function loadOwned(userId: string, id: string) {
  const t = await TransactionModel.find(userId, id);
  if (!t) throw notFound('Lançamento');
  return t;
}

export const TransactionService = {
  async create(userId: string, input: TxCreate) {
    await CategoryService.ensureDefaults(userId);
    await checkCategory(userId, input.categoryId, input.type);
    if (input.walletId) await activeWallet(userId, input.walletId);

    const today = await todayOf(userId);
    const competence = toDate(input.competenceDate ?? input.paidDate ?? today);
    const due = input.dueDate ? toDate(input.dueDate) : input.settled ? null : competence;

    const created = await prisma.$transaction(async (tx) => {
      const t = await TransactionModel.create(tx, {
        userId, type: input.type, description: input.description, categoryId: input.categoryId ?? null, walletId: input.walletId ?? null,
        plannedAmount: input.amount, competenceDate: competence, dueDate: due, notes: input.notes ?? null,
      });
      return input.settled ? applyPayment(tx, t, input.walletId!, input.amount, toDate(input.paidDate ?? today)) : t;
    });
    await AuditModel.record({ userId, action: 'transaction.create', entity: 'transaction', entityId: created.id, after: { type: created.type, amount: input.amount, status: created.status } });
    return toPublicTransaction(created);
  },

  get: async (userId: string, id: string) => toPublicTransaction(await loadOwned(userId, id)),

  /** Confirma pagamento/recebimento, total ou parcial (RN020/021/026). */
  async settle(userId: string, id: string, input: { walletId: string; amount?: string | undefined; date?: string | undefined }) {
    const t = await loadOwned(userId, id);
    if (t.status === 'CANCELED') throw unprocessable('Lançamento cancelado não pode ser efetivado');
    if (t.status === 'SETTLED') throw unprocessable('Lançamento já está efetivado');
    await activeWallet(userId, input.walletId);

    const remaining = money(t.plannedAmount.toString()).minus(t.paidAmount.toString());
    const value = input.amount ? money(input.amount) : remaining;
    if (value.gt(remaining)) throw unprocessable(`O valor excede o que falta (${remaining.toFixed(2)})`);
    const date = await dateOrToday(userId, input.date);

    const updated = await prisma.$transaction((tx) => applyPayment(tx, t, input.walletId, value.toFixed(2), date));
    if (updated.status === 'SETTLED') await checkSubscriptionIncrease(updated);
    await AuditModel.record({ userId, action: 'transaction.settle', entity: 'transaction', entityId: id, after: { amount: value.toFixed(2), walletId: input.walletId, status: updated.status } });
    return toPublicTransaction(updated);
  },

  async update(userId: string, id: string, patch: TxUpdate) {
    const t = await loadOwned(userId, id);
    if (t.status === 'CANCELED') throw unprocessable('Lançamento cancelado não pode ser editado');
    await checkCategory(userId, patch.categoryId, t.type);

    const financial = patch.amount !== undefined || patch.walletId !== undefined || patch.paidDate !== undefined;
    if (financial && t.status === 'PARTIAL') throw unprocessable('Pagamento parcial em andamento: cancele o lançamento e crie outro');
    if (patch.amount && t.status === 'PLANNED' && money(patch.amount).lt(0)) throw unprocessable('Valor inválido');
    if (patch.walletId) await activeWallet(userId, patch.walletId);

    const base = {
      ...(patch.description ? { description: patch.description } : {}),
      ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.competenceDate ? { competenceDate: toDate(patch.competenceDate) } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ? toDate(patch.dueDate) : null } : {}),
    };

    const updated = await prisma.$transaction(async (tx) => {
      if (t.status === 'PLANNED') {
        return TransactionModel.update(tx, id, { ...base, ...(patch.amount ? { plannedAmount: patch.amount } : {}), ...(patch.walletId ? { walletId: patch.walletId } : {}) });
      }
      // Efetivado: se valor, carteira ou data mudam, estorna o lançamento antigo e refaz (ledger imutável, RN008).
      if (financial) {
        const date = patch.paidDate ? toDate(patch.paidDate) : t.paidDate ?? toDate(await todayOf(userId));
        await LedgerModel.reverse(tx, await LedgerModel.openEntries(tx, { transactionId: id }), date, 'Estorno por edição');
        const reset = await TransactionModel.update(tx, id, { ...base, plannedAmount: patch.amount ?? t.plannedAmount, paidAmount: 0, status: 'PLANNED', walletId: patch.walletId ?? t.walletId });
        return applyPayment(tx, reset, patch.walletId ?? t.walletId!, patch.amount ?? reset.plannedAmount.toString(), date);
      }
      return TransactionModel.update(tx, id, base);
    });
    await AuditModel.record({ userId, action: 'transaction.update', entity: 'transaction', entityId: id, before: { amount: t.plannedAmount.toString(), description: t.description }, after: { amount: updated.plannedAmount.toString(), description: updated.description } });
    return toPublicTransaction(updated);
  },

  /** "Excluir" é cancelar: estorna o que já movimentou e preserva o histórico (RN008). */
  async cancel(userId: string, id: string) {
    const t = await loadOwned(userId, id);
    if (t.status === 'CANCELED') throw unprocessable('Lançamento já está cancelado');
    const date = toDate(await todayOf(userId));
    const updated = await prisma.$transaction(async (tx) => {
      await LedgerModel.reverse(tx, await LedgerModel.openEntries(tx, { transactionId: id }), date, 'Estorno por cancelamento');
      return TransactionModel.update(tx, id, { status: 'CANCELED', canceledAt: new Date() });
    });
    await AuditModel.record({ userId, action: 'transaction.cancel', entity: 'transaction', entityId: id, before: { status: t.status, paid: t.paidAmount.toString() } });
    return toPublicTransaction(updated);
  },
};
