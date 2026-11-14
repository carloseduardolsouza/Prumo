import { CORE, assert, check, finish, http } from './lib.js';

console.log('E7 — Financiamentos, empréstimos e consórcios');

const api = (path: string, token: string, method = 'GET', body?: unknown) => http(CORE, `/api/v1${path}`, { method, token, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const reg = async (n: string) => (await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: `Debt ${n}`, email: `debt${n}+${Date.now()}@prumo.test`, password: 'senha-segura-123' }) })).body.accessToken as string;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const add = (days: number) => iso(new Date(Date.now() + days * 86_400_000));
const cents = (v: string | number) => Math.round(Number(v) * 100);

const t = await reg('A');
const other = await reg('B');
let W = '', F = '', S = '', C = '';
const bal = async () => (await api(`/wallets/${W}`, t)).body.wallet.balance as string;

await check('prepara conta com R$ 50.000', async () => {
  W = (await api('/wallets', t, 'POST', { name: 'Itaú', type: 'CHECKING', openingBalance: '50000.00' })).body.wallet.id;
});

await check('financiamento Price: cronograma calculado, principal soma exato e saldo é ESTIMATIVA (RN043/044)', async () => {
  const r = await api('/financings', t, 'POST', { name: 'Carro', creditor: 'Itaú', kind: 'VEHICLE', financedAmount: '12000', monthlyRatePercent: '1', system: 'PRICE', installments: 12, firstDueDate: add(3), walletId: W });
  assert(r.status === 201, JSON.stringify(r.body));
  F = r.body.financing.id;
  const sched = r.body.schedule as any[];
  assert(sched.length === 12 && r.body.financing.scheduleSource === 'CALCULATED', 'cronograma');
  assert(cents(sched.reduce((s, i) => s + Number(i.principal), 0)) === 1200000, 'principal soma o financiado');
  assert(sched[0].interest === '120.00' && sched[0].total === '1066.19', JSON.stringify(sched[0])); // pmt Price 12k, 1%, 12x
  const s = r.body.financing.summary;
  assert(s.isEstimate === true && s.estimatedBalance === '12000.00' && s.officialBalance === null && /estimado/i.test(s.estimateNote), JSON.stringify(s));
});

await check('pagar parcela: sai da carteira, vira despesa e atualiza o contrato (RN045); não paga duas vezes', async () => {
  const r = await api(`/financings/${F}/installments/1/pay`, t, 'POST', { walletId: W });
  assert(r.status === 200, JSON.stringify(r.body));
  assert((await bal()) === '48933.81', `saldo ${await bal()}`); // 50000 - 1066.19
  const s = r.body.financing.summary;
  assert(s.paidCount === 1 && s.interestPaid === '120.00' && s.remainingCount === 11, JSON.stringify(s));
  assert(Math.round(cents(s.estimatedBalance)) === 1200000 - cents(r.body.schedule[0].principal), 'saldo estimado cai o principal pago');
  assert((await api(`/financings/${F}/installments/1/pay`, t, 'POST', { walletId: W })).status === 422, 'já paga');
  const dash = (await api('/dashboard?period=month', t)).body;
  assert(Number(dash.summary.expense) >= 1066.19, `despesa no dashboard: ${dash.summary.expense}`);
});

await check('multa de atraso é despesa à parte; cancelar pagamento estorna tudo', async () => {
  const before = await bal();
  const r = await api(`/financings/${F}/installments/2/pay`, t, 'POST', { walletId: W, lateFee: '25.00' });
  assert(Math.round(cents(before) - cents(await bal())) === cents('1066.19') + 2500, `saldo ${before} → ${await bal()}`);
  assert(r.body.financing.summary.lateFeesPaid === '25.00', JSON.stringify(r.body.financing.summary));
  const c = await api(`/financings/${F}/installments/2/cancel-payment`, t, 'POST');
  assert(c.status === 200 && c.body.financing.summary.paidCount === 1, JSON.stringify(c.body.financing.summary));
  assert((await api(`/wallets/${W}/reconcile`, t)).body.consistent === true, 'ledger consistente');
});

await check('amortização extra: simula sem gravar; aplica e regenera o cronograma mantendo o histórico (RN046)', async () => {
  const sim = await api(`/financings/${F}/extra-amortization`, t, 'POST', { amount: '3000', mode: 'REDUCE_TERM', simulate: true });
  assert(sim.status === 200 && sim.body.simulation.monthsSaved >= 2 && Number(sim.body.simulation.interestSaved) > 0, JSON.stringify(sim.body));
  const untouched = (await api(`/financings/${F}`, t)).body.financing.summary.remainingCount;
  assert(untouched === 11, 'simulação não grava');
  const ap = await api(`/financings/${F}/extra-amortization`, t, 'POST', { amount: '3000', mode: 'REDUCE_TERM', walletId: W });
  assert(ap.status === 200 && ap.body.financing.summary.remainingCount === 11 - sim.body.simulation.monthsSaved, JSON.stringify(ap.body.applied));
  assert(ap.body.schedule[0].status === 'paid' && ap.body.schedule[0].number === 1, 'histórico preservado');
  assert(ap.body.financing.installments === 1 + ap.body.financing.summary.remainingCount, 'contagem de parcelas atualizada');
  const bad = await api(`/financings/${F}/extra-amortization`, t, 'POST', { amount: '999999', walletId: W });
  assert(bad.status === 422, `valor acima do saldo: ${bad.status}`);
  const red = await api(`/financings/${F}/extra-amortization`, t, 'POST', { amount: '1000', mode: 'REDUCE_INSTALLMENT', walletId: W });
  assert(red.status === 200 && red.body.applied.termsAfter === red.body.applied.termsBefore, 'manter o prazo');
});

await check('saldo oficial informado pelo credor aparece com a divergência da estimativa (RN049)', async () => {
  const r = await api(`/financings/${F}/official-balance`, t, 'PUT', { amount: '7000.00' });
  const s = r.body.financing.summary;
  assert(s.officialBalance === '7000.00' && s.divergence !== null && s.isEstimate === true, JSON.stringify(s));
});

await check('SAC (parcela decrescente), cronograma importado e parcela manual', async () => {
  S = (await api('/financings', t, 'POST', { name: 'Casa', kind: 'REAL_ESTATE', financedAmount: '12000', monthlyRatePercent: '1', system: 'SAC', installments: 12, firstDueDate: add(10) })).body.financing.id;
  const sac = (await api(`/financings/${S}`, t)).body.schedule as any[];
  assert(sac[0].principal === '1000.00' && Number(sac[0].total) > Number(sac[11].total), JSON.stringify([sac[0], sac[11]]));
  const imp = await api('/financings', t, 'POST', { name: 'Empréstimo particular', kind: 'PRIVATE', financedAmount: '600', installments: 2, firstDueDate: add(20), schedule: [{ dueDate: add(20), total: '320' }, { dueDate: add(50), total: '320' }] });
  assert(imp.body.financing.scheduleSource === 'IMPORTED' && imp.body.schedule.length === 2, JSON.stringify(imp.body.financing));
  const man = await api('/financings', t, 'POST', { name: 'Consignado', kind: 'PAYROLL', financedAmount: '1000', installments: 5, firstDueDate: add(30), manualInstallmentAmount: '230' });
  assert(man.body.financing.scheduleSource === 'MANUAL' && man.body.schedule.every((i: any) => i.total === '230.00'), 'manual');
  assert((await api(`/financings/${imp.body.financing.id}/extra-amortization`, t, 'POST', { amount: '100', walletId: W })).status === 422, 'amortização automática só para cronograma calculado');
  assert((await api('/financings', t, 'POST', { name: 'x', kind: 'OTHER', installments: 3, firstDueDate: add(5) })).status === 400, 'sem valor');
});

await check('quitação cancela as parcelas futuras por quitação e preserva o histórico (RN048)', async () => {
  const before = await bal();
  const r = await api(`/financings/${S}/payoff`, t, 'POST', { walletId: W });
  assert(r.status === 200 && r.body.financing.status === 'PAID_OFF', JSON.stringify(r.body.financing));
  assert(r.body.schedule.every((i: any) => i.status === 'canceled_payoff'), 'parcelas canceladas por quitação');
  assert(Math.round(cents(before) - cents(await bal())) === 1200000, `quitou o saldo estimado: ${before} → ${await bal()}`);
  assert((await api(`/financings/${S}/payoff`, t, 'POST', { walletId: W })).status === 422, 'já encerrado');
  assert((await api(`/financings/${S}/installments/1/pay`, t, 'POST', { walletId: W })).status === 422, 'não paga parcela cancelada');
});

await check('consórcio: contrato, histórico anterior, pagamento com atraso e antecipação', async () => {
  const r = await api('/consortiums', t, 'POST', { name: 'Imóvel', administrator: 'Porto', groupNumber: '2041', quota: '118', kind: 'REAL_ESTATE', initialLetter: '100000', installments: 10, installmentAmount: '1000', firstDueDate: add(-60), alreadyPaid: 2, adjustmentRule: 'INCC', nextAssemblyDate: add(7) });
  assert(r.status === 201, JSON.stringify(r.body));
  C = r.body.consortium.id;
  assert(r.body.consortium.summary.paidCount === 2 && r.body.consortium.summary.remainingCount === 8, JSON.stringify(r.body.consortium.summary));
  assert((await bal()).length > 0 && (await api(`/wallets/${W}/reconcile`, t)).body.consistent === true, 'histórico anterior não movimenta saldo');
  const before = await bal();
  const p = await api(`/consortiums/${C}/pay`, t, 'POST', { walletId: W, numbers: [3], lateFee: '15.00' });
  assert(p.status === 200 && p.body.consortium.summary.paidCount === 3, JSON.stringify(p.body.consortium.summary));
  assert(cents(before) - cents(await bal()) === 100000 + 1500, `saldo ${before} → ${await bal()}`);
  const adv = await api(`/consortiums/${C}/pay`, t, 'POST', { walletId: W, numbers: [8, 9], date: add(0) });
  assert(adv.body.consortium.summary.paidCount === 5, 'antecipação de várias parcelas');
  assert((await api(`/consortiums/${C}/pay`, t, 'POST', { walletId: W, numbers: [3] })).status === 422, 'parcela já paga');
  const cal = (await api(`/calendar?from=${add(0)}&to=${add(30)}`, t)).body;
  assert(cal.events.some((e: any) => e.title === 'Assembleia do consórcio'), 'assembleia na agenda');
});

await check('reajuste da carta e da parcela (valor ou %), com histórico e vigência (RN052/053)', async () => {
  const a = await api(`/consortiums/${C}/adjustments`, t, 'POST', { target: 'LETTER', mode: 'PERCENT', value: '5.2', source: 'ADMINISTRATOR', note: 'INCC' });
  assert(a.status === 201 && a.body.consortium.summary.currentLetter === '105200.00' && a.body.consortium.summary.letterGrowthPercent === 5.2, JSON.stringify(a.body.consortium.summary));
  const b = await api(`/consortiums/${C}/adjustments`, t, 'POST', { target: 'INSTALLMENT', mode: 'AMOUNT', value: '50', effectiveDate: add(-30) });
  assert(b.body.consortium.installmentAmount === '1050.00', JSON.stringify(b.body.consortium));
  const pending = b.body.schedule.filter((i: any) => i.status === 'pending');
  assert(pending.length > 0 && pending.every((i: any) => i.amount === '1050.00'), 'parcelas pendentes reajustadas');
  assert(b.body.adjustments.length === 2 && b.body.adjustments[0].source, 'histórico');
  assert((await api(`/consortiums/${C}/adjustments`, t, 'POST', { target: 'LETTER', mode: 'AMOUNT', value: '-999999' })).status === 422, 'não pode zerar');
  assert(b.body.consortium.summary.note.includes('não é dinheiro disponível'), 'aviso sobre valorização');
});

await check('contemplação é evento: liberação só depois dela e NADA move a carteira (RN055/056/058)', async () => {
  const before = await bal();
  assert((await api(`/consortiums/${C}/events`, t, 'POST', { kind: 'RELEASE', amount: '100000' })).status === 422, 'liberar antes de contemplar');
  assert((await api(`/consortiums/${C}/events`, t, 'POST', { kind: 'BID', amount: '38000', description: 'Lance de 38%' })).status === 201, 'lance');
  const c = await api(`/consortiums/${C}/events`, t, 'POST', { kind: 'CONTEMPLATION', modality: 'lance' });
  assert(c.body.consortium.status === 'CONTEMPLATED', JSON.stringify(c.body.consortium.status));
  assert((await api(`/consortiums/${C}/events`, t, 'POST', { kind: 'CONTEMPLATION' })).status === 409, 'já contemplado');
  const rel = await api(`/consortiums/${C}/events`, t, 'POST', { kind: 'USE', amount: '95000', description: 'Compra do imóvel' });
  assert(rel.body.consortium.summary.receivedOrUsed === '95000.00' && rel.body.consortium.summary.remainingObligations !== '0.00', 'obrigações continuam após a contemplação');
  assert((await bal()) === before, 'eventos não movimentam saldo');
});

await check('calendário e dashboard enxergam as parcelas; projeção as subtrai; resumo de dívidas', async () => {
  const cal = (await api(`/calendar?from=${add(0)}&to=${add(60)}`, t)).body;
  const kinds = new Set(cal.events.map((e: any) => e.kind));
  assert(kinds.has('financing') && kinds.has('consortium'), [...kinds].join());
  const proj = (await api('/cash-flow/projection?days=60', t)).body;
  assert(Number(proj.endBalance) < Number(proj.startBalance), `projeção deve cair: ${proj.startBalance} → ${proj.endBalance}`);
  const dash = (await api('/dashboard?period=month', t)).body.upcoming;
  assert(Number(dash.debtsDue) > 0 && Number(dash.plannedExpense) >= Number(dash.debtsDue), JSON.stringify(dash));
  const sum = (await api('/debts/summary', t)).body;
  assert(sum.isEstimate === true && Number(sum.estimatedBalance) > 0 && Number(sum.monthlyPayments) > 0 && sum.note, JSON.stringify(sum));
});

await check('isolamento entre usuários e validações', async () => {
  assert((await api(`/financings/${F}`, other)).status === 404, 'contrato alheio');
  assert((await api(`/consortiums/${C}`, other)).status === 404, 'consórcio alheio');
  assert((await api(`/financings/${F}/installments/3/pay`, other, 'POST', { walletId: W })).status === 404, 'pagar parcela alheia');
  assert((await api('/financings', other)).body.financings.length === 0, 'lista vazia');
  assert((await api('/financings', t, 'POST', { name: 'x', kind: 'OTHER', financedAmount: '100', installments: 0, firstDueDate: add(5) })).status === 400, 'prazo inválido');
  assert((await api(`/financings/${F}/installments/1/pay`, t, 'POST', { walletId: 'nao-uuid' })).status === 400, 'uuid inválido');
  assert((await http(CORE, '/api/v1/debts/summary')).status === 401, 'sem token');
});

finish();
