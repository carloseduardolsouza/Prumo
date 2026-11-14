import { CORE, assert, check, finish, http } from './lib.js';

console.log('E9 — Planejamento, saúde financeira e visão integrada');

const api = (path: string, token: string, method = 'GET', body?: unknown) => http(CORE, `/api/v1${path}`, { method, token, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const reg = async (n: string) => (await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: `Plan ${n}`, email: `plan${n}+${Date.now()}@prumo.test`, password: 'senha-segura-123' }) })).body.accessToken as string;

const t = await reg('A');
const other = await reg('B');
const cats = (await api('/categories', t)).body.categories as any[];
const lazer = cats.find((c) => c.name === 'Lazer' && c.type === 'EXPENSE').id as string;
const sub = cats.find((c) => c.parentId === lazer)?.id as string | undefined;
let W = '', G = '', B = '';
const bal = async () => (await api(`/wallets/${W}`, t)).body.wallet.balance as string;

await check('prepara carteira com R$ 10.000, salário e despesa em Lazer', async () => {
  W = (await api('/wallets', t, 'POST', { name: 'Itaú', type: 'CHECKING', openingBalance: '10000.00' })).body.wallet.id;
  await api('/transactions', t, 'POST', { type: 'INCOME', description: 'Salário', amount: '6000', walletId: W, settled: true });
  assert((await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'Cinema', amount: '170', walletId: W, categoryId: sub ?? lazer, settled: true })).status === 201, 'despesa');
});

await check('orçamento por categoria principal; subcategoria soma no pai e vira ATENÇÃO aos 85% (RN076-078)', async () => {
  const r = await api(`/budgets/${lazer}`, t, 'PUT', { amount: '200' });
  assert(r.status === 200, JSON.stringify(r.body));
  const i = r.body.items[0];
  assert(i.spent === '170.00' && i.percent === 85 && i.status === 'warn', JSON.stringify(i));
  if (sub) assert((await api(`/budgets/${sub}`, t, 'PUT', { amount: '50' })).status === 422, 'só categoria principal');
});

await check('"pode gastar hoje" considera o que sobra do orçamento e os dias restantes', async () => {
  const s = (await api('/budgets/spendable', t)).body;
  assert(s.hasBudget === true && s.week.length === 7 && Number(s.free) === 30 && s.daysLeft >= 1, JSON.stringify(s));
  assert((await api('/budgets/spendable', other)).body.hasBudget === false, 'sem orçamento');
});

await check('meta de poupança: aporte simbólico não mexe no saldo; ao chegar no alvo vira REACHED', async () => {
  const before = await bal();
  const r = await api('/goals', t, 'POST', { name: 'Viagem', targetAmount: '1000', initialAmount: '400' });
  assert(r.status === 201 && r.body.saved === '400.00' && r.body.percent === 40, JSON.stringify(r.body));
  G = r.body.id;
  const c = await api(`/goals/${G}/contributions`, t, 'POST', { amount: '600' });
  assert(c.status === 201 && c.body.goal.status === 'REACHED' && c.body.goal.saved === '1000.00', JSON.stringify(c.body));
  assert((await bal()) === before, 'saldo da carteira intacto');
  const w = await api(`/goals/${G}/contributions`, t, 'POST', { amount: '-100' });
  assert(w.body.goal.status === 'ACTIVE', 'retirada reabre a meta');
  assert((await api(`/goals/${G}/contributions`, t, 'POST', { amount: '-5000' })).status === 422, 'retirada maior que o guardado');
});

await check('aporte automático só registra quando o usuário confirma (uma vez por mês)', async () => {
  B = (await api('/investments/brokerages', t, 'POST', { name: 'Corretora' })).body.id;
  const r = await api('/auto-invest', t, 'POST', { walletId: W, brokerageId: B, amount: '500', dayOfMonth: 1 });
  assert(r.status === 201 && r.body.rules[0].due === true, JSON.stringify(r.body));
  const before = Number(await bal());
  const ok = await api(`/auto-invest/${r.body.rules[0].id}/confirm`, t, 'POST');
  assert(ok.status === 200 && ok.body.rules[0].due === false, JSON.stringify(ok.body));
  assert(Number(await bal()) === before - 500, 'saiu da carteira');
  assert((await api(`/auto-invest/${r.body.rules[0].id}/confirm`, t, 'POST')).status === 422, 'só uma vez no mês');
});

await check('nota de saúde financeira com pilares e dicas, sem dados vira nula', async () => {
  const h = (await api('/insights/health-score', t)).body;
  assert(typeof h.score === 'number' && h.pillars.length >= 3 && h.pillars.some((p: any) => p.id === 'savings'), JSON.stringify(h));
  assert((await api('/insights/health-score', other)).body.score === null, 'usuário sem dados não recebe nota');
});

await check('patrimônio líquido soma pessoal + investimentos − dívidas sem dupla contagem', async () => {
  const f = await api('/financings', t, 'POST', { name: 'Carro', kind: 'VEHICLE', financedAmount: '3000', monthlyRatePercent: '0', system: 'PRICE', installments: 3, firstDueDate: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10), walletId: W });
  assert(f.status === 201, JSON.stringify(f.body));
  const n = (await api('/insights/net-worth', t)).body;
  const sum = Number(n.parts.personal) + Number(n.parts.investments) + Number(n.parts.financings) + Number(n.parts.cardInvoices);
  assert(Math.abs(sum - Number(n.total)) < 0.01, `total ${n.total} ≠ ${sum}`);
  assert(n.parts.financings === '-3000.00' && n.parts.investments === '500.00', JSON.stringify(n.parts)); // aporte de 500 está na corretora, e não na carteira
  assert(n.series.length === 12, 'série de 12 meses');
});

await check('meta de liberdade financeira acompanha a renda passiva (não recebe aporte)', async () => {
  const f = await api('/goals', t, 'POST', { name: 'Renda passiva', kind: 'FREEDOM', targetAmount: '3000' });
  assert(f.status === 201 && f.body.saved === '0.00', JSON.stringify(f.body));
  assert((await api(`/goals/${f.body.id}/contributions`, t, 'POST', { amount: '10' })).status === 422, 'sem aporte');
});

await check('exportação CSV tem BOM, cabeçalho e neutraliza fórmulas', async () => {
  await api('/transactions', t, 'POST', { type: 'EXPENSE', description: '=HYPERLINK("x")', amount: '1', walletId: W, settled: true });
  const d = new Date().toISOString().slice(0, 10);
  const res = await fetch(`${CORE}/api/v1/insights/export?kind=transactions&from=${d}&to=${d}`, { headers: { authorization: `Bearer ${t}` } });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString('utf8');
  assert(res.headers.get('content-type')?.includes('text/csv') && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf && text.includes('Data;Tipo'), text.slice(0, 40));
  assert(text.includes(`'=HYPERLINK`), 'fórmula neutralizada');
});

await check('isolamento: outro usuário não vê metas nem orçamentos', async () => {
  assert((await api('/goals', other)).body.goals.length === 0, 'metas');
  assert((await api(`/goals/${G}`, other)).status === 404, 'meta alheia');
  assert((await api('/budgets', other)).body.items.length === 0, 'orçamentos');
});

finish();
