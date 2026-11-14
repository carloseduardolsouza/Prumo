import { z } from 'zod';
import { amount, dateStr } from './finance.schemas.js';

const uuid = z.string().uuid();
const optStr = (m: number) => z.string().trim().max(m).optional();
const dec = (max: number) =>
  z.union([z.string(), z.number()]).transform((v) => String(v).trim().replace(',', '.')).refine((v) => new RegExp(`^\\d{1,13}(\\.\\d{1,${max}})?$`).test(v) && Number(v) > 0, `Informe um número maior que zero (até ${max} casas)`);

export const assetClassEnum = z.enum(['FIXED_INCOME', 'STOCK', 'FII', 'ETF', 'BDR', 'CRYPTO', 'PHYSICAL', 'CUSTOM']);

export const brokerageSchema = z.object({ name: z.string().trim().min(1).max(60), note: optStr(200) });
export const assetSchema = z.object({ ticker: z.string().trim().toUpperCase().min(1).max(30), name: z.string().trim().min(1).max(80), assetClass: assetClassEnum });

export const operationSchema = z
  .object({
    kind: z.enum(['CONTRIBUTION', 'BUY', 'SELL', 'DIVIDEND', 'FEE']),
    brokerageId: uuid,
    investmentId: uuid.optional(),
    asset: assetSchema.optional(),
    date: dateStr.optional(),
    quantity: dec(8).optional(),
    unitPrice: dec(6).optional(),
    amount: amount.optional(),
    fees: z.union([z.string(), z.number()]).transform((v) => String(v).trim().replace(',', '.')).refine((v) => /^\d{1,13}(\.\d{1,2})?$/.test(v), 'Valor inválido').default('0'),
    dividendKind: z.enum(['DIVIDENDO', 'JCP', 'RENDIMENTO', 'CUPOM']).optional(),
    walletId: uuid.optional(),
    note: optStr(200),
  })
  .superRefine((o, ctx) => {
    const trade = o.kind === 'BUY' || o.kind === 'SELL';
    if (trade && (!o.quantity || !o.unitPrice)) ctx.addIssue({ code: 'custom', message: 'Informe quantidade e preço unitário', path: ['quantity'] });
    if (!trade && !o.amount) ctx.addIssue({ code: 'custom', message: 'Informe o valor', path: ['amount'] });
    if ((trade || o.kind === 'DIVIDEND') && !o.investmentId && !o.asset) ctx.addIssue({ code: 'custom', message: 'Informe o ativo', path: ['investmentId'] });
    if (o.kind !== 'CONTRIBUTION' && o.walletId) ctx.addIssue({ code: 'custom', message: 'Só o aporte sai de uma carteira pessoal', path: ['walletId'] });
  });

export const opsQuery = z.object({ from: dateStr.optional(), to: dateStr.optional(), kind: z.enum(['CONTRIBUTION', 'BUY', 'SELL', 'DIVIDEND', 'FEE']).optional(), investmentId: uuid.optional(), limit: z.coerce.number().int().min(1).max(500).default(100) });
export const quoteSchema = z.object({ price: dec(6), date: dateStr.optional() });
export const alertSchema = z.object({ investmentId: uuid, direction: z.enum(['ABOVE', 'BELOW']), price: dec(6) });
export const targetsSchema = z.object({ targets: z.array(z.object({ assetClass: assetClassEnum, percent: z.coerce.number().min(0).max(100) })).max(8) }).refine((v) => v.targets.reduce((s, t) => s + t.percent, 0) <= 100.0001, 'A soma das metas passa de 100%');
export const rebalanceQuery = z.object({ contribution: z.coerce.number().min(0).max(1e9).default(0) });
export const profileSchema = z.object({ answers: z.array(z.coerce.number().int().min(1).max(3)).length(5) });
export const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });
