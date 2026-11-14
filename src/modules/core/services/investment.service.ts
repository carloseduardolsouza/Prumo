import { Decimal } from 'decimal.js';
import { prisma } from '../../../shared/database.js';
import { addDays } from '../../../shared/dates.js';
import { emit } from '../../../shared/events-publisher.js';
import { conflict, notFound, unprocessable } from '../../../shared/errors.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { LedgerModel } from '../models/ledger.model.js';
import { activeWallet, todayOf } from './context.js';
import { avgCost, modifiedDietz, replay, TAX_GROUP, taxByMonth, type Op, type TaxSale } from './investment-math.js';

const CLASS_LABEL: Record<string, string> = { FIXED_INCOME: 'Renda fixa', STOCK: 'Ações', FII: 'FIIs', ETF: 'ETFs', BDR: 'BDRs', CRYPTO: 'Cripto', PHYSICAL: 'Bens físicos', CUSTOM: 'Outros' };
const s2 = (v: Decimal.Value) => toMoneyString(v);
const monthEnd = (ym: string) => fromDate(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)));
const addMonths = (ym: string, n: number) => { const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)); return fromDate(d).slice(0, 7); };

async function load(userId: string) {
  const [ops, assets, quotes, brokerages] = await Promise.all([
    prisma.investmentOperation.findMany({ where: { userId, canceledAt: null }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    prisma.investment.findMany({ where: { userId } }),
    prisma.investmentQuote.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.brokerage.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
  ]);
  const toOp = (o: (typeof ops)[number]): Op => ({ id: o.id, kind: o.kind as Op['kind'], brokerageId: o.brokerageId, investmentId: o.investmentId, date: fromDate(o.date), quantity: o.quantity?.toString() ?? null, unitPrice: o.unitPrice?.toString() ?? null, amount: o.amount.toString(), fees: o.fees.toString() });
  const q = new Map<string, { date: string; price: Decimal }[]>();
  for (const x of quotes) (q.get(x.investmentId) ?? q.set(x.investmentId, []).get(x.investmentId)!).push({ date: fromDate(x.date), price: money(x.price.toString()) });
  return { rawOps: ops, ops: ops.map(toOp), assets, quotes: q, brokerages };
}
type Data = Awaited<ReturnType<typeof load>>;

/** Preço de referência na data: última cotação manual até lá; sem cotação, o último preço negociado; sem nada, o custo médio. */
function priceAt(d: Data, rep: ReturnType<typeof replay>, investmentId: string, asOf: string): Decimal {
  const quote = (d.quotes.get(investmentId) ?? []).filter((x) => x.date <= asOf).at(-1);
  if (quote) return quote.price;
  const p = rep.positions.get(investmentId);
  return p?.lastTradePrice ?? (p ? avgCost(p) : money(0));
}

function snapshot(d: Data, asOf: string, brokerageId?: string) {
  const ops = brokerageId ? d.ops.filter((o) => o.brokerageId === brokerageId) : d.ops;
  const rep = replay(ops, asOf);
  const rows = d.assets.map((a) => {
    const p = rep.positions.get(a.id);
    const price = p ? priceAt(d, rep, a.id, asOf) : money(0);
    const qty = p?.quantity ?? money(0);
    const value = qty.times(price);
    const cost = p?.cost ?? money(0);
    const quotes = d.quotes.get(a.id) ?? [];
    const upto = quotes.filter((x) => x.date <= asOf);
    const change = upto.length >= 2 && !upto.at(-2)!.price.isZero() ? upto.at(-1)!.price.dividedBy(upto.at(-2)!.price).minus(1).times(100) : null;
    return { a, qty, avg: p ? avgCost(p) : money(0), price, value, cost, unrealized: value.minus(cost), realized: p?.realized ?? money(0), dividends: p?.dividends ?? money(0), change, hasPosition: !qty.isZero() };
  });
  const cash = [...rep.cash.values()].reduce((s, v) => s.plus(v), money(0));
  return { rep, rows, cash, positionsValue: rows.reduce((s, r) => s.plus(r.value), money(0)), invested: rows.reduce((s, r) => s.plus(r.cost), money(0)) };
}

const assetDto = (r: ReturnType<typeof snapshot>['rows'][number], total: Decimal) => ({
  id: r.a.id, ticker: r.a.ticker, name: r.a.name, assetClass: r.a.assetClass, classLabel: CLASS_LABEL[r.a.assetClass] ?? r.a.assetClass, archived: !!r.a.archivedAt,
  quantity: r.qty.toString(), averageCost: s2(r.avg), price: s2(r.price), value: s2(r.value), invested: s2(r.cost), unrealized: s2(r.unrealized),
  unrealizedPercent: r.cost.isZero() ? null : Number(r.unrealized.dividedBy(r.cost).times(100).toFixed(2)), realized: s2(r.realized), dividends: s2(r.dividends),
  change: r.change === null ? null : Number(r.change.toFixed(2)), weightPercent: total.isZero() ? 0 : Number(r.value.dividedBy(total).times(100).toFixed(2)),
});

async function ownedBrokerage(userId: string, id: string) {
  const b = await prisma.brokerage.findFirst({ where: { id, userId } });
  if (!b) throw notFound('Corretora');
  return b;
}
async function ownedAsset(userId: string, id: string) {
  const a = await prisma.investment.findFirst({ where: { id, userId } });
  if (!a) throw notFound('Ativo');
  return a;
}

export const InvestmentService = {
  async brokerages(userId: string) {
    const [d, today] = [await load(userId), await todayOf(userId)];
    return {
      brokerages: d.brokerages.filter((b) => !b.archivedAt).map((b) => {
        const s = snapshot(d, today, b.id);
        return { id: b.id, name: b.name, note: b.note, cash: s2(s.cash), assetsValue: s2(s.positionsValue), total: s2(s.cash.plus(s.positionsValue)) };
      }),
    };
  },

  async createBrokerage(userId: string, input: { name: string; note?: string | undefined }) {
    if (await prisma.brokerage.findFirst({ where: { userId, name: input.name, archivedAt: null } })) throw conflict('Já existe uma instituição com esse nome');
    const b = await prisma.brokerage.upsert({ where: { userId_name: { userId, name: input.name } }, update: { archivedAt: null, note: input.note ?? null }, create: { userId, name: input.name, note: input.note ?? null } });
    return { id: b.id, name: b.name };
  },

  /** Instituição com operações é arquivada (o histórico fica); sem operações, é apagada. */
  async removeBrokerage(userId: string, id: string) {
    await ownedBrokerage(userId, id);
    if (await prisma.investmentOperation.count({ where: { userId, brokerageId: id, canceledAt: null } })) await prisma.brokerage.update({ where: { id }, data: { archivedAt: new Date() } });
    else await prisma.brokerage.delete({ where: { id } });
    return { ok: true };
  },

  async assets(userId: string) {
    const d = await load(userId), today = await todayOf(userId);
    const s = snapshot(d, today);
    return { assets: s.rows.filter((r) => !r.a.archivedAt || r.hasPosition).map((r) => assetDto(r, s.positionsValue)).sort((a, b) => Number(b.value) - Number(a.value)) };
  },

  async createAsset(userId: string, input: { ticker: string; name: string; assetClass: string }) {
    if (await prisma.investment.findFirst({ where: { userId, ticker: input.ticker } })) throw conflict('Já existe um ativo com esse código');
    return prisma.investment.create({ data: { userId, ...input } });
  },

  async asset(userId: string, id: string) {
    await ownedAsset(userId, id);
    const d = await load(userId), today = await todayOf(userId);
    const s = snapshot(d, today);
    const row = s.rows.find((r) => r.a.id === id)!;
    const alerts = await prisma.priceAlert.findMany({ where: { userId, investmentId: id }, orderBy: { createdAt: 'desc' } });
    return {
      asset: assetDto(row, s.positionsValue),
      quotes: (d.quotes.get(id) ?? []).slice(-30).reverse().map((x) => ({ date: x.date, price: s2(x.price) })),
      operations: d.rawOps.filter((o) => o.investmentId === id).reverse().slice(0, 50).map(opDto),
      alerts: alerts.map(alertDto),
    };
  },

  async archiveAsset(userId: string, id: string) {
    await ownedAsset(userId, id);
    const s = snapshot(await load(userId), await todayOf(userId));
    if (s.rows.find((r) => r.a.id === id)?.hasPosition) throw unprocessable('O ativo ainda tem posição: venda antes de arquivar');
    await prisma.investment.update({ where: { id }, data: { archivedAt: new Date() } });
    return { ok: true };
  },

  async operations(userId: string, q: { from?: string | undefined; to?: string | undefined; kind?: string | undefined; investmentId?: string | undefined; limit: number }) {
    const rows = await prisma.investmentOperation.findMany({
      where: { userId, canceledAt: null, ...(q.kind ? { kind: q.kind } : {}), ...(q.investmentId ? { investmentId: q.investmentId } : {}), ...(q.from || q.to ? { date: { ...(q.from ? { gte: toDate(q.from) } : {}), ...(q.to ? { lte: toDate(q.to) } : {}) } } : {}) },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: q.limit,
    });
    const [assets, brokerages, today] = [await prisma.investment.findMany({ where: { userId } }), await prisma.brokerage.findMany({ where: { userId } }), await todayOf(userId)];
    const an = new Map(assets.map((a) => [a.id, a.ticker])), bn = new Map(brokerages.map((b) => [b.id, b.name]));
    return { operations: rows.map((o) => ({ ...opDto(o), ticker: o.investmentId ? an.get(o.investmentId) ?? null : null, brokerage: bn.get(o.brokerageId) ?? '', scheduled: o.kind === 'DIVIDEND' && fromDate(o.date) > today })) };
  },

  /**
   * Registra uma operação. Aporte sai de uma carteira pessoal como transferência (não é despesa, RN059);
   * compras e vendas só mexem no caixa da corretora. Nada é enviado à corretora.
   */
  async addOperation(userId: string, input: { kind: Op['kind']; brokerageId: string; investmentId?: string | undefined; asset?: { ticker: string; name: string; assetClass: string } | undefined; date?: string | undefined; quantity?: string | undefined; unitPrice?: string | undefined; amount?: string | undefined; fees: string; dividendKind?: string | undefined; walletId?: string | undefined; note?: string | undefined }) {
    const brokerage = await ownedBrokerage(userId, input.brokerageId);
    if (brokerage.archivedAt) throw unprocessable('Instituição arquivada');
    const today = await todayOf(userId);
    const date = input.date ?? today;
    if (date > today && input.kind !== 'DIVIDEND') throw unprocessable('Só proventos podem ter data futura');
    let investmentId = input.investmentId ?? null;
    if (investmentId) await ownedAsset(userId, investmentId);
    else if (input.asset) investmentId = (await prisma.investment.upsert({ where: { userId_ticker: { userId, ticker: input.asset.ticker } }, update: { archivedAt: null }, create: { userId, ...input.asset } })).id;
    const trade = input.kind === 'BUY' || input.kind === 'SELL';
    const gross = trade ? money(input.quantity!).times(input.unitPrice!).toDecimalPlaces(2) : money(input.amount!);
    if (gross.lte(0)) throw unprocessable('O valor da operação deve ser maior que zero');
    const wallet = input.walletId ? await activeWallet(userId, input.walletId) : null;

    const created = await prisma.$transaction(async (tx) => {
      const op = await tx.investmentOperation.create({ data: { userId, kind: input.kind, brokerageId: brokerage.id, investmentId, date: toDate(date), quantity: input.quantity ?? null, unitPrice: input.unitPrice ?? null, amount: gross.toFixed(4), fees: input.fees, dividendKind: input.dividendKind ?? null, walletId: wallet?.id ?? null, note: input.note ?? null } });
      if (wallet) await LedgerModel.post(tx, { userId, walletId: wallet.id, amount: gross.negated().toFixed(4), kind: 'TRANSFER_OUT', effectiveDate: toDate(date), description: `Aporte em ${brokerage.name}`, investmentOpId: op.id });
      return op;
    });
    // valida o histórico completo: uma venda acima da posição desfaz a operação
    if (replay((await load(userId)).ops, '9999-12-31').oversold) {
      await InvestmentService.removeOperation(userId, created.id);
      throw unprocessable('Venda maior que a quantidade em carteira nessa data');
    }
    await AuditModel.record({ userId, action: 'investment.operation', entity: 'investment_operation', entityId: created.id, after: { kind: input.kind, amount: gross.toFixed(2) } });
    return opDto(created);
  },

  async removeOperation(userId: string, id: string) {
    const op = await prisma.investmentOperation.findFirst({ where: { id, userId, canceledAt: null } });
    if (!op) throw notFound('Operação');
    const today = await todayOf(userId);
    await prisma.$transaction(async (tx) => {
      await tx.investmentOperation.update({ where: { id }, data: { canceledAt: new Date() } });
      await LedgerModel.reverse(tx, await LedgerModel.openEntries(tx, { investmentOpId: id }), toDate(today), 'Estorno de aporte');
    });
    if (op.kind === 'BUY' && replay((await load(userId)).ops, '9999-12-31').oversold) {
      // cancelar a compra deixaria uma venda posterior sem lastro: desfaz o cancelamento
      await prisma.$transaction(async (tx) => {
        await tx.investmentOperation.update({ where: { id }, data: { canceledAt: null } });
        if (op.walletId) await LedgerModel.post(tx, { userId, walletId: op.walletId, amount: op.amount.negated(), kind: 'TRANSFER_OUT', effectiveDate: toDate(today), description: 'Aporte restabelecido', investmentOpId: id });
      });
      throw unprocessable('Há venda posterior que depende dessa compra. Cancele a venda primeiro.');
    }
    await AuditModel.record({ userId, action: 'investment.operation.cancel', entity: 'investment_operation', entityId: id });
    return { ok: true };
  },

  /** Cotação manual (RN062/063): fica com data e origem; também dispara os alertas de preço. */
  async setQuote(userId: string, investmentId: string, input: { price: string; date?: string | undefined }) {
    const a = await ownedAsset(userId, investmentId);
    const today = await todayOf(userId);
    const date = input.date ?? today;
    if (date > today) throw unprocessable('A cotação não pode ter data futura');
    await prisma.investmentQuote.upsert({ where: { investmentId_date: { investmentId, date: toDate(date) } }, update: { price: input.price }, create: { userId, investmentId, date: toDate(date), price: input.price } });
    const price = money(input.price);
    for (const al of await prisma.priceAlert.findMany({ where: { userId, investmentId, triggeredAt: null } })) {
      const hit = al.direction === 'ABOVE' ? price.gte(al.price.toString()) : price.lte(al.price.toString());
      if (!hit) continue;
      await prisma.priceAlert.update({ where: { id: al.id }, data: { triggeredAt: new Date() } });
      await emit('investment.price_target_hit', userId, `investment.price_target_hit__${al.id}`, { ticker: a.ticker, price: s2(price), target: s2(al.price.toString()) });
    }
    return { ok: true, ticker: a.ticker, price: s2(price), date };
  },

  async alerts(userId: string) {
    const [rows, assets] = [await prisma.priceAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }), await prisma.investment.findMany({ where: { userId } })];
    const t = new Map(assets.map((a) => [a.id, a.ticker]));
    return { alerts: rows.map((a) => ({ ...alertDto(a), ticker: t.get(a.investmentId) ?? '' })) };
  },
  async addAlert(userId: string, input: { investmentId: string; direction: string; price: string }) {
    await ownedAsset(userId, input.investmentId);
    return alertDto(await prisma.priceAlert.create({ data: { userId, ...input } }));
  },
  async removeAlert(userId: string, id: string) {
    if (!(await prisma.priceAlert.deleteMany({ where: { id, userId } })).count) throw notFound('Alerta');
    return { ok: true };
  },

  /** Visão geral: patrimônio, resultado, rentabilidade, alocação, proventos e evolução mensal. */
  async overview(userId: string) {
    const d = await load(userId), today = await todayOf(userId);
    const now = snapshot(d, today);
    const total = now.positionsValue.plus(now.cash);
    const ym = today.slice(0, 7);
    const valueAt = (asOf: string) => { const s = snapshot(d, asOf); return { value: s.positionsValue.plus(s.cash), contributed: s.rep.contributed }; };

    const series = Array.from({ length: 12 }, (_, i) => {
      const m = addMonths(ym, i - 11), asOf = m === ym ? today : monthEnd(m);
      const v = valueAt(asOf);
      return { month: m, value: Number(v.value.toFixed(2)), contributed: Number(v.contributed.toFixed(2)) };
    });
    const startDate = addDays(today, -365), start = valueAt(startDate);
    const flows = d.ops.filter((o) => o.kind === 'CONTRIBUTION' && o.date > startDate && o.date <= today).map((o) => ({ date: o.date, amount: o.amount }));
    const r12 = modifiedDietz(start.value, total, flows, startDate, today);

    const byClass = new Map<string, Decimal>();
    for (const r of now.rows) if (r.hasPosition) byClass.set(r.a.assetClass, (byClass.get(r.a.assetClass) ?? money(0)).plus(r.value));
    const targets = new Map((await prisma.allocationTarget.findMany({ where: { userId } })).map((t) => [t.assetClass, Number(t.percent.toString())]));
    const classes = [...new Set([...byClass.keys(), ...targets.keys()])].map((c) => {
      const v = byClass.get(c) ?? money(0);
      return { assetClass: c, label: CLASS_LABEL[c] ?? c, value: s2(v), percent: now.positionsValue.isZero() ? 0 : Number(v.dividedBy(now.positionsValue).times(100).toFixed(2)), target: targets.get(c) ?? null };
    }).sort((a, b) => Number(b.value) - Number(a.value));

    const from12 = addDays(today, -365);
    const divOps = d.ops.filter((o) => o.kind === 'DIVIDEND');
    const net = (o: Op) => money(o.amount).minus(o.fees);
    const div12 = divOps.filter((o) => o.date > from12 && o.date <= today).reduce((s, o) => s.plus(net(o)), money(0));
    const tick = new Map(d.assets.map((a) => [a.id, a.ticker]));
    const upcoming = divOps.filter((o) => o.date > today).sort((a, b) => (a.date < b.date ? -1 : 1)).map((o) => ({ id: o.id, ticker: tick.get(o.investmentId ?? '') ?? '', date: o.date, amount: s2(net(o)), kind: d.rawOps.find((x) => x.id === o.id)?.dividendKind ?? null }));
    const monthlyDiv = series.map((x) => ({ month: x.month, amount: Number(divOps.filter((o) => o.date.startsWith(x.month) && o.date <= today).reduce((s, o) => s.plus(net(o)), money(0)).toFixed(2)) }));
    const freedom = await prisma.goal.findFirst({ where: { userId, kind: 'FREEDOM', status: { not: 'CANCELED' } }, orderBy: { createdAt: 'desc' } });
    const avgMonthly = div12.dividedBy(12);
    const contributedMonth = d.ops.filter((o) => o.kind === 'CONTRIBUTION' && o.date.startsWith(ym)).reduce((s, o) => s.plus(o.amount), money(0));

    return {
      asOf: today, patrimony: s2(total), positionsValue: s2(now.positionsValue), cash: s2(now.cash), invested: s2(now.invested), contributed: s2(now.rep.contributed),
      result: s2(total.minus(now.rep.contributed)), resultPercent: now.rep.contributed.isZero() ? null : Number(total.minus(now.rep.contributed).dividedBy(now.rep.contributed).times(100).toFixed(2)),
      unrealized: s2(now.rows.reduce((s, r) => s.plus(r.unrealized), money(0))), realized: s2(now.rows.reduce((s, r) => s.plus(r.realized), money(0))),
      return12m: r12 ? Number(r12.toFixed(2)) : null,
      methodology: 'Rentabilidade pelo método Dietz modificado (aproximação da rentabilidade por cota). Valores usam cotações informadas por você.',
      contributedMonth: s2(contributedMonth),
      dividends: { last12m: s2(div12), monthlyAverage: s2(avgMonthly), yield: now.positionsValue.isZero() ? null : Number(div12.dividedBy(now.positionsValue).times(100).toFixed(2)), yieldOnCost: now.invested.isZero() ? null : Number(div12.dividedBy(now.invested).times(100).toFixed(2)), upcoming, upcomingTotal: s2(upcoming.reduce((s, u) => s.plus(u.amount), money(0))), monthly: monthlyDiv },
      passiveGoal: freedom ? { target: s2(freedom.targetAmount.toString()), percent: Number(avgMonthly.dividedBy(freedom.targetAmount.toString()).times(100).toFixed(1)) } : null,
      allocation: classes, series,
      highlights: now.rows.filter((r) => r.change !== null && r.hasPosition).sort((a, b) => Math.abs(Number(b.change)) - Math.abs(Number(a.change))).slice(0, 4).map((r) => ({ ticker: r.a.ticker, price: s2(r.price), change: Number(r.change!.toFixed(2)) })),
    };
  },

  async setTargets(userId: string, targets: { assetClass: string; percent: number }[]) {
    await prisma.$transaction([prisma.allocationTarget.deleteMany({ where: { userId } }), prisma.allocationTarget.createMany({ data: targets.filter((t) => t.percent > 0).map((t) => ({ userId, assetClass: t.assetClass, percent: t.percent })) })]);
    return InvestmentService.rebalance(userId, 0);
  },

  /** Compara a carteira com a meta e distribui um novo aporte entre as classes abaixo da meta. Só sugere: nada é executado. */
  async rebalance(userId: string, contribution: number) {
    const o = await InvestmentService.overview(userId);
    const total = money(o.positionsValue).plus(contribution);
    const rows = o.allocation.map((c) => {
      const target = c.target ?? 0;
      const goal = total.times(target).dividedBy(100);
      return { assetClass: c.assetClass, label: c.label, current: c.value, percent: c.percent, target, adjust: goal.minus(c.value) };
    });
    const deficit = rows.filter((r) => r.adjust.gt(0)).reduce((s, r) => s.plus(r.adjust), money(0));
    return {
      contribution: s2(contribution), hasTargets: rows.some((r) => r.target > 0),
      classes: rows.map((r) => ({ assetClass: r.assetClass, label: r.label, current: r.current, percent: r.percent, target: r.target, differenceToTarget: s2(r.adjust), suggestedContribution: deficit.isZero() ? '0.00' : s2(r.adjust.gt(0) ? money(contribution).times(r.adjust).dividedBy(deficit) : 0) })),
      note: 'Sugestão estimada. O app não envia ordens à corretora.',
    };
  },

  async profile(userId: string) {
    const p = await prisma.investorProfile.findUnique({ where: { userId } });
    return p ? { answered: true, profile: p.profile, score: p.score, answers: p.answers as number[], updatedAt: p.updatedAt.toISOString() } : { answered: false, profile: null, score: null, answers: [], updatedAt: null };
  },
  async setProfile(userId: string, answers: number[]) {
    const score = answers.reduce((s, a) => s + a, 0);
    const profile = score <= 7 ? 'CONSERVATIVE' : score <= 11 ? 'MODERATE' : 'BOLD';
    await prisma.investorProfile.upsert({ where: { userId }, update: { answers, score, profile }, create: { userId, answers, score, profile } });
    return InvestmentService.profile(userId);
  },

  /** Apuração de imposto de renda sobre vendas e a posição em 31/12 (ficha de bens e direitos). Estimativa: confira antes de pagar o DARF. */
  async tax(userId: string, year?: number) {
    const today = await todayOf(userId);
    const y = year ?? Number(today.slice(0, 4));
    const d = await load(userId);
    const rep = replay(d.ops, `${y}-12-31`);
    const cls = new Map(d.assets.map((a) => [a.id, a.assetClass]));
    const sales: TaxSale[] = [];
    for (const o of d.ops) {
      if (o.kind !== 'SELL' || !o.date.startsWith(String(y)) || !o.investmentId) continue;
      const group = TAX_GROUP[cls.get(o.investmentId) ?? ''];
      if (group) sales.push({ date: o.date, group, sold: o.amount, gain: rep.realizedByOp.get(o.id) ?? 0 });
    }
    const months = taxByMonth(sales).map((m) => {
      const [yy, mm] = m.month.split('-').map(Number) as [number, number];
      let due = new Date(Date.UTC(yy!, mm! + 1, 0)); // último dia do mês seguinte, recuado para dia útil (feriados não considerados)
      while (due.getUTCDay() === 0 || due.getUTCDay() === 6) due = new Date(due.getTime() - 86_400_000);
      return { ...m, darfCode: Number(m.tax) > 0 ? '6015' : null, darfDueDate: Number(m.tax) > 0 ? fromDate(due) : null };
    });
    const dividends = d.ops.filter((o) => o.kind === 'DIVIDEND' && o.date.startsWith(String(y)) && o.date <= today);
    const kinds = new Map(d.rawOps.map((o) => [o.id, o.dividendKind]));
    const sum = (k: (s: string | null | undefined) => boolean) => dividends.filter((o) => k(kinds.get(o.id))).reduce((s, o) => s.plus(o.amount), money(0));
    const holdings = d.assets.map((a) => ({ a, p: rep.positions.get(a.id) })).filter((x) => x.p && !x.p.quantity.isZero()).map((x) => ({ ticker: x.a.ticker, name: x.a.name, assetClass: x.a.assetClass, quantity: x.p!.quantity.toString(), cost: s2(x.p!.cost) }));
    return {
      year: y, months, totalTax: s2(months.reduce((s, m) => s.plus(m.tax), money(0))),
      income: { dividends: s2(sum((k) => k === 'DIVIDENDO' || k === 'RENDIMENTO')), jcp: s2(sum((k) => k === 'JCP')), other: s2(sum((k) => k === 'CUPOM' || !k)) },
      holdings, note: 'Estimativa com as regras gerais (isenção de R$ 20 mil/mês em ações, 35 mil em cripto, compensação de prejuízos por grupo). Day trade, renda fixa e casos especiais não são apurados. Confira com um contador.',
    };
  },
};

const opDto = (o: { id: string; kind: string; brokerageId: string; investmentId: string | null; date: Date; quantity: { toString(): string } | null; unitPrice: { toString(): string } | null; amount: { toString(): string }; fees: { toString(): string }; dividendKind: string | null; walletId: string | null; note: string | null }) => ({
  id: o.id, kind: o.kind, brokerageId: o.brokerageId, investmentId: o.investmentId, date: fromDate(o.date), quantity: o.quantity?.toString() ?? null, unitPrice: o.unitPrice ? s2(o.unitPrice.toString()) : null,
  amount: s2(o.amount.toString()), fees: s2(o.fees.toString()), dividendKind: o.dividendKind, walletId: o.walletId, note: o.note,
});
const alertDto = (a: { id: string; investmentId: string; direction: string; price: { toString(): string }; triggeredAt: Date | null }) => ({ id: a.id, investmentId: a.investmentId, direction: a.direction, price: s2(a.price.toString()), triggered: !!a.triggeredAt });

/** Proventos e cotações pendentes aparecem no calendário (fonte "investmentos"). */
export const investmentCalendarSource = async (userId: string, from: string, to: string, today: string) => {
  const ops = await prisma.investmentOperation.findMany({ where: { userId, canceledAt: null, kind: 'DIVIDEND', date: { gte: toDate(from), lte: toDate(to) } } });
  const assets = new Map((await prisma.investment.findMany({ where: { userId } })).map((a) => [a.id, a.ticker]));
  return ops.map((o) => ({ id: o.id, date: fromDate(o.date), kind: 'investment' as const, title: `Provento ${assets.get(o.investmentId ?? '') ?? ''}`.trim(), info: o.dividendKind ?? 'Provento', amount: s2(money(o.amount.toString()).minus(o.fees.toString())), status: fromDate(o.date) <= today ? ('settled' as const) : ('planned' as const), href: '/inv-extrato' }));
};

/** Avisos de provento a caminho (usado pelo job de lembretes). */
export async function upcomingDividendReminders(userId: string, today: string, lead: number) {
  const ops = await prisma.investmentOperation.findMany({ where: { userId, canceledAt: null, kind: 'DIVIDEND', date: { gt: toDate(today), lte: toDate(addDays(today, lead)) } } });
  const assets = new Map((await prisma.investment.findMany({ where: { userId } })).map((a) => [a.id, a.ticker]));
  for (const o of ops) await emit('investment.dividend_incoming', userId, `investment.dividend_incoming__${o.id}`, { ticker: assets.get(o.investmentId ?? '') ?? '', amount: s2(money(o.amount.toString()).minus(o.fees.toString())), date: fromDate(o.date).split('-').reverse().join('/') });
  return ops.length;
}

/** Média mensal de proventos líquidos dos últimos 12 meses (renda passiva). */
export async function passiveIncomeMonthly(userId: string): Promise<Decimal> {
  const today = await todayOf(userId);
  const from = addDays(today, -365);
  const ops = await prisma.investmentOperation.findMany({ where: { userId, canceledAt: null, kind: 'DIVIDEND', date: { gt: toDate(from), lte: toDate(today) } } });
  return ops.reduce((s, o) => s.plus(o.amount.toString()).minus(o.fees.toString()), money(0)).dividedBy(12);
}

/** Valor atual das posições mais o caixa das instituições (para o patrimônio total). */
export async function investmentPatrimony(userId: string): Promise<Decimal> {
  const s = snapshot(await load(userId), await todayOf(userId));
  return s.positionsValue.plus(s.cash);
}
