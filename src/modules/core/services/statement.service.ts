import { money, toMoneyString } from '../../../shared/money.js';
import { fromDate, toDate, type StatementQuery } from '../models/finance.schemas.js';
import { TransactionModel, statusToApi } from '../models/transaction.model.js';
import { TransferModel } from '../models/transfer.model.js';
import { WalletModel } from '../models/wallet.model.js';
import { CardModel } from '../models/card.model.js';
import { DashboardModel } from '../models/dashboard.model.js';
import { CategoryService } from './category.service.js';
import { todayOf } from './context.js';

export interface StatementItem {
  id: string;
  kind: 'income' | 'expense' | 'transfer';
  status: 'settled' | 'planned' | 'partial';
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  walletId: string | null;
  walletName: string | null;
  toWalletId: string | null;
  toWalletName: string | null;
  amount: string;
  plannedAmount: string;
  date: string;
  /** Preenchidos quando o item é uma parcela de compra no cartão. */
  via?: 'card';
  purchaseId?: string;
  cardName?: string;
}

/**
 * Extrato unificado: lançamentos e transferências no período, sem duplicar o impacto (RN069).
 * Resumo conta só o efetivado e deixa transferências de fora do resultado (RN015/RN073).
 */
export const StatementService = {
  async get(userId: string, q: StatementQuery) {
    await CategoryService.ensureDefaults(userId);
    const from = toDate(q.from);
    const to = toDate(q.to);

    const wallets = new Map((await WalletModel.list(userId, 'all')).map((w) => [w.id, w.name]));
    const wantTx = q.type !== 'transferencia';
    const wantTransfers = q.type === 'todas' || q.type === 'transferencia';

    const items: StatementItem[] = [];

    if (wantTx) {
      const rows = await TransactionModel.inRange(userId, from, to, {
        ...(q.type === 'receita' ? { type: 'INCOME' as const } : q.type === 'despesa' ? { type: 'EXPENSE' as const } : {}),
        ...(q.walletId ? { walletId: q.walletId } : {}),
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.q ? { description: { contains: q.q, mode: 'insensitive' as const } } : {}),
        ...(q.status === 'settled' ? { status: { in: ['SETTLED' as const, 'PARTIAL' as const] } } : q.status === 'planned' ? { status: { in: ['PLANNED' as const, 'PARTIAL' as const] } } : {}),
      });
      for (const t of rows) {
        const date = t.paidDate ?? t.dueDate ?? t.competenceDate;
        const status = statusToApi(t.status) as StatementItem['status'];
        items.push({
          id: t.id, kind: t.type === 'INCOME' ? 'income' : 'expense', status, description: t.description, categoryId: t.categoryId, categoryName: t.category?.name ?? null,
          walletId: t.walletId, walletName: t.walletId ? wallets.get(t.walletId) ?? null : null, toWalletId: null, toWalletName: null,
          amount: toMoneyString(status === 'planned' ? t.plannedAmount.toString() : t.paidAmount.toString()), plannedAmount: toMoneyString(t.plannedAmount.toString()), date: fromDate(date),
        });
      }
    }

    // Parcelas de compras no cartão: despesa reconhecida pela competência; futura = previsto.
    if (q.type !== 'receita' && q.type !== 'transferencia' && !q.walletId) {
      const today = await todayOf(userId);
      const catName = new Map((await DashboardModel.categories(userId)).map((c) => [c.id, c.name]));
      for (const i of await CardModel.installmentsInRange(userId, from, to)) {
        const date = fromDate(i.competenceDate);
        const status: StatementItem['status'] = date <= today ? 'settled' : 'planned';
        const description = i.total > 1 ? `${i.purchase.description} (${i.number}/${i.total})` : i.purchase.description;
        if ((q.status === 'settled' && status !== 'settled') || (q.status === 'planned' && status !== 'planned')) continue;
        if (q.categoryId && i.categoryId !== q.categoryId) continue;
        if (q.q && !description.toLowerCase().includes(q.q.toLowerCase())) continue;
        const amount = toMoneyString(i.amount.toString());
        items.push({ id: i.id, kind: 'expense', status, description, categoryId: i.categoryId, categoryName: i.categoryId ? catName.get(i.categoryId) ?? null : null, walletId: null, walletName: i.purchase.card.name, toWalletId: null, toWalletName: null, amount, plannedAmount: amount, date, via: 'card', purchaseId: i.purchaseId, cardName: i.purchase.card.name });
      }
    }

    if (wantTransfers && q.status !== 'planned' && !q.categoryId) {
      for (const t of await TransferModel.inRange(userId, from, to)) {
        if (q.walletId && t.fromWalletId !== q.walletId && t.toWalletId !== q.walletId) continue;
        const description = `${wallets.get(t.fromWalletId) ?? '?'} → ${wallets.get(t.toWalletId) ?? '?'}`;
        if (q.q && !description.toLowerCase().includes(q.q.toLowerCase())) continue;
        items.push({
          id: t.id, kind: 'transfer', status: 'settled', description, categoryId: null, categoryName: null,
          walletId: t.fromWalletId, walletName: wallets.get(t.fromWalletId) ?? null, toWalletId: t.toWalletId, toWalletName: wallets.get(t.toWalletId) ?? null,
          amount: toMoneyString(t.amount.toString()), plannedAmount: toMoneyString(t.amount.toString()), date: fromDate(t.date),
        });
      }
    }

    items.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

    let income = money(0), expense = money(0), plannedIncome = money(0), plannedExpense = money(0);
    for (const i of items) {
      if (i.kind === 'transfer') continue;
      const settled = i.status !== 'planned' ? money(i.amount) : money(0);
      const open = money(i.plannedAmount).minus(settled);
      if (i.kind === 'income') { income = income.plus(settled); plannedIncome = plannedIncome.plus(open); }
      else { expense = expense.plus(settled); plannedExpense = plannedExpense.plus(open); }
    }

    const start = (q.page - 1) * q.limit;
    return {
      period: { from: q.from, to: q.to },
      items: items.slice(start, start + q.limit),
      page: q.page,
      limit: q.limit,
      total: items.length,
      summary: {
        income: toMoneyString(income), expense: toMoneyString(expense), result: toMoneyString(income.minus(expense)),
        plannedIncome: toMoneyString(plannedIncome), plannedExpense: toMoneyString(plannedExpense),
      },
      methodology: 'Resumo considera apenas valores efetivados; previstos aparecem à parte; transferências entre carteiras próprias não entram no resultado.',
    };
  },
};
