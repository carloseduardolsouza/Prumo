import { prisma } from '../../../shared/database.js';
import { addDays } from '../../../shared/dates.js';
import { emit } from '../../../shared/events-publisher.js';
import { createLogger } from '../../../shared/logger.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { CardModel } from '../models/card.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { CalendarService } from '../services/calendar.service.js';
import { CardService, invoiceDto } from '../services/card.service.js';
import { todayOf } from '../services/context.js';
import { RecurringService } from '../services/recurring.service.js';
import { pendingDebtDues } from '../services/debt-cash.js';
import { upcomingDividendReminders } from '../services/investment.service.js';
import { budgetAlerts } from '../services/budget.service.js';

const log = createLogger('jobs');
const br = (d: string) => d.split('-').reverse().join('/');
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export interface ReminderStats { users: number; materialized: number; events: number }

/**
 * Gera as ocorrências recorrentes e publica os avisos (vencimentos, faturas, limite, saldo negativo).
 * Idempotente: cada aviso tem uma chave única (item + data) e o message ignora repetições (RNF027).
 * shortcut: percorre todos os usuários ativos a cada execução; com muitos usuários, particionar por fila.
 */
export async function runReminders(onlyUserId?: string): Promise<ReminderStats> {
  const users = await prisma.user.findMany({ where: { status: { in: ['ACTIVE', 'PENDING_EMAIL'] }, ...(onlyUserId ? { id: onlyUserId } : {}) }, select: { id: true } });
  const stats: ReminderStats = { users: users.length, materialized: 0, events: 0 };
  const send = async (...args: Parameters<typeof emit>) => { stats.events++; await emit(...args); };

  for (const { id: userId } of users) {
    try {
      stats.materialized += await RecurringService.materialize(userId);
      const today = await todayOf(userId);
      const pref = await prisma.notificationPreference.findUnique({ where: { userId }, select: { leadDays: true } });
      const lead = pref?.leadDays ?? 3;

      // Contas a pagar próximas do vencimento
      const soon = await prisma.financialTransaction.findMany({ where: { userId, type: 'EXPENSE', status: { in: ['PLANNED', 'PARTIAL'] }, dueDate: { gte: toDate(today), lte: toDate(addDays(today, lead)) } }, select: { id: true, description: true, plannedAmount: true, paidAmount: true, dueDate: true } });
      for (const t of soon) {
        const due = fromDate(t.dueDate!);
        await send('bill.due_soon', userId, `bill.due_soon__${t.id}__${due}`, { name: t.description, amount: toMoneyString(money(t.plannedAmount.toString()).minus(t.paidAmount.toString())), dueDate: br(due), days: daysBetween(today, due) });
      }

      // Receitas previstas que passaram do dia sem serem confirmadas
      const late = await prisma.financialTransaction.findMany({ where: { userId, type: 'INCOME', status: 'PLANNED', dueDate: { lt: toDate(today) } }, select: { id: true, description: true, plannedAmount: true, dueDate: true }, take: 20 });
      for (const t of late) await send('income.not_received', userId, `income.not_received__${t.id}`, { name: t.description, amount: toMoneyString(t.plannedAmount.toString()), dueDate: br(fromDate(t.dueDate!)) });

      // Faturas a vencer e vencidas
      const invs = await CardModel.invoicesDueBetween(userId, null, toDate(addDays(today, lead)));
      const totals = invs.length ? await CardModel.totalsOfInvoices(invs.map((i) => i.id)) : new Map();
      const cardNames = new Map((await prisma.creditCard.findMany({ where: { userId }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
      for (const i of invs) {
        const dto = invoiceDto(i, totals.get(i.id), today);
        if (money(dto.remaining).lte(0)) continue;
        const card = cardNames.get(i.cardId) ?? 'cartão';
        if (dto.status === 'overdue') await send('invoice.overdue', userId, `invoice.overdue__${i.id}`, { card, amount: dto.remaining, dueDate: br(dto.dueDate) });
        else if (dto.status !== 'open') await send('invoice.due_soon', userId, `invoice.due_soon__${i.id}__${dto.dueDate}`, { card, amount: dto.remaining, days: daysBetween(today, dto.dueDate) });
      }

      // Parcelas de financiamentos e consórcios
      for (const d of await pendingDebtDues(userId, today, addDays(today, lead))) {
        const type = d.kind === 'financing' ? 'financing.installment_due_soon' : 'consortium.installment_due_soon';
        await send(type, userId, `${type}__${d.id}__${d.dueDate}`, { name: d.name, amount: d.amount, days: daysBetween(today, d.dueDate) });
      }

      stats.events += await upcomingDividendReminders(userId, today, lead);
      stats.events += await budgetAlerts(userId);

      // Limite do cartão próximo do máximo (1 aviso por cartão por mês)
      for (const c of (await CardService.list(userId)).cards) {
        if (c.status === 'ACTIVE' && (c.summary?.usedPercent ?? 0) >= 90) await send('card.limit_near', userId, `card.limit_near__${c.id}__${today.slice(0, 7)}`, { card: c.name, percent: Math.round(c.summary!.usedPercent) });
      }

      // Saldo projetado negativo nos próximos 30 dias
      const proj = await CalendarService.projection(userId, { days: 30 });
      if (proj.firstNegative) await send('balance.projected_negative', userId, `balance.projected_negative__${userId}__${proj.firstNegative.date}`, { wallet: 'Saldo total', amount: proj.firstNegative.balance, date: br(proj.firstNegative.date) });
    } catch (e) {
      log.error('falha ao processar lembretes do usuário', { userId, message: (e as Error).message });
    }
  }
  return stats;
}

const HOUR = 3_600_000;

/** Agenda a execução periódica (a cada hora, com a primeira execução logo após subir). Desligue com JOBS_ENABLED=false. */
export function startJobs(): void {
  const tick = () => runReminders().then((s) => log.info('lembretes executados', { ...s })).catch((e) => log.error('lembretes falharam', { message: (e as Error).message }));
  setTimeout(tick, 20_000).unref();
  setInterval(tick, HOUR).unref();
}
