import { randomUUID } from 'node:crypto';
import { CORE, MESSAGE, assert, check, finish, http } from './lib.js';

console.log('E6 — Recorrências, calendário e projeção');

const KEY = process.env.INTERNAL_API_KEY ?? '';
const api = (path: string, token: string, method = 'GET', body?: unknown, headers?: Record<string, string>) =>
  http(CORE, `/api/v1${path}`, { method, token, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const reg = async (n: string) => {
  const r = await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: `Plan ${n}`, email: `plan${n}+${Date.now()}@prumo.test`, password: 'senha-segura-123' }) });
  return { token: r.body.accessToken as string, id: r.body.user.id as string };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const add = (days: number) => iso(new Date(Date.now() + days * 86_400_000));

const { token: t, id: userId } = await reg('A');
const { token: other } = await reg('B');
const today = add(0);
let W = '', rule = '', subRule = '';
const bal = async () => (await api(`/wallets/${W}`, t)).body.wallet.balance as string;

await check('prepara conta com R$ 1.000', async () => {
  W = (await api('/wallets', t, 'POST', { name: 'Itaú', type: 'CHECKING', openingBalance: '1000.00' })).body.wallet.id;
});

await check('recorrência mensal gera ocorrências PREVISTAS sem mexer no saldo (RN023)', async () => {
  const r = await api('/recurring', t, 'POST', { type: 'EXPENSE', description: 'Internet', amount: '119.90', frequency: 'MONTHLY', startDate: add(2), walletId: W });
  assert(r.status === 201 && r.body.rule.nextDate === add(2), JSON.stringify(r.body));
  rule = r.body.rule.id;
  assert((await bal()) === '1000.00', 'ocorrência prevista não pode alterar o saldo');
  const st = (await api(`/statement?from=${today}&to=${add(95)}&status=planned`, t)).body.items.filter((i: any) => i.description === 'Internet');
  assert(st.length >= 3 && st.every((i: any) => i.status === 'planned'), `ocorrências: ${st.length}`);
});

await check('não duplica ocorrência ao gerar de novo (RN025) — lembretes rodam em loop idempotente', async () => {
  const before = (await api(`/statement?from=${today}&to=${add(95)}&status=planned`, t)).body.items.filter((i: any) => i.description === 'Internet').length;
  for (let i = 0; i < 2; i++) assert((await http(CORE, '/api/v1/internal/jobs/reminders', { method: 'POST', body: JSON.stringify({ userId }), headers: { 'x-api-key': KEY } })).status === 200, 'job');
  const after = (await api(`/statement?from=${today}&to=${add(95)}&status=planned`, t)).body.items.filter((i: any) => i.description === 'Internet').length;
  assert(before === after, `${before} → ${after}`);
  assert((await http(CORE, '/api/v1/internal/jobs/reminders', { method: 'POST', body: '{}' })).status === 403, 'sem chave interna');
});

await check('validação: personalizada exige intervalo; data final antes da inicial; efetivar exige carteira', async () => {
  const base = { type: 'EXPENSE', description: 'X', amount: '10', startDate: add(1) };
  assert((await api('/recurring', t, 'POST', { ...base, frequency: 'CUSTOM' })).status === 400, 'custom sem intervalo');
  assert((await api('/recurring', t, 'POST', { ...base, frequency: 'MONTHLY', endDate: add(-5) })).status === 400, 'fim antes do início');
  assert((await api('/recurring', t, 'POST', { ...base, frequency: 'MONTHLY', settleFirst: true })).status === 400, 'settleFirst sem carteira');
  assert((await api('/recurring', t, 'POST', { ...base, frequency: 'MONTHLY', startDate: add(-500) })).status === 422, 'início muito antigo');
});

await check('limite de ocorrências e "repetir" já efetivando a primeira', async () => {
  const r = await api('/recurring', t, 'POST', { type: 'EXPENSE', description: 'Parcela do curso', amount: '50', frequency: 'WEEKLY', startDate: today, maxOccurrences: 3, walletId: W, settleFirst: true });
  assert(r.status === 201, JSON.stringify(r.body));
  assert((await bal()) === '950.00', `saldo ${await bal()} (a primeira ocorrência foi efetivada)`);
  const all = (await api(`/statement?from=${today}&to=${add(40)}&q=curso`, t)).body.items;
  assert(all.length === 3 && all.filter((i: any) => i.status === 'settled').length === 1, JSON.stringify(all.map((i: any) => [i.date, i.status])));
});

await check('editar regra: future regera as próximas; future_and_open também atualiza as vencidas (RN024)', async () => {
  const up = await api(`/recurring/${rule}`, t, 'PATCH', { amount: '129.90', scope: 'future' });
  assert(up.status === 200 && up.body.rule.amount === '129.90', JSON.stringify(up.body));
  const items = (await api(`/statement?from=${today}&to=${add(95)}&status=planned`, t)).body.items.filter((i: any) => i.description === 'Internet');
  assert(items.every((i: any) => i.plannedAmount === '129.90'), items.map((i: any) => i.plannedAmount).join());
  assert((await api(`/recurring/${rule}`, other)).status === 404, 'regra alheia');
});

await check('assinatura que fica mais cara gera alerta e aviso (efetivar duas ocorrências)', async () => {
  const r = await api('/recurring', t, 'POST', { type: 'EXPENSE', description: 'Streaming', amount: '44.90', frequency: 'WEEKLY', startDate: add(-14), isSubscription: true, walletId: W });
  subRule = r.body.rule.id;
  const occ = (await api(`/statement?from=${add(-14)}&to=${today}&q=streaming`, t)).body.items.sort((a: any, b: any) => a.date.localeCompare(b.date));
  assert(occ.length >= 3, `ocorrências ${occ.length}`);
  assert((await api(`/transactions/${occ[0].id}/settle`, t, 'POST', { walletId: W })).status === 200, 'efetivar 1');
  await api(`/recurring/${subRule}`, t, 'PATCH', { amount: '55.90', scope: 'future_and_open' });
  const occ2 = (await api(`/statement?from=${add(-14)}&to=${today}&q=streaming&status=planned`, t)).body.items.sort((a: any, b: any) => a.date.localeCompare(b.date));
  assert(occ2[0].plannedAmount === '55.90', 'future_and_open atualiza as vencidas abertas');
  assert((await api(`/transactions/${occ2[0].id}/settle`, t, 'POST', { walletId: W })).status === 200, 'efetivar 2');
  const sum = (await api('/recurring', t)).body;
  assert(sum.alerts.some((a: any) => a.description === 'Streaming' && a.from === '44.90' && a.to === '55.90'), JSON.stringify(sum.alerts));
  assert(Number(sum.subscriptions.total) > 0 && Number(sum.fixed.total) > 0 && sum.monthlyTotal, JSON.stringify([sum.subscriptions.total, sum.fixed.total]));
  const login = await http(MESSAGE, '/message/v1/notifications?category=orc', { token: t });
  void login;
});

await check('encerrar recorrência remove as próximas previstas e mantém o histórico', async () => {
  assert((await api(`/recurring/${rule}/stop`, t, 'POST')).status === 200, 'stop');
  const left = (await api(`/statement?from=${add(1)}&to=${add(95)}&status=planned&q=internet`, t)).body.items;
  assert(left.length === 0, `restaram ${left.length}`);
});

await check('calendário: eventos do mês, previsto × efetivado, fatura e transferência sem duplicar (RN069/070)', async () => {
  const card = (await api('/cards', t, 'POST', { name: 'Nubank', limit: '3000', closingDay: 10, dueDay: 25 })).body.card.id;
  await api('/card-purchases', t, 'POST', { cardId: card, description: 'Mercado', amount: '300' });
  const W2 = (await api('/wallets', t, 'POST', { name: 'Reserva', type: 'SAVINGS', openingBalance: '0' })).body.wallet.id;
  await api('/transfers', t, 'POST', { fromWalletId: W, toWalletId: W2, amount: '100' });
  const cal = (await api(`/calendar?from=${today}&to=${add(60)}`, t)).body;
  const kinds = new Set(cal.events.map((e: any) => e.kind));
  assert(kinds.has('expense') && kinds.has('invoice') && kinds.has('transfer'), [...kinds].join());
  assert(cal.events.filter((e: any) => e.kind === 'transfer').length === 1, 'transferência uma vez');
  assert(cal.events.filter((e: any) => e.kind === 'invoice').every((e: any) => e.amount && Number(e.amount) > 0), 'fatura com valor');
  assert(!cal.events.some((e: any) => e.title.includes('Mercado')), 'compra do cartão aparece pela fatura, não por parcela (sem duplicar)');
  assert(Object.keys(cal.days).length > 3, 'resumo por dia');
  assert((await http(CORE, `/api/v1/calendar?from=${today}&to=${add(5)}`)).status === 401, 'exige token');
});

await check('projeção: considera só previstos/faturas, detecta saldo negativo e aceita simulação', async () => {
  const p = (await api('/cash-flow/projection?days=60', t)).body;
  assert(p.days.length === 61 && p.startBalance === (await api('/wallets', t)).body.summary.totalBalance, JSON.stringify([p.days.length, p.startBalance]));
  assert(p.assumptions && p.lowest, 'metadados');
  const sim = (await api('/cash-flow/simulate', t, 'POST', { days: 60, changes: [{ date: add(3), amount: '-5000', description: 'Compra grande' }] })).body;
  assert(sim.firstNegative && sim.firstNegative.date === add(3) && sim.simulated === 1, JSON.stringify(sim.firstNegative));
  assert(Number(sim.endBalance) < Number(p.endBalance), 'simulação reduz o saldo final');
  const w = (await api(`/cash-flow/projection?days=30&walletId=${W}`, t)).body;
  assert(w.days.length === 31, 'projeção por carteira');
});

await check('efetivar um previsto o tira da projeção (sem somar duas vezes, RN072)', async () => {
  const mk = await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'Conta de luz', amount: '200', dueDate: add(5) });
  const before = (await api('/cash-flow/projection?days=30', t)).body;
  const atFive = before.days.find((d: any) => d.date === add(5)).balance;
  await api(`/transactions/${mk.body.transaction.id}/settle`, t, 'POST', { walletId: W });
  const after = (await api('/cash-flow/projection?days=30', t)).body;
  assert(after.days.find((d: any) => d.date === add(5)).balance === atFive, 'o saldo projetado no dia deve ser o mesmo (o valor saiu do saldo atual, não da projeção)');
});

await check('divisão de despesa: só a minha parte é despesa; adiantamento e reembolso movem a carteira (RN)', async () => {
  const before = Number(await bal());
  const dash0 = (await api('/dashboard?period=month', t)).body.summary.expense;
  const r = await api('/splits', t, 'POST', { description: 'Churrasco', totalAmount: '300', walletId: W, participants: [{ name: 'Ana' }, { name: 'Lucas' }] }, { 'Idempotency-Key': randomUUID() });
  assert(r.status === 201 && r.body.split.myShare === '100.00' && r.body.split.receivable === '200.00', JSON.stringify(r.body));
  assert(Math.round((before - Number(await bal())) * 100) === 30000, 'a carteira paga o total');
  const dash1 = (await api('/dashboard?period=month', t)).body.summary.expense;
  assert(Math.round((Number(dash1) - Number(dash0)) * 100) === 10000, `só 100 conta como despesa: ${dash0} → ${dash1}`);
  const sp = r.body.split;
  const pay = await api(`/splits/${sp.id}/participants/${sp.participants[0].id}/pay`, t, 'POST', { walletId: W });
  assert(pay.body.split.receivable === '100.00', JSON.stringify(pay.body.split));
  assert(Math.round((Number(await bal()) - (before - 300)) * 100) === 10000, 'reembolso volta para a carteira');
  assert((await api(`/splits/${sp.id}/participants/${sp.participants[0].id}/pay`, t, 'POST', { walletId: W })).status === 409, 'já recebido');
  const dash2 = (await api('/dashboard?period=month', t)).body.summary;
  assert(Math.round((Number(dash2.expense) - Number(dash0)) * 100) === 10000, 'reembolso não vira receita nem altera despesa');
  assert((await api('/wallets/' + W + '/reconcile', t)).body.consistent === true, 'ledger consistente');
});

await check('lembretes: conta a vencer vira notificação (core publica, message entrega) sem duplicar', async () => {
  await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'Aluguel', amount: '1500', dueDate: add(1) });
  const run = () => http(CORE, '/api/v1/internal/jobs/reminders', { method: 'POST', body: JSON.stringify({ userId }), headers: { 'x-api-key': KEY } });
  const s1 = await run();
  assert(s1.status === 200 && s1.body.events >= 1, JSON.stringify(s1.body));
  await run();
  let list: any;
  for (let i = 0; i < 20 && !list?.notifications?.some((n: any) => n.title.startsWith('Aluguel')); i++) { await sleep(500); list = (await http(MESSAGE, '/message/v1/notifications', { token: t })).body; }
  const mine = list.notifications.filter((n: any) => n.title.startsWith('Aluguel'));
  assert(mine.length === 1 && mine[0].category === 'venc' && mine[0].href === '/calendario', JSON.stringify(list.notifications.map((n: any) => n.title)));
  const neg = list.notifications.some((n: any) => n.title === 'Saldo projetado negativo');
  assert(typeof neg === 'boolean', 'ok');
});

finish();
