// Eventos publicados pelo core e consumidos pelo serviço message (fila "notifications").
export const EVENT_TYPES = [
  'user.registered',
  'user.password_reset_requested',
  'bill.due_soon',
  'invoice.due_soon',
  'invoice.overdue',
  'financing.installment_due_soon',
  'consortium.installment_due_soon',
  'income.not_received',
  'card.limit_near',
  'budget.threshold',
  'goal.reached',
  'balance.projected_negative',
  'subscription.price_increased',
  'investment.dividend_incoming',
  'investment.price_target_hit',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface DomainEvent<P = Record<string, unknown>> {
  type: EventType;
  userId: string;
  payload: P;
  /** Chave única do fato (ex.: "invoice.due_soon:<invoiceId>:2026-11-20"); evita notificar duas vezes. */
  dedupeKey: string;
  occurredAt: string;
}
