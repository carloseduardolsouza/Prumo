import { CORE, assert, check, finish, http } from './lib.js';

console.log('E8 — Investimentos');

const api = (path: string, token: string, method = 'GET', body?: unknown) => http(CORE, `/api/v1${path}`, { method, token, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const reg = async (n: string) => (await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: `Inv ${n}`, email: `inv${n}+${Date.now()}@prumo.test`, password: 'senha-segura-123' }) })).body.accessToken as string;
const add = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const t = await reg('A');
const other = await reg('B');
let W = '', B = '', A = '';
const bal = async () => (await api(`/wallets/${W}`, t)).body.wallet.balance as string;

await check('prepara carteira pessoal com R$ 20.000 e corretora', async () => {
  W = (await api('/wallets', t, 'POST', { name: 'Itaú', type: 'CHECKING', openingBalance: '20000.00' })).body.wallet.id;
  const r = await api('/investments/brokerages', t, 'POST', { name: 'Inter Invest' });
  assert(r.status === 201, JSON.stringify(r.body));
  B = r.body.id;
});

await check('aporte sai da carteira como transferência: saldo cai, NÃO vira despesa (RN059)', async () => {
  const r = await api('/investments/operations', t, 'POST', { kind: 'CONTRIBUTION', brokerageId: B, amount: '5000', walletId: W });
  assert(r.status === 201, JSON.stringify(r.body));
  assert((await bal()) === '15000.00', `saldo ${await bal()}`);
  const d = (await api('/dashboard?period=month', t)).body;
  assert(Number(d.expenses ?? d.totals?.expenses ?? 0) === 0, 'aporte não é despesa');
});

await check('compra cria o ativo, custo médio com taxa e caixa da corretora', async () => {
  const r = await api('/investments/operations', t, 'POST', { kind: 'BUY', brokerageId: B, asset: { ticker: 'itsa4', name: 'Itaúsa', assetClass: 'STOCK' }, quantity: '100', unitPrice: '10', fees: '10' });
  assert(r.status === 201, JSON.stringify(r.body));
  A = r.body.investmentId;
  await api('/investments/operations', t, 'POST', { kind: 'BUY', brokerageId: B, investmentId: A, quantity: '100', unitPrice: '12' });
  const a = (await api(`/investments/assets/${A}`, t)).body.asset;
  assert(a.ticker === 'ITSA4' && a.quantity === '200', JSON.stringify(a));
  assert(a.averageCost === '11.05' && a.invested === '2210.00', JSON.stringify(a));
  const b = (await api('/investments/brokerages', t)).body.brokerages[0];
  assert(b.cash === '2790.00', JSON.stringify(b)); // 5000 - 1010 - 1200
});

await check('cotação manual muda o valor e o resultado não realizado', async () => {
  assert((await api(`/investments/assets/${A}/quote`, t, 'PUT', { price: '13' })).status === 200, 'cotação');
  const a = (await api(`/investments/assets/${A}`, t)).body.asset;
  assert(a.value === '2600.00' && a.unrealized === '390.00', JSON.stringify(a));
});

await check('venda calcula resultado realizado; vender mais do que tem é recusado', async () => {
  assert((await api('/investments/operations', t, 'POST', { kind: 'SELL', brokerageId: B, investmentId: A, quantity: '500', unitPrice: '13' })).status === 422, 'venda acima da posição');
  assert((await api('/investments/operations', t, 'POST', { kind: 'SELL', brokerageId: B, investmentId: A, quantity: '50', unitPrice: '13', fees: '5' })).status === 201, 'venda');
  const o = (await api('/investments/overview', t)).body;
  assert(o.realized === '92.50', `realizado ${o.realized}`); // 650-5-50*11.05
  assert(o.contributed === '5000.00', 'aportado');
});

await check('provento futuro entra na agenda e no calendário; passado entra no caixa', async () => {
  await api('/investments/operations', t, 'POST', { kind: 'DIVIDEND', brokerageId: B, investmentId: A, amount: '40', dividendKind: 'JCP', date: add(5) });
  await api('/investments/operations', t, 'POST', { kind: 'DIVIDEND', brokerageId: B, investmentId: A, amount: '30', fees: '3', dividendKind: 'DIVIDENDO' });
  const o = (await api('/investments/overview', t)).body;
  assert(o.dividends.upcoming.length === 1 && o.dividends.upcoming[0].amount === '40.00', JSON.stringify(o.dividends));
  assert(o.dividends.last12m === '27.00', o.dividends.last12m);
  const cal = (await api(`/calendar?from=${add(0)}&to=${add(10)}`, t)).body;
  assert(cal.events.some((e: any) => e.kind === 'investment'), 'evento de investimento no calendário');
});

await check('alerta de preço dispara ao cruzar o alvo', async () => {
  assert((await api('/investments/alerts', t, 'POST', { investmentId: A, direction: 'ABOVE', price: '14' })).status === 201, 'cria');
  await api(`/investments/assets/${A}/quote`, t, 'PUT', { price: '14.5' });
  assert((await api('/investments/alerts', t)).body.alerts[0].triggered === true, 'disparou');
});

await check('metas de alocação e sugestão de rebalanceamento', async () => {
  assert((await api('/investments/targets', t, 'PUT', { targets: [{ assetClass: 'STOCK', percent: 60 }, { assetClass: 'FII', percent: 40 }] })).status === 200, 'metas');
  assert((await api('/investments/targets', t, 'PUT', { targets: [{ assetClass: 'STOCK', percent: 80 }, { assetClass: 'FII', percent: 40 }] })).status >= 400, 'soma >100 recusada');
  const r = (await api('/investments/rebalance?contribution=1000', t)).body;
  const fii = r.classes.find((c: any) => c.assetClass === 'FII');
  assert(fii && Number(fii.suggestedContribution) > 0, JSON.stringify(r));
});

await check('perfil de investidor e apuração de IR (isento abaixo de R$ 20 mil)', async () => {
  assert((await api('/investments/profile', t, 'PUT', { answers: [2, 2, 2, 2, 2] })).body.profile === 'MODERATE', 'perfil');
  const tax = (await api('/investments/tax', t)).body;
  assert(tax.months[0].exempt === true && tax.totalTax === '0.00' && tax.holdings.length === 1, JSON.stringify(tax));
});

await check('cancelar o aporte estorna o ledger e isola dados entre usuários', async () => {
  const ops = (await api('/investments/operations?kind=CONTRIBUTION', t)).body.operations;
  assert((await api(`/investments/operations/${ops[0].id}`, t, 'DELETE')).status === 200, 'cancela');
  assert((await bal()) === '20000.00', `saldo ${await bal()}`);
  assert((await api(`/investments/assets/${A}`, other)).status === 404, 'ativo de outro usuário');
  assert((await api('/investments/overview', other)).body.patrimony === '0.00', 'visão vazia');
});

finish();
