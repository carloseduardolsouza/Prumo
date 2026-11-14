import { z } from 'zod';
import { amount, dateStr } from './finance.schemas.js';

const uuid = z.string().uuid();
export const frequencyEnum = z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM']);

export const ruleCreateSchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE']),
    description: z.string().trim().min(1).max(120),
    categoryId: uuid.optional(),
    walletId: uuid.optional(),
    amount,
    frequency: frequencyEnum,
    intervalDays: z.coerce.number().int().min(1).max(3650).optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    startDate: dateStr,
    endDate: dateStr.optional(),
    maxOccurrences: z.coerce.number().int().min(1).max(1200).optional(),
    isSubscription: z.boolean().default(false),
    notes: z.string().trim().max(500).optional(),
    /** Já efetiva a primeira ocorrência (exige walletId): é o "repetir" de uma movimentação paga hoje. */
    settleFirst: z.boolean().default(false),
  })
  .refine((v) => v.frequency !== 'CUSTOM' || !!v.intervalDays, { message: 'Frequência personalizada exige intervalDays', path: ['intervalDays'] })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { message: 'A data final precisa ser depois da inicial', path: ['endDate'] })
  .refine((v) => !v.settleFirst || !!v.walletId, { message: 'Informe a carteira para efetivar a primeira ocorrência', path: ['walletId'] });

export const ruleUpdateSchema = z.object({
  description: z.string().trim().min(1).max(120).optional(),
  categoryId: uuid.nullable().optional(),
  walletId: uuid.nullable().optional(),
  amount: amount.optional(),
  endDate: dateStr.nullable().optional(),
  isSubscription: z.boolean().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  /** future: só as próximas (ainda não vencidas); future_and_open: também as já vencidas e ainda não pagas (RN024). */
  scope: z.enum(['future', 'future_and_open']).default('future'),
});

export const splitCreateSchema = z.object({
  description: z.string().trim().min(1).max(120),
  totalAmount: amount,
  walletId: uuid,
  categoryId: uuid.optional(),
  date: dateStr.optional(),
  participants: z.array(z.object({ name: z.string().trim().min(1).max(60) })).min(1).max(20),
});
export const splitPaySchema = z.object({ walletId: uuid, date: dateStr.optional() });

export const calendarQuery = z.object({ from: dateStr, to: dateStr });
export const projectionBody = z.object({
  days: z.coerce.number().int().min(7).max(365).default(90),
  walletId: uuid.optional(),
  /** Simulação "e se": eventos hipotéticos de receita (+) ou despesa (−). */
  changes: z.array(z.object({ date: dateStr, amount: z.union([z.string(), z.number()]).transform((v) => String(v).replace(',', '.')).refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v)), description: z.string().max(80).optional() })).max(50).default([]),
});
export const projectionQuery = z.object({ days: z.coerce.number().int().min(7).max(365).default(90), walletId: uuid.optional() });

export type RuleCreate = z.infer<typeof ruleCreateSchema>;
export type RuleUpdate = z.infer<typeof ruleUpdateSchema>;
