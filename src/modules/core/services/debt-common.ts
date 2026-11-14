import { prisma } from '../../../shared/database.js';
import type { Decimal } from 'decimal.js';
import { money } from '../../../shared/money.js';
import { toDate } from '../models/finance.schemas.js';
import { LedgerModel, type Tx } from '../models/ledger.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { nthOccurrence } from './recurrence.js';

/** Categoria padrão das parcelas de dívidas; criada na primeira necessidade. */
export async function debtCategoryId(userId: string): Promise<string> {
  const name = 'Financiamentos e consórcios';
  const found = await prisma.category.findFirst({ where: { userId, type: 'EXPENSE', name, parentId: null } });
  if (found) return found.id;
  return (await prisma.category.create({ data: { userId, type: 'EXPENSE', name, icon: 'bank', color: '#E5484D' } })).id;
}

/** Datas de vencimento mensais a partir da primeira, com o dia de referência ajustado a meses curtos. */
export const monthlyDueDates = (firstDueDate: string, dueDay: number, n: number): string[] =>
  Array.from({ length: n }, (_, k) => nthOccurrence({ frequency: 'MONTHLY', startDate: firstDueDate, dayOfMonth: dueDay }, k));

/** Registra uma saída de dinheiro de dívida como despesa efetivada + lançamento no ledger (RN045). */
export async function postDebtExpense(tx: Tx, p: { userId: string; walletId: string; amount: Decimal.Value; description: string; date: string; categoryId: string }) {
  const value = money(p.amount);
  const t = await TransactionModel.create(tx, { userId: p.userId, type: 'EXPENSE', status: 'SETTLED', description: p.description, categoryId: p.categoryId, walletId: p.walletId, plannedAmount: value.toFixed(4), paidAmount: value.toFixed(4), competenceDate: toDate(p.date), paidDate: toDate(p.date) });
  await LedgerModel.post(tx, { userId: p.userId, walletId: p.walletId, amount: value.negated().toFixed(4), kind: 'EXPENSE', effectiveDate: toDate(p.date), description: p.description, transactionId: t.id });
  return t;
}

/** Estorna uma despesa de dívida registrada acima (cancelar pagamento). */
export async function reverseDebtExpense(tx: Tx, transactionId: string | null | undefined, date: string, reason: string) {
  if (!transactionId) return;
  await LedgerModel.reverse(tx, await LedgerModel.openEntries(tx, { transactionId }), toDate(date), reason);
  await TransactionModel.update(tx, transactionId, { status: 'CANCELED', canceledAt: new Date() });
}
