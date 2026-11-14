import { z } from 'zod';
import { amount, dateStr } from './finance.schemas.js';

const uuid = z.string().uuid();
const pctRate = z.union([z.string(), z.number()]).transform((v) => String(v).replace(',', '.')).refine((v) => /^\d{1,3}(\.\d{1,4})?$/.test(v) && Number(v) <= 100, 'Taxa em % (ex.: 1,49)');
const optStr = (m: number) => z.string().trim().max(m).optional();

export const debtKindEnum = z.enum(['REAL_ESTATE', 'VEHICLE', 'PERSONAL', 'PAYROLL', 'STUDENT', 'PRIVATE', 'OTHER']);

export const financingCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    creditor: optStr(80),
    kind: debtKindEnum,
    contractedAmount: amount.optional(),
    downPayment: amount.optional(),
    financedAmount: amount.optional(),
    /** Taxa mensal em porcentagem (1,49 = 1,49% a.m.). */
    monthlyRatePercent: pctRate.default('0'),
    annualCet: pctRate.optional(),
    system: z.enum(['PRICE', 'SAC']).default('PRICE'),
    installments: z.coerce.number().int().min(1).max(480),
    feePerInstallment: amount.optional(),
    contractDate: dateStr.optional(),
    firstDueDate: dateStr,
    dueDay: z.coerce.number().int().min(1).max(31).optional(),
    walletId: uuid.optional(),
    notes: optStr(500),
    /** Cronograma informado pelo contrato (IMPORTED). Sem isso o app calcula (CALCULATED) ou usa parcela fixa (MANUAL). */
    schedule: z.array(z.object({ dueDate: dateStr, total: amount, principal: amount.optional(), interest: amount.optional() })).max(480).optional(),
    manualInstallmentAmount: amount.optional(),
  })
  .refine((v) => v.financedAmount || v.contractedAmount, { message: 'Informe o valor financiado ou o contratado', path: ['financedAmount'] })
  .refine((v) => v.schedule || v.manualInstallmentAmount || Number(v.monthlyRatePercent) >= 0, { message: 'Taxa inválida', path: ['monthlyRatePercent'] });

export const payInstallmentSchema = z.object({ walletId: uuid, date: dateStr.optional(), amount: amount.optional(), lateFee: amount.optional() });
export const extraSchema = z.object({ amount, mode: z.enum(['REDUCE_TERM', 'REDUCE_INSTALLMENT']).default('REDUCE_TERM'), walletId: uuid.optional(), date: dateStr.optional(), simulate: z.boolean().default(false) });
export const payoffSchema = z.object({ walletId: uuid, amount: amount.optional(), date: dateStr.optional() });
export const officialBalanceSchema = z.object({ amount: z.union([z.string(), z.number()]).transform((v) => String(v).replace(',', '.')).refine((v) => /^\d{1,13}(\.\d{1,2})?$/.test(v)), date: dateStr.optional() });
export const numberParam = z.object({ id: uuid, number: z.coerce.number().int().min(1) });

export const consortiumCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  administrator: optStr(80),
  groupNumber: optStr(20),
  quota: optStr(20),
  kind: z.enum(['REAL_ESTATE', 'VEHICLE', 'SERVICE', 'OTHER']),
  initialLetter: amount,
  currentLetter: amount.optional(),
  installments: z.coerce.number().int().min(1).max(300),
  installmentAmount: amount,
  contractDate: dateStr.optional(),
  firstDueDate: dateStr,
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  adminFeeRate: pctRate.optional(),
  reserveFundRate: pctRate.optional(),
  insuranceFee: amount.optional(),
  adjustmentRule: optStr(60),
  nextAssemblyDate: dateStr.optional(),
  walletId: uuid.optional(),
  notes: optStr(500),
  /** Parcelas já pagas antes de cadastrar (histórico anterior ao app): só marca como pagas, sem movimentar saldo. */
  alreadyPaid: z.coerce.number().int().min(0).max(300).default(0),
});
export const consortiumPaySchema = z.object({ walletId: uuid, numbers: z.array(z.coerce.number().int().min(1)).min(1).max(24), date: dateStr.optional(), lateFee: amount.optional() });
export const consortiumAdjustSchema = z.object({
  target: z.enum(['LETTER', 'INSTALLMENT']),
  mode: z.enum(['AMOUNT', 'PERCENT']),
  value: z.union([z.string(), z.number()]).transform((v) => String(v).replace(',', '.')).refine((v) => /^-?\d{1,13}(\.\d{1,4})?$/.test(v) && Number(v) !== 0, 'Valor inválido'),
  effectiveDate: dateStr.optional(),
  source: z.enum(['USER', 'ADMINISTRATOR']).default('USER'),
  note: optStr(200),
});
export const consortiumEventSchema = z.object({
  kind: z.enum(['BID', 'CONTEMPLATION', 'RELEASE', 'USE']),
  date: dateStr.optional(),
  modality: optStr(40),
  amount: amount.optional(),
  description: optStr(200),
});
export const consortiumPatchSchema = z.object({ nextAssemblyDate: dateStr.nullable().optional(), notes: optStr(500), adjustmentRule: optStr(60), status: z.enum(['ACTIVE', 'CANCELED', 'CLOSED']).optional() });
