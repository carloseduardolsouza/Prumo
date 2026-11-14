import { z } from 'zod';
import { amount, dateStr, signedAmount } from './finance.schemas.js';

const uuid = z.string().uuid();
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const monthQuery = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use AAAA-MM').optional() });
export const categoryParam = z.object({ categoryId: uuid });
export const budgetSchema = z.object({ amount });

export const goalCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['SAVING', 'FREEDOM']).default('SAVING'),
  targetAmount: amount,
  targetDate: dateStr.optional(),
  initialAmount: amount.optional(),
  color: color.optional(),
});
export const goalPatchSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), targetAmount: amount.optional(), targetDate: dateStr.nullable().optional(), color: color.optional(), status: z.literal('CANCELED').optional() });
export const contributionSchema = z.object({ amount: signedAmount.refine((v) => Number(v) !== 0, 'Valor inválido'), date: dateStr.optional(), note: z.string().trim().max(200).optional() });
export const contributionParam = z.object({ id: uuid, contributionId: uuid });

export const autoInvestSchema = z.object({ walletId: uuid, brokerageId: uuid, amount, dayOfMonth: z.coerce.number().int().min(1).max(28) });
export const autoInvestPatchSchema = z.object({ active: z.boolean().optional(), amount: amount.optional(), dayOfMonth: z.coerce.number().int().min(1).max(28).optional() });
export const exportQuery = z.object({ kind: z.enum(['transactions', 'investments']), from: dateStr, to: dateStr });
