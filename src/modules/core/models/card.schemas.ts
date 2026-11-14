import { z } from 'zod';
import { amount, dateStr } from './finance.schemas.js';

const uuid = z.string().uuid();
const day = z.coerce.number().int().min(1).max(31);
const optStr = (max: number) => z.string().trim().max(max).optional();

export const cardCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  issuer: optStr(60),
  brand: z.enum(['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra']).optional(),
  holder: optStr(80),
  last4: z.string().regex(/^\d{4}$/, 'Informe só os 4 últimos dígitos').optional(),
  limit: amount,
  closingDay: day,
  dueDay: day,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  limitPolicy: z.enum(['CONSERVATIVE', 'INVOICE_ONLY']).default('CONSERVATIVE'),
  notes: optStr(500),
});
export const cardUpdateSchema = cardCreateSchema.omit({ limit: true, closingDay: true, dueDay: true }).partial();
export const limitAdjustSchema = z.object({ limit: amount, reason: z.string().trim().min(3, 'Informe a justificativa').max(200) });
export const cardStatusSchema = z.object({ status: z.enum(['ACTIVE', 'BLOCKED', 'CANCELED', 'ARCHIVED']) });

export const purchaseCreateSchema = z.object({
  cardId: uuid,
  description: z.string().trim().min(1).max(120),
  establishment: optStr(80),
  categoryId: uuid.optional(),
  purchaseDate: dateStr.optional(),
  amount,
  installments: z.coerce.number().int().min(1).max(48).default(1),
  notes: optStr(500),
  /** Obrigatória para lançar numa fatura que já fechou (RN040): fica no histórico. */
  reason: optStr(200),
});
export const refundSchema = z.object({ amount: amount.optional(), reason: z.string().trim().min(3, 'Informe o motivo do estorno').max(200) });
export const payInvoiceSchema = z.object({ walletId: uuid, amount, date: dateStr.optional(), fees: amount.optional() });
export const invoiceListQuery = z.object({ from: z.coerce.number().int().min(-24).max(0).default(-3), to: z.coerce.number().int().min(0).max(24).default(3) });

export type CardCreate = z.infer<typeof cardCreateSchema>;
export type PurchaseCreate = z.infer<typeof purchaseCreateSchema>;
