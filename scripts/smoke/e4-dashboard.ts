import { CORE, assert, check, finish, http } from './lib.js';

console.log('E4 — Dashboard e relatórios');

const api = (path: string, token: string, method = 'GET', body?: unknown) => http(CORE, `/api/v1${path}`, { method, token, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const reg = async (n: string) => (await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: `Dash ${n}`, email: `dash${n}+${Date.now()}@prumo.test`, password: 'senha-segura-123' }) })).body.accessToken as string;

const t = await reg('A');
const other = await reg('B');
const now = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = iso(now);
const mk = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
// datas seguras dentro do mês atual e do anterior, independentemente de quando o teste rodar
const thisMonthDay = mk(now.getFullYear(), now.getMonth() + 1, 1);
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const prevDay = mk(prev.getFullYear(), prev.getMonth() + 1, 15);

let A = '', B = '';
const cats = (await api('/categories', t)).body.categories as any[];
const cat = (name: string, type: string) => cats.find((c) => c.name === name && c.type === type)?.id as string;

await check('prepara dados: duas contas, receitas e despesas em categorias diferentes', async () => {
  A = (await api('/wallets', t, 'POST', { name: 'Itaú', type: 'CHECKING', openingBalance: '1000.00', openingDate: prevDay })).body.wallet.id;
  B = (await api('/wallets', t, 'POST', { name: 'Reserva', type: 'SAVINGS', openingBalance: '0' })).body.wallet.id;
  const tx = (b: object) => api('/transactions', t, 'POST', { settled: true, walletId: A, ...b });
  const rs = await Promise.all([
    tx({ type: 'INCOME', description: 'Salário', amount: '5000', categoryId: cat('Salário', 'INCOME'), paidDate: thisMonthDay }),
    tx({ type: 'EXPENSE', description: 'Energia', amount: '200', categoryId: cats.find((c) => c.name === 'Energia').id, paidDate: thisMonthDay }),
    tx({ type: 'EXPENSE', description: 'Água', amount: '100', categoryId: cats.find((c) => c.name === 'Água').id, paidDate: thisMonthDay }),
    tx({ type: 'EXPENSE', description: 'Cinema', amount: '100', categoryId: cat('Lazer', 'EXPENSE'), paidDate: today }),
    tx({ type: 'EXPENSE', description: 'Sem categoria', amount: '50', paidDate: today }),
    tx({ type: 'EXPENSE', description: 'Mês passado', amount: '300', categoryId: cat('Lazer', 'EXPENSE'), paidDate: prevDay }),
  ]);
  assert(rs.every((r) => r.status === 201), JSON.stringify(rs.map((r) => r.status)));
  // previsto não entra no dashboard; vence nos próximos 30 dias
  await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'Futuro', amount: '400', dueDate: today });
  // transferência não pode virar receita nem despesa
  await api('/transfers', t, 'POST', { fromWalletId: A, toWalletId: B, amount: '700', date: today });
});

await check('mês atual: totais efetivados, sem previstos e sem transferências (RN073)', async () => {
  const r = await api('/dashboard?period=month', t);
  assert(r.status === 200, JSON.stringify(r.body));
  const s = r.body.summary;
  assert(s.income === '5000.00' && s.expense === '450.00' && s.result === '4550.00' && s.savingsRate === 91, JSON.stringify(s));
  assert(r.body.period.from.endsWith('-01') && r.body.period.bucket === 'week', JSON.stringify(r.body.period));
});

await check('despesas por categoria: subcategorias somam no pai e os percentuais fecham', async () => {
  const e = (await api('/dashboard?period=month', t)).body.expensesByCategory as any[];
  const by = Object.fromEntries(e.map((x) => [x.name, x]));
  assert(by['Moradia'].amount === '300.00' && by['Moradia'].children.length === 2, JSON.stringify(by['Moradia']));
  assert(by['Lazer'].amount === '100.00' && by['Sem categoria'].amount === '50.00', JSON.stringify(e));
  const total = e.reduce((s, x) => s + x.percent, 0);
  assert(Math.abs(total - 100) < 0.3, `percentuais somam ${total}`);
  assert(e[0].name === 'Moradia', 'ordenado do maior para o menor');
  const inc = (await api('/dashboard?period=month', t)).body.incomeByCategory as any[];
  assert(inc.length === 1 && inc[0].name === 'Salário' && inc[0].percent === 100, JSON.stringify(inc));
});

await check('série receitas × despesas cobre o mês e soma igual ao resumo', async () => {
  const r = (await api('/dashboard?period=month', t)).body;
  const inc = r.series.reduce((s: number, b: any) => s + Number(b.income), 0);
  const exp = r.series.reduce((s: number, b: any) => s + Number(b.expense), 0);
  assert(Math.round(inc * 100) === 500000 && Math.round(exp * 100) === 45000, `série ${inc}/${exp}`);
  assert(r.series.length >= 4 && r.series[0].label === 'Sem 1', JSON.stringify(r.series.map((b: any) => b.label)));
});

await check('evolução do saldo termina no saldo atual das contas (reconciliação com os módulos)', async () => {
  const r = (await api('/dashboard?period=year', t)).body;
  const last = r.balanceEvolution.at(-1);
  assert(last.balance === r.balance.total, `evolução ${last.balance} ≠ saldo ${r.balance.total}`);
  // 1000 abertura + 5000 - 450 - 300 (mês passado) = 5250 ; transferência para a Reserva não muda o total
  assert(r.balance.total === '5250.00', `saldo total ${r.balance.total}`);
  assert(r.balanceEvolution.length <= 61, 'amostragem');
});

await check('mês anterior, 3 meses, hoje e personalizado', async () => {
  const p = (await api('/dashboard?period=prev_month', t)).body;
  assert(p.summary.expense === '300.00' && p.summary.income === '0.00' && p.summary.savingsRate === null, JSON.stringify(p.summary));
  const m3 = (await api('/dashboard?period=3m', t)).body;
  assert(m3.series.length === 3 && m3.summary.expense === '750.00', JSON.stringify(m3.summary));
  const td = (await api('/dashboard?period=today', t)).body;
  assert(Number(td.summary.expense) >= 150, JSON.stringify(td.summary));
  const c = (await api(`/dashboard?period=custom&from=${prevDay}&to=${prevDay}`, t)).body;
  assert(c.summary.expense === '300.00', JSON.stringify(c.summary));
  assert((await api('/dashboard?period=custom', t)).status === 400, 'custom exige from/to');
  assert((await api('/dashboard?period=custom&from=2026-02-10&to=2026-02-01', t)).status === 400, 'from > to');
  assert((await api('/dashboard?period=xx', t)).status === 400, 'período inválido');
});

await check('compromissos futuros: previstos dos próximos 30 dias', async () => {
  const u = (await api('/dashboard?period=month', t)).body.upcoming;
  assert(u.plannedExpense === '400.00' && u.plannedIncome === '0.00', JSON.stringify(u));
});

await check('relatórios: por categoria, resultado mensal e transferências', async () => {
  const from = thisMonthDay, to = today;
  const c = (await api(`/reports/by-category?type=EXPENSE&from=${from}&to=${to}`, t)).body;
  assert(c.total === '450.00' && c.items.length === 3 && c.methodology, JSON.stringify(c));
  const m = (await api(`/reports/monthly-result?year=${now.getFullYear()}`, t)).body;
  assert(m.months.length === 12 && m.totals.income === '5000.00', JSON.stringify(m.totals));
  const cur = m.months[now.getMonth()];
  assert(cur.result === '4550.00', JSON.stringify(cur));
  const tr = (await api(`/reports/transfers?from=${from}&to=${to}`, t)).body;
  assert(tr.total === '700.00' && tr.items[0].fromWalletName === 'Itaú' && tr.items[0].toWalletName === 'Reserva', JSON.stringify(tr));
  assert((await api('/reports/by-category?from=2026-13-01&to=2026-13-02', t)).status === 400, 'data inválida');
});

await check('cancelar um lançamento atualiza o dashboard (sem duplicar impacto)', async () => {
  const st = (await api(`/statement?from=${today}&to=${today}&q=cinema`, t)).body.items[0];
  await api(`/transactions/${st.id}/cancel`, t, 'POST');
  const r = (await api('/dashboard?period=month', t)).body;
  assert(r.summary.expense === '350.00', `despesa ${r.summary.expense}`);
  assert(!r.expensesByCategory.some((x: any) => x.name === 'Lazer'), 'categoria Lazer deveria sumir do mês');
});

await check('isolamento e autenticação', async () => {
  const o = (await api('/dashboard?period=month', other)).body;
  assert(o.summary.income === '0.00' && o.summary.expense === '0.00' && o.expensesByCategory.length === 0 && o.balance.total === '0.00', JSON.stringify(o.summary));
  assert((await http(CORE, '/api/v1/dashboard')).status === 401, 'sem token');
  void B;
});

finish();
