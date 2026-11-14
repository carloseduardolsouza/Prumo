import { prisma } from '../../../shared/database.js';
import { addDays } from '../../../shared/dates.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { CardModel } from '../models/card.model.js';
import { DashboardModel } from '../models/dashboard.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { TransactionModel, statusToApi } from '../models/transaction.model.js';
import { TransferModel } from '../models/transfer.model.js';
import { invoiceDto } from './card.service.js';
import { todayOf } from './context.js';
import { pendingDebtDues } from './debt-cash.js';
import { projectBalance, type CashEvent } from './recurrence.js';

export type CalendarKind = 'income' | 'expense' | 'invoice' | 'transfer' | 'financing' | 'consortium' | 'investment';

export interface CalendarEvent {
  id: string;
  date: string;
  kind: CalendarKind;
  title: string;
  info: string;
  /** Valor sempre positivo; o sinal vem do `kind`. null quando o valor ainda não está confirmado. */
  amount: string | null;
  status: 'settled' | 'planned' | 'partial' | 'overdue';
  href?: string;
}

/** Fontes extras de eventos (dívidas, consórcios, investimentos) se registram aqui nas próximas entregas. */
export type CalendarSource = (userId: string, from: string, to: string, today: string) => Promise<CalendarEvent[]>;
export const calendarSources: CalendarSource[] = [];

export const CalendarService = {
  /** Agenda consolidada: cada fato aparece uma vez, sem duplicar impacto (RN069). Previsto e efetivado se distinguem (RN070). */
  async events(userId: string, from: string, to: string) {
    const today = await todayOf(userId);
    const [txs, transfers, invs, names] = await Promise.all([
      TransactionModel.inRange(userId, toDate(from), toDate(to)),
      TransferModel.inRange(userId, toDate(from), toDate(to)),
      CardModel.invoicesDueBetween(userId, toDate(from), toDate(to)),
      DashboardModel.walletNames(userId),
    ]);
    const totals = invs.length ? await CardModel.totalsOfInvoices(invs.map((i) => i.id)) : new Map();
    const cards = invs.length ? new Map((await prisma.creditCard.findMany({ where: { id: { in: invs.map((i) => i.cardId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name])) : new Map();

    const events: CalendarEvent[] = [];
    for (const t of txs) {
      const date = fromDate(t.paidDate ?? t.dueDate ?? t.competenceDate);
      const status = statusToApi(t.status) as 'planned' | 'partial' | 'settled';
      events.push({
        id: t.id, date, kind: t.type === 'INCOME' ? 'income' : 'expense', title: t.description,
        info: [t.category?.name, t.walletId ? names.get(t.walletId) : null].filter(Boolean).join(' · ') || 'Sem categoria',
        amount: toMoneyString((status === 'planned' ? t.plannedAmount : t.paidAmount).toString()), status: status !== 'settled' && date < today ? 'overdue' : status, href: `/movimentacao?id=${t.id}`,
      });
    }
    for (const tr of transfers) {
      events.push({ id: tr.id, date: fromDate(tr.date), kind: 'transfer', title: `${names.get(tr.fromWalletId) ?? '?'} → ${names.get(tr.toWalletId) ?? '?'}`, info: 'Transferência entre contas', amount: toMoneyString(tr.amount.toString()), status: 'settled' });
    }
    for (const i of invs) {
      const dto = invoiceDto(i, totals.get(i.id), today);
      if (money(dto.total).isZero()) continue;
      events.push({ id: i.id, date: dto.dueDate, kind: 'invoice', title: `Fatura ${cards.get(i.cardId) ?? ''}`.trim(), info: `Cartão · ${dto.status === 'open' ? 'aberta' : dto.status === 'paid' ? 'paga' : dto.status === 'overdue' ? 'vencida' : 'fechada'}`, amount: dto.status === 'paid' ? dto.total : dto.remaining, status: dto.status === 'paid' ? 'settled' : dto.status === 'overdue' ? 'overdue' : 'planned', href: `/fatura?cardId=${i.cardId}` });
    }
    for (const src of calendarSources) events.push(...(await src(userId, from, to, today)));

    events.sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1));
    const days: Record<string, { count: number; kinds: CalendarKind[] }> = {};
    for (const e of events) {
      const d = (days[e.date] ??= { count: 0, kinds: [] });
      d.count++;
      if (!d.kinds.includes(e.kind)) d.kinds.push(e.kind);
    }
    return { from, to, today, events, days };
  },

  /**
   * Projeção de saldo (RF062/063): saldo atual + somente eventos AINDA NÃO efetivados (previstos, parcelas
   * de fatura a vencer). Atrasados entram hoje. Efetivar um previsto o tira daqui automaticamente (RN072).
   */
  async projection(userId: string, opts: { days: number; walletId?: string | undefined; changes?: { date: string; amount: string; description?: string | undefined }[] | undefined }) {
    const today = await todayOf(userId);
    const to = addDays(today, opts.days);
    const bal = opts.walletId
      ? (await prisma.wallet.findFirst({ where: { id: opts.walletId, userId }, select: { cachedBalance: true } }))?.cachedBalance.toString() ?? '0'
      : (await DashboardModel.activeBalance(userId))._sum.cachedBalance?.toString() ?? '0';

    const [open, invs] = await Promise.all([
      prisma.financialTransaction.findMany({ where: { userId, status: { in: ['PLANNED', 'PARTIAL'] }, dueDate: { lte: toDate(to) }, ...(opts.walletId ? { walletId: opts.walletId } : {}) }, select: { type: true, plannedAmount: true, paidAmount: true, dueDate: true } }),
      opts.walletId ? Promise.resolve([]) : CardModel.invoicesDueBetween(userId, null, toDate(to)),
    ]);
    const events: CashEvent[] = [];
    for (const t of open) {
      const rem = money(t.plannedAmount.toString()).minus(t.paidAmount.toString()).times(100).toNumber();
      events.push({ date: fromDate(t.dueDate!), cents: Math.round(t.type === 'INCOME' ? rem : -rem) });
    }
    const totals = invs.length ? await CardModel.totalsOfInvoices(invs.map((i) => i.id)) : new Map();
    for (const i of invs) {
      const t = totals.get(i.id);
      const rem = money(t?.total ?? 0).minus(t?.paid ?? 0);
      if (rem.gt(0)) events.push({ date: fromDate(i.dueDate), cents: -Math.round(rem.times(100).toNumber()) });
    }
    if (!opts.walletId) {
      for (const d of await pendingDebtDues(userId, null, to)) events.push({ date: d.dueDate, cents: -Math.round(Number(d.amount) * 100) });
    }
    const simulated = (opts.changes ?? []).map((c) => ({ date: c.date, cents: Math.round(Number(c.amount) * 100) }));
    const { points, min, firstNegative } = projectBalance(Math.round(money(bal).times(100).toNumber()), [...events, ...simulated], today, to);
    const fmt = (c: number) => toMoneyString(money(c).dividedBy(100));
    return {
      from: today, to, startBalance: toMoneyString(bal),
      days: points.map((p) => ({ date: p.date, balance: fmt(p.balanceCents) })),
      endBalance: fmt(points.at(-1)!.balanceCents),
      lowest: { date: min.date, balance: fmt(min.balanceCents) },
      firstNegative: firstNegative ? { date: firstNegative.date, balance: fmt(firstNegative.balanceCents) } : null,
      negativeDays: points.filter((p) => p.balanceCents < 0).length,
      simulated: simulated.length,
      assumptions: 'Estimativa: parte do saldo atual e considera só eventos previstos e faturas a vencer, sem garantia de saldo futuro. Contas atrasadas entram hoje.',
    };
  },
};
