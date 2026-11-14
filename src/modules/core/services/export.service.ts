import { prisma } from '../../../shared/database.js';
import { fromDate, toDate } from '../models/finance.schemas.js';

// Células que começam com = + - @ viram texto: evita injeção de fórmula ao abrir o CSV em planilhas.
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header: string[], rows: unknown[][]) => '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
const TYPE: Record<string, string> = { INCOME: 'Receita', EXPENSE: 'Despesa' };
const OP: Record<string, string> = { CONTRIBUTION: 'Aporte', BUY: 'Compra', SELL: 'Venda', DIVIDEND: 'Provento', FEE: 'Taxa' };

export const ExportService = {
  /** Lançamentos efetivados no período, separados por ponto e vírgula (Excel pt-BR). */
  async transactions(userId: string, from: string, to: string) {
    const [rows, cats, wallets] = await Promise.all([
      prisma.financialTransaction.findMany({ where: { userId, status: { in: ['SETTLED', 'PARTIAL'] }, paidDate: { gte: toDate(from), lte: toDate(to) } }, orderBy: { paidDate: 'asc' }, take: 20000 }),
      prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }), prisma.wallet.findMany({ where: { userId }, select: { id: true, name: true } }),
    ]);
    const cn = new Map(cats.map((c) => [c.id, c.name])), wn = new Map(wallets.map((w) => [w.id, w.name]));
    return csv(['Data', 'Tipo', 'Descrição', 'Categoria', 'Carteira', 'Valor'], rows.map((t) => [fromDate(t.paidDate!), TYPE[t.type], t.description, cn.get(t.categoryId ?? '') ?? '', wn.get(t.walletId ?? '') ?? 'Cartão', t.paidAmount.toString()]));
  },

  async investments(userId: string, from: string, to: string) {
    const [ops, assets, brokerages] = await Promise.all([
      prisma.investmentOperation.findMany({ where: { userId, canceledAt: null, date: { gte: toDate(from), lte: toDate(to) } }, orderBy: { date: 'asc' }, take: 20000 }),
      prisma.investment.findMany({ where: { userId } }), prisma.brokerage.findMany({ where: { userId } }),
    ]);
    const an = new Map(assets.map((a) => [a.id, a.ticker])), bn = new Map(brokerages.map((b) => [b.id, b.name]));
    return csv(['Data', 'Operação', 'Ativo', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor', 'Taxas'], ops.map((o) => [fromDate(o.date), OP[o.kind], an.get(o.investmentId ?? '') ?? '', bn.get(o.brokerageId) ?? '', o.quantity?.toString() ?? '', o.unitPrice?.toString() ?? '', o.amount.toString(), o.fees.toString()]));
  },
};
