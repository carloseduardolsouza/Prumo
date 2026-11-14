import { prisma } from '../../../shared/database.js';
import { addDays } from '../../../shared/dates.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { DashboardModel } from '../models/dashboard.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { todayOf } from './context.js';
import type { CalendarEvent, CalendarSource } from './calendar.service.js';

export interface DebtDue {
  id: string;
  kind: 'financing' | 'consortium';
  contractId: string;
  name: string;
  number: number;
  of: number;
  dueDate: string;
  amount: string;
}

/** Parcelas pendentes de financiamentos e consórcios ativos com vencimento no intervalo (from = null: inclui atrasadas). */
export async function pendingDebtDues(userId: string, from: string | null, to: string): Promise<DebtDue[]> {
  const range = { ...(from ? { gte: toDate(from) } : {}), lte: toDate(to) };
  const [fin, con] = await Promise.all([
    prisma.financingInstallment.findMany({ where: { userId, status: 'PENDING', dueDate: range, financing: { status: 'ACTIVE' } }, include: { financing: { select: { id: true, name: true, installments: true } } } }),
    prisma.consortiumInstallment.findMany({ where: { userId, status: 'PENDING', dueDate: range, consortium: { status: { in: ['ACTIVE', 'CONTEMPLATED'] } } }, include: { consortium: { select: { id: true, name: true, installments: true } } } }),
  ]);
  return [
    ...fin.map((i) => ({ id: i.id, kind: 'financing' as const, contractId: i.financingId, name: i.financing.name, number: i.number, of: i.financing.installments, dueDate: fromDate(i.dueDate), amount: toMoneyString(i.total.toString()) })),
    ...con.map((i) => ({ id: i.id, kind: 'consortium' as const, contractId: i.consortiumId, name: i.consortium.name, number: i.number, of: i.consortium.installments, dueDate: fromDate(i.dueDate), amount: toMoneyString(i.amount.toString()) })),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Eventos de dívidas na agenda: parcelas, assembleias de consórcio e parcelas pagas. */
export const debtCalendarSource: CalendarSource = async (userId, from, to, today) => {
  const [pending, paidFin, paidCon, assemblies] = await Promise.all([
    pendingDebtDues(userId, from, to),
    prisma.financingInstallment.findMany({ where: { userId, status: 'PAID', paidDate: { gte: toDate(from), lte: toDate(to) } }, include: { financing: { select: { name: true, installments: true } } } }),
    prisma.consortiumInstallment.findMany({ where: { userId, status: 'PAID', paidDate: { gte: toDate(from), lte: toDate(to) } }, include: { consortium: { select: { name: true, installments: true } } } }),
    prisma.consortium.findMany({ where: { userId, status: 'ACTIVE', nextAssemblyDate: { gte: toDate(from), lte: toDate(to) } }, select: { id: true, name: true, groupNumber: true, quota: true, nextAssemblyDate: true } }),
  ]);
  const ev: CalendarEvent[] = [];
  for (const d of pending) ev.push({ id: d.id, date: d.dueDate, kind: d.kind, title: `${d.kind === 'financing' ? 'Financiamento' : 'Consórcio'} ${d.name} ${d.number}/${d.of}`, info: d.kind === 'financing' ? 'Parcela' : 'Contribuição', amount: d.amount, status: d.dueDate < today ? 'overdue' : 'planned', href: '/dividas' });
  for (const i of paidFin) ev.push({ id: i.id, date: fromDate(i.paidDate!), kind: 'financing', title: `Financiamento ${i.financing.name} ${i.number}/${i.financing.installments}`, info: 'Parcela paga', amount: toMoneyString(i.paidAmount.toString()), status: 'settled', href: '/dividas' });
  for (const i of paidCon) ev.push({ id: i.id, date: fromDate(i.paidDate!), kind: 'consortium', title: `Consórcio ${i.consortium.name} ${i.number}/${i.consortium.installments}`, info: 'Contribuição paga', amount: toMoneyString(i.paidAmount.toString()), status: 'settled', href: '/dividas' });
  for (const a of assemblies) ev.push({ id: `${a.id}-assembleia`, date: fromDate(a.nextAssemblyDate!), kind: 'consortium', title: `Assembleia do consórcio`, info: [a.name, a.groupNumber ? `Grupo ${a.groupNumber}` : null, a.quota ? `cota ${a.quota}` : null].filter(Boolean).join(' · '), amount: null, status: 'planned', href: '/dividas' });
  return ev;
};

/**
 * Resumo para a tela de dívidas e para a saúde financeira: saldo devedor estimado, parcelas dos próximos 30 dias,
 * peso na renda e juros pagos. Valores de saldo são estimativas (RN044).
 */
export async function debtSummary(userId: string) {
  const today = await todayOf(userId);
  const horizon = addDays(today, 30);
  const [fin, pending, dues, interest] = await Promise.all([
    prisma.financingInstallment.aggregate({ where: { userId, status: 'PENDING', financing: { status: 'ACTIVE' } }, _sum: { principal: true } }),
    prisma.consortiumInstallment.aggregate({ where: { userId, status: 'PENDING', consortium: { status: { in: ['ACTIVE', 'CONTEMPLATED'] } } }, _sum: { amount: true } }),
    pendingDebtDues(userId, null, horizon),
    prisma.financingInstallment.aggregate({ where: { userId, status: 'PAID' }, _sum: { interest: true } }),
  ]);
  const monthlyDue = dues.reduce((s, d) => s.plus(d.amount), money(0));
  // Renda média dos últimos 90 dias (efetivada) para o peso das parcelas.
  const incomeRows = (await DashboardModel.paidRows(userId, toDate(addDays(today, -90)), toDate(today))).filter((r) => r.type === 'INCOME');
  const avgIncome = incomeRows.reduce((s, r) => s.plus(r.paidAmount.toString()), money(0)).dividedBy(3);
  return {
    estimatedBalance: toMoneyString(fin._sum.principal?.toString() ?? 0),
    isEstimate: true,
    consortiumObligations: toMoneyString(pending._sum.amount?.toString() ?? 0),
    monthlyPayments: toMoneyString(monthlyDue),
    incomeCommittedPercent: avgIncome.isZero() ? null : Math.round(monthlyDue.dividedBy(avgIncome).times(1000).toNumber()) / 10,
    interestPaid: toMoneyString(interest._sum.interest?.toString() ?? 0),
    overdueCount: dues.filter((d) => d.dueDate < today).length,
    note: 'Saldos são estimativas do app, não o saldo oficial do credor. Peso na renda usa a média de receitas efetivadas dos últimos 90 dias.',
  };
}
