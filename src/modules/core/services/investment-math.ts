import { Decimal } from 'decimal.js';
import { money } from '../../../shared/money.js';

export interface Op {
  id: string;
  kind: 'CONTRIBUTION' | 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE';
  brokerageId: string;
  investmentId: string | null;
  date: string;
  quantity: string | null;
  unitPrice: string | null;
  amount: string;
  fees: string;
}

export interface Position { quantity: Decimal; cost: Decimal; realized: Decimal; dividends: Decimal; lastTradePrice: Decimal | null }

export interface Replay {
  positions: Map<string, Position>;
  /** Caixa por corretora: aportes e vendas entram; compras e taxas saem. */
  cash: Map<string, Decimal>;
  /** Resultado realizado de cada venda (preço líquido menos custo médio). */
  realizedByOp: Map<string, Decimal>;
  contributed: Decimal;
  /** Verdadeiro se alguma venda excedeu a quantidade em carteira naquele momento. */
  oversold: boolean;
}

const Z = () => money(0);

/** Repete as operações em ordem de data para obter posição, custo médio e resultado. Só considera operações até `asOf`. */
export function replay(ops: Op[], asOf: string): Replay {
  const out: Replay = { positions: new Map(), cash: new Map(), realizedByOp: new Map(), contributed: Z(), oversold: false };
  const sorted = ops.filter((o) => o.date <= asOf).sort((a, b) => (a.date === b.date ? (a.kind === 'SELL' ? 1 : 0) - (b.kind === 'SELL' ? 1 : 0) : a.date < b.date ? -1 : 1));
  const addCash = (b: string, v: Decimal.Value) => out.cash.set(b, (out.cash.get(b) ?? Z()).plus(v));
  const pos = (id: string) => out.positions.get(id) ?? out.positions.set(id, { quantity: Z(), cost: Z(), realized: Z(), dividends: Z(), lastTradePrice: null }).get(id)!;

  for (const o of sorted) {
    const amt = money(o.amount), fees = money(o.fees);
    if (o.kind === 'CONTRIBUTION') { addCash(o.brokerageId, amt); out.contributed = out.contributed.plus(amt); continue; }
    if (o.kind === 'FEE') { addCash(o.brokerageId, amt.negated()); continue; }
    if (!o.investmentId) continue;
    const p = pos(o.investmentId);
    if (o.kind === 'DIVIDEND') { p.dividends = p.dividends.plus(amt.minus(fees)); addCash(o.brokerageId, amt.minus(fees)); continue; }
    const q = money(o.quantity ?? 0);
    if (o.unitPrice) p.lastTradePrice = money(o.unitPrice);
    if (o.kind === 'BUY') {
      p.quantity = p.quantity.plus(q); p.cost = p.cost.plus(amt).plus(fees); addCash(o.brokerageId, amt.plus(fees).negated());
    } else {
      if (q.gt(p.quantity)) { out.oversold = true; continue; }
      const avg = p.quantity.isZero() ? Z() : p.cost.dividedBy(p.quantity);
      const basis = avg.times(q);
      const gain = amt.minus(fees).minus(basis);
      out.realizedByOp.set(o.id, gain);
      p.realized = p.realized.plus(gain); p.quantity = p.quantity.minus(q); p.cost = p.quantity.isZero() ? Z() : p.cost.minus(basis);
      addCash(o.brokerageId, amt.minus(fees));
    }
  }
  return out;
}

export const avgCost = (p: Position) => (p.quantity.isZero() ? Z() : p.cost.dividedBy(p.quantity));

/**
 * Rentabilidade pelo método Dietz modificado: ganho dividido pelo capital ponderado pelo tempo.
 * shortcut: aproximação do TWR sem cotas diárias, trocar por cotização diária se o histórico de valor ficar denso.
 */
export function modifiedDietz(startValue: Decimal.Value, endValue: Decimal.Value, flows: { date: string; amount: Decimal.Value }[], from: string, to: string): Decimal | null {
  const total = Math.max(1, (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  let net = Z(), weighted = Z();
  for (const f of flows) {
    const w = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${f.date}T00:00:00Z`)) / 86_400_000 / total;
    net = net.plus(f.amount); weighted = weighted.plus(money(f.amount).times(Math.min(1, Math.max(0, w))));
  }
  const base = money(startValue).plus(weighted);
  if (base.lte(0)) return null;
  return money(endValue).minus(startValue).minus(net).dividedBy(base).times(100);
}

export type TaxGroup = 'STOCK' | 'FII' | 'ETF' | 'CRYPTO';
export const TAX_GROUP: Record<string, TaxGroup | undefined> = { STOCK: 'STOCK', FII: 'FII', ETF: 'ETF', BDR: 'ETF', CRYPTO: 'CRYPTO' };

/** Isenção mensal sobre o total vendido e alíquota por grupo (regras gerais; ajuste fino é do contribuinte). */
const RULES: Record<TaxGroup, { exemptUpTo: number | null; rate: number }> = {
  STOCK: { exemptUpTo: 20_000, rate: 15 },
  FII: { exemptUpTo: null, rate: 20 },
  ETF: { exemptUpTo: null, rate: 15 },
  CRYPTO: { exemptUpTo: 35_000, rate: 15 },
};

export interface TaxSale { date: string; group: TaxGroup; sold: Decimal.Value; gain: Decimal.Value }
export interface TaxMonth { month: string; group: TaxGroup; sold: string; gain: string; lossCarried: string; exempt: boolean; base: string; rate: number; tax: string }

/** Apuração mensal por grupo, compensando prejuízos anteriores do mesmo grupo (estimativa para o DARF). */
export function taxByMonth(sales: TaxSale[]): TaxMonth[] {
  const groups = new Map<string, Map<string, { sold: Decimal; gain: Decimal }>>();
  for (const s of sales) {
    const g = groups.get(s.group) ?? groups.set(s.group, new Map()).get(s.group)!;
    const m = s.date.slice(0, 7);
    const cur = g.get(m) ?? { sold: Z(), gain: Z() };
    g.set(m, { sold: cur.sold.plus(s.sold), gain: cur.gain.plus(s.gain) });
  }
  const out: TaxMonth[] = [];
  for (const [group, months] of groups) {
    const rule = RULES[group as TaxGroup];
    let loss = Z();
    for (const [month, v] of [...months].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const exempt = rule.exemptUpTo !== null && v.sold.lte(rule.exemptUpTo);
      let base = Z();
      if (exempt) { /* ganho isento não compensa nem gera imposto */ } else if (v.gain.lt(0)) loss = loss.plus(v.gain.negated());
      else { base = Decimal.max(Z(), v.gain.minus(loss)); loss = Decimal.max(Z(), loss.minus(v.gain)); }
      out.push({ month, group: group as TaxGroup, sold: v.sold.toFixed(2), gain: v.gain.toFixed(2), lossCarried: loss.toFixed(2), exempt, base: base.toFixed(2), rate: rule.rate, tax: base.times(rule.rate).dividedBy(100).toFixed(2) });
    }
  }
  return out.sort((a, b) => (a.month === b.month ? a.group.localeCompare(b.group) : a.month < b.month ? -1 : 1));
}
