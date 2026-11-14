import { z } from 'zod';
import { dateStr } from './finance.schemas.js';
import { PERIOD_KEYS } from '../services/dashboard-periods.js';

export const dashboardQuery = z
  .object({ period: z.enum(PERIOD_KEYS).default('month'), from: dateStr.optional(), to: dateStr.optional() })
  .refine((v) => v.period !== 'custom' || (v.from && v.to && v.from <= v.to), { message: 'Período personalizado exige from e to (from <= to)', path: ['from'] });

export const byCategoryQuery = z.object({ type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'), from: dateStr, to: dateStr });
export const monthlyResultQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });
export const rangeRequired = z.object({ from: dateStr, to: dateStr });
