import { prisma } from '../../../shared/database.js';
import { emit } from '../../../shared/events-publisher.js';
import { toMoneyString } from '../../../shared/money.js';

/**
 * Chamado quando uma ocorrência recorrente é efetivada: se for assinatura e o valor subiu em relação à
 * ocorrência anterior, avisa o usuário (spec: "Streaming ficou mais caro").
 */
export async function checkSubscriptionIncrease(tx: { id: string; userId: string; recurrenceRuleId: string | null; paidDate: Date | null; paidAmount: { toString(): string } }) {
  if (!tx.recurrenceRuleId || !tx.paidDate) return;
  const rule = await prisma.recurringRule.findUnique({ where: { id: tx.recurrenceRuleId }, select: { isSubscription: true, description: true } });
  if (!rule?.isSubscription) return;
  const prev = await prisma.financialTransaction.findFirst({
    where: { recurrenceRuleId: tx.recurrenceRuleId, status: 'SETTLED', id: { not: tx.id }, paidDate: { lte: tx.paidDate } },
    orderBy: [{ paidDate: 'desc' }, { updatedAt: 'desc' }],
    select: { paidAmount: true },
  });
  if (!prev || Number(tx.paidAmount.toString()) <= Number(prev.paidAmount.toString())) return;
  await emit('subscription.price_increased', tx.userId, `subscription.price_increased__${tx.id}`, { name: rule.description, from: toMoneyString(prev.paidAmount.toString()), to: toMoneyString(tx.paidAmount.toString()) });
}
