import { z } from 'zod';

// Datas trafegam como "AAAA-MM-DD" (sem horário nem fuso: são datas de calendário).
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD').refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s, 'Data inválida');
export const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const fromDate = (d: Date) => d.toISOString().slice(0, 10);

// Valores chegam como string decimal ("1234.56") ou número; nunca são usados como float nos cálculos.
export const amount = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(',', '.'))
  .refine((v) => /^\d{1,13}(\.\d{1,2})?$/.test(v) && Number(v) > 0, 'Informe um valor maior que zero (até 2 casas decimais)');
export const signedAmount = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(',', '.'))
  .refine((v) => /^-?\d{1,13}(\.\d{1,2})?$/.test(v), 'Valor inválido');

const uuid = z.string().uuid();
const optStr = (max: number) => z.string().trim().max(max).optional();

export const idParam = z.object({ id: uuid });

// ── categorias ──
export const categoryTypeEnum = z.enum(['INCOME', 'EXPENSE']);
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: categoryTypeEnum,
  icon: optStr(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: uuid.optional(),
});
export const categoryUpdateSchema = categoryCreateSchema.omit({ type: true, parentId: true }).partial();
export const categoryListQuery = z.object({ type: categoryTypeEnum.optional(), archived: z.enum(['true', 'false']).transform((v) => v === 'true').optional() });

// ── carteiras ──
export const walletTypeEnum = z.enum(['CHECKING', 'SAVINGS', 'DIGITAL_BANK', 'BANK', 'PAYMENT', 'DIGITAL_WALLET', 'CASH', 'INTERNATIONAL', 'OTHER']);
export const walletCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: walletTypeEnum,
  institution: optStr(60),
  currency: z.literal('BRL').default('BRL'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: optStr(40),
  notes: optStr(500),
  openingBalance: signedAmount.default('0'),
  openingDate: dateStr.optional(),
});
export const walletUpdateSchema = walletCreateSchema.omit({ openingBalance: true, openingDate: true, currency: true }).partial();
export const walletListQuery = z.object({ status: z.enum(['active', 'archived', 'all']).default('active') });
export const adjustSchema = z
  .object({ newBalance: signedAmount.optional(), delta: signedAmount.optional(), reason: z.string().trim().min(3, 'Informe a justificativa').max(200), date: dateStr.optional() })
  .refine((v) => (v.newBalance === undefined) !== (v.delta === undefined), 'Informe newBalance ou delta (apenas um)');
export const rangeQuery = z.object({ from: dateStr.optional(), to: dateStr.optional() });
export const historyQuery = z.object({ days: z.coerce.number().int().min(1).max(730).default(30) });
export const importSchema = z.object({ format: z.enum(['csv', 'ofx']), content: z.string().min(1).max(1_500_000), commit: z.boolean().default(false) });

// ── lançamentos ──
export const txTypeEnum = z.enum(['INCOME', 'EXPENSE']);
export const txCreateSchema = z
  .object({
    type: txTypeEnum,
    description: z.string().trim().min(1).max(120),
    categoryId: uuid.optional(),
    walletId: uuid.optional(),
    amount,
    competenceDate: dateStr.optional(),
    dueDate: dateStr.optional(),
    notes: optStr(500),
    /** true = já efetivado: exige walletId e movimenta o saldo agora. */
    settled: z.boolean().default(false),
    paidDate: dateStr.optional(),
  })
  .refine((v) => !v.settled || !!v.walletId, { message: 'Informe a carteira para registrar como efetivado', path: ['walletId'] });
export const txUpdateSchema = z
  .object({
    description: z.string().trim().min(1).max(120),
    categoryId: uuid.nullable(),
    walletId: uuid,
    amount,
    competenceDate: dateStr,
    dueDate: dateStr.nullable(),
    paidDate: dateStr,
    notes: z.string().trim().max(500).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo');
export const settleSchema = z.object({ walletId: uuid, amount: amount.optional(), date: dateStr.optional() });

// ── transferências ──
export const transferCreateSchema = z
  .object({ fromWalletId: uuid, toWalletId: uuid, amount, date: dateStr.optional(), notes: optStr(500), fee: amount.optional() })
  .refine((v) => v.fromWalletId !== v.toWalletId, { message: 'Origem e destino precisam ser diferentes', path: ['toWalletId'] });

// ── extrato ──
export const statementQuery = z.object({
  from: dateStr,
  to: dateStr,
  type: z.enum(['todas', 'receita', 'despesa', 'transferencia']).default('todas'),
  status: z.enum(['all', 'settled', 'planned']).default('all'),
  walletId: uuid.optional(),
  categoryId: uuid.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type TxCreate = z.infer<typeof txCreateSchema>;
export type TxUpdate = z.infer<typeof txUpdateSchema>;
export type StatementQuery = z.infer<typeof statementQuery>;
