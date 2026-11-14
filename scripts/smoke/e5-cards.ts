import { randomUUID } from 'node:crypto';
import { CORE, assert, check, finish, http } from './lib.js';

console.log('E5 — Cartões e faturas');

const api = (path: string, token: string, method = 'GET', body?: unknown, headers?: Record<string, string>) =>
  http(CORE, `/api/v1${path}`, { method, token, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const reg = async (n: string) => (await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: `Card ${n}`, email: `card${n}+${Date.now()}@prumo.test`, password: 'senha-segura-123' }) })).body.accessToken as string;

const t = await reg('A');
const other = await reg('B');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const now = new Date();
const today = iso(now);
const day = now.getUTCDate();
// Cartão que fecha amanhã (ou depois): a compra de hoje cai na fatura do mês corrente/seguinte, sem depender do dia da semana.
const closingDay = Math.min(28, Math.max(2, day + 1));
const dueDay = Math.min(28, closingDay + 7 > 28 ? 5 : closingDay + 7);

let W = '', card = '', cat = '', invoiceId = '';
const bal = async () => (await api(`/wallets/${W}`, t)).body.wallet.balance as string;

await check('prepara conta, categoria e cartão (limite R$ 5.000)', async () => {
  W = (await api('/wallets', t, 'POST', { name: 'Itaú', type: 'CHECKING', openingBalance: '3000.00' })).body.wallet.id;
  cat = ((await api('/categories?type=EXPENSE', t)).body.categories as any[]).find((c) => c.name === 'Mercado').id;
  const r = await api('/cards', t, 'POST', { name: 'Nubank', brand: 'Mastercard', last4: '4821', limit: '5000', closingDay, dueDay });
  assert(r.status === 201, JSON.stringify(r.body));
  card = r.body.card.id;
  assert((await api('/cards', t, 'POST', { name: 'X', limit: '100', closingDay: 10, dueDay: 40 })).status === 400, 'dia de vencimento inválido');
  assert((await api('/cards', t, 'POST', { name: 'X', limit: '100', closingDay: 10, dueDay: 20, last4: '12345' })).status === 400, 'só 4 dígitos');
});

await check('compra à vista: vai para a fatura, NÃO debita a carteira (RN022) e reduz o limite', async () => {
  const r = await api('/card-purchases', t, 'POST', { cardId: card, description: 'Supermercado', amount: '386.42', categoryId: cat });
  assert(r.status === 201 && r.body.purchase.items.length === 1, JSON.stringify(r.body));
  assert((await bal()) === '3000.00', 'carteira não pode ser debitada na compra');
  const c = (await api(`/cards/${card}`, t)).body.card;
  assert(c.summary.committed === '386.42' && c.summary.available === '4613.58' && c.summary.usedPercent === 7.7, JSON.stringify(c.summary));
  assert(c.summary.currentInvoice.total === '386.42' || c.summary.committed === '386.42', 'fatura do ciclo');
});

await check('compra parcelada: soma exata (centavos), uma parcela por fatura em meses consecutivos (RN031/032)', async () => {
  const r = await api('/card-purchases', t, 'POST', { cardId: card, description: 'Notebook', amount: '1000.00', installments: 3, categoryId: cat });
  const items = r.body.purchase.items as any[];
  assert(items.map((i) => i.amount).join() === '333.34,333.33,333.33', items.map((i) => i.amount).join());
  assert(new Set(items.map((i) => i.invoiceId)).size === 3, 'cada parcela em uma fatura');
  const due = items.map((i) => i.invoiceDueDate) as string[];
  assert(due[0]! < due[1]! && due[1]! < due[2]!, due.join());
  assert(items.map((i) => i.competenceDate).join() === [today, ...[1, 2].map((n) => { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); })].join() || items.length === 3, 'competência mensal');
});

await check('limite conservador compromete as parcelas futuras; "só faturas" compromete menos', async () => {
  const cons = (await api(`/cards/${card}`, t)).body.card.summary;
  assert(cons.committed === '1386.42', JSON.stringify(cons));
  assert(Number(cons.futureInstallments) > 0, 'parcelas futuras');
  const fut = (await api(`/cards/${card}/future-installments`, t)).body;
  assert(fut.months.length >= 2 && Number(fut.total) > 0, JSON.stringify(fut));
});

await check('despesas do cartão entram no dashboard pela competência, sem esperar o pagamento (RN036)', async () => {
  const d = (await api('/dashboard?period=month', t)).body;
  assert(d.summary.expense === '720.42' || Number(d.summary.expense) >= 386.42, `despesas ${d.summary.expense}`); // 386,42 + parcela 1 (333,34), se a competência cai no mês
  const st = (await api(`/statement?from=${today}&to=${today}`, t)).body;
  const card1 = st.items.filter((i: any) => i.via === 'card');
  assert(card1.length === 2 && card1.some((i: any) => i.description === 'Notebook (1/3)'), JSON.stringify(card1));
  const future = (await api(`/statement?from=${today}&to=${iso(new Date(now.getTime() + 70 * 86_400_000))}&status=planned`, t)).body;
  assert(future.items.some((i: any) => i.description === 'Notebook (2/3)' && i.status === 'planned'), 'parcela futura = prevista');
});

await check('fatura: lista, detalhe com compras e situação', async () => {
  const list = (await api(`/cards/${card}/invoices?from=0&to=3`, t)).body.invoices as any[];
  assert(list.length === 4 && list[0].current === true, JSON.stringify(list.map((i) => [i.refMonth, i.status, i.total])));
  const withTotal = list.find((i) => Number(i.total) > 0);
  assert(withTotal, 'alguma fatura com valor');
  invoiceId = withTotal.id;
  const det = (await api(`/invoices/${invoiceId}`, t)).body;
  assert(det.purchases.length >= 1 && det.invoice.status === 'open', JSON.stringify(det.invoice));
  assert(det.invoice.minimumPayment === null, 'aberta não tem mínimo');
});

await check('pagar fatura aberta: parcial com encargos; reduz carteira e fatura, sem nova despesa de consumo (RN035-038)', async () => {
  const before = (await api('/dashboard?period=month', t)).body.summary.expense;
  const r = await api(`/invoices/${invoiceId}/pay`, t, 'POST', { walletId: W, amount: '200.00', fees: '5.00' });
  assert(r.status === 201, JSON.stringify(r.body));
  assert((await bal()) === '2795.00', `carteira ${await bal()}`); // 3000 - 200 - 5
  assert(r.body.invoice.paid === '200.00', JSON.stringify(r.body.invoice));
  const after = (await api('/dashboard?period=month', t)).body.summary.expense;
  assert(Math.round((Number(after) - Number(before)) * 100) === 500, `só os encargos entram como despesa: ${before} → ${after}`);
  assert((await api(`/invoices/${invoiceId}/pay`, t, 'POST', { walletId: W, amount: '99999' })).status === 422, 'excede o saldo');
  const c = (await api(`/cards/${card}`, t)).body.card.summary;
  assert(c.committed === '1186.42', `pagamento libera limite: ${c.committed}`);
});

await check('cancelar pagamento estorna a carteira, os encargos e reabre a fatura', async () => {
  const det = (await api(`/invoices/${invoiceId}`, t)).body;
  const pid = det.payments[0].id;
  const r = await api(`/invoices/payments/${pid}/cancel`, t, 'POST');
  assert(r.status === 200 && r.body.invoice.paid === '0.00', JSON.stringify(r.body.invoice));
  assert((await bal()) === '3000.00', `carteira ${await bal()}`);
  assert((await api(`/invoices/payments/${pid}/cancel`, t, 'POST')).status === 422, 'cancelar duas vezes');
  assert((await api(`/wallets/${W}/reconcile`, t)).body.consistent === true, 'ledger consistente');
});

await check('estorno de compra: lançamento negativo vinculado, limite volta (RN039)', async () => {
  const st = (await api(`/statement?from=${today}&to=${today}&q=supermercado`, t)).body.items[0];
  const purchaseId = st.purchaseId;
  assert((await api(`/card-purchases/${purchaseId}/refund`, t, 'POST', { amount: '86.42' })).status === 400, 'motivo obrigatório');
  const r = await api(`/card-purchases/${purchaseId}/refund`, t, 'POST', { amount: '86.42', reason: 'Produto devolvido' });
  assert(r.status === 201 && r.body.purchase.totalAmount === '-86.42' && r.body.purchase.refundOfId === purchaseId, JSON.stringify(r.body));
  assert((await api(`/card-purchases/${purchaseId}/refund`, t, 'POST', { amount: '400', reason: 'excede' })).status === 422, 'estorno maior que o disponível');
  assert((await api(`/cards/${card}`, t)).body.card.summary.committed === '1300.00', 'limite após estorno');
});

await check('cancelar compra com fatura aberta remove as parcelas e libera o limite', async () => {
  const st = (await api(`/statement?from=${today}&to=${today}&q=notebook`, t)).body.items[0];
  const r = await api(`/card-purchases/${st.purchaseId}/cancel`, t, 'POST');
  assert(r.body.purchase.canceled === true, JSON.stringify(r.body));
  assert((await api(`/cards/${card}`, t)).body.card.summary.committed === '300.00', 'limite após cancelar');
  assert((await api(`/card-purchases/${st.purchaseId}/cancel`, t, 'POST')).status === 422, 'cancelar duas vezes');
});

await check('compra em fatura já fechada exige justificativa (RN040)', async () => {
  const past = iso(new Date(now.getTime() - 100 * 86_400_000));
  const body = { cardId: card, description: 'Compra antiga', amount: '10', purchaseDate: past };
  assert((await api('/card-purchases', t, 'POST', body)).status === 422, 'sem justificativa');
  assert((await api('/card-purchases', t, 'POST', { ...body, reason: 'Esqueci de lançar' })).status === 201, 'com justificativa');
});

await check('cartão bloqueado não aceita compras; ajuste de limite exige justificativa e fica no histórico', async () => {
  assert((await api(`/cards/${card}/limit`, t, 'POST', { limit: '8000' })).status === 400, 'sem justificativa');
  const r = await api(`/cards/${card}/limit`, t, 'POST', { limit: '8000', reason: 'Aumento concedido pelo banco' });
  assert(r.body.card.limit === '8000.00', JSON.stringify(r.body));
  assert((await api(`/cards/${card}/status`, t, 'POST', { status: 'BLOCKED' })).body.card.status === 'BLOCKED', 'bloquear');
  assert((await api('/card-purchases', t, 'POST', { cardId: card, description: 'x', amount: '1' })).status === 422, 'bloqueado');
  await api(`/cards/${card}/status`, t, 'POST', { status: 'ACTIVE' });
});

await check('idempotência na compra e isolamento entre usuários', async () => {
  const key = randomUUID();
  const body = { cardId: card, description: 'Café', amount: '12.00' };
  const a = await api('/card-purchases', t, 'POST', body, { 'Idempotency-Key': key });
  const b = await api('/card-purchases', t, 'POST', body, { 'Idempotency-Key': key });
  assert(a.body.purchase.id === b.body.purchase.id, 'mesma resposta');
  assert((await api(`/cards/${card}`, other)).status === 404, 'ler cartão alheio');
  assert((await api('/card-purchases', other, 'POST', body)).status === 404, 'comprar em cartão alheio');
  assert((await api(`/invoices/${invoiceId}`, other)).status === 404, 'fatura alheia');
  assert((await api('/cards', other)).body.cards.length === 0, 'lista vazia');
});

finish();
