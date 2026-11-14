import { randomUUID } from 'node:crypto';
import { CORE, assert, check, finish, http } from './lib.js';

console.log('E3 — Núcleo financeiro');

const api = (path: string, token: string, method = 'GET', body?: unknown, headers?: Record<string, string>) =>
  http(CORE, `/api/v1${path}`, { method, token, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

const reg = async (n: string) => (await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: `Fin ${n}`, email: `fin${n}+${Date.now()}@prumo.test`, password: 'senha-segura-123' }) })).body.accessToken as string;

const t = await reg('A');
const other = await reg('B');
const today = new Date().toISOString().slice(0, 10);
const bal = async (id: string) => (await api(`/wallets/${id}`, t)).body.wallet.balance as string;

let A = '', B = '', catExp = '', catInc = '';

await check('categorias padrão são criadas e há hierarquia', async () => {
  const r = await api('/categories', t);
  assert(r.status === 200 && r.body.categories.length > 15, `categorias: ${r.body.categories?.length}`);
  const moradia = r.body.categories.find((c: any) => c.name === 'Moradia' && !c.parentId);
  assert(moradia && r.body.categories.some((c: any) => c.parentId === moradia.id), 'sem subcategorias de Moradia');
  catExp = r.body.categories.find((c: any) => c.type === 'EXPENSE' && c.name === 'Mercado').id;
  catInc = r.body.categories.find((c: any) => c.type === 'INCOME' && c.name === 'Salário').id;
});

await check('categoria: criar, duplicada (409), regra de tipo do pai (422) e arquivar', async () => {
  const cats = (await api('/categories?type=EXPENSE', t)).body.categories;
  const pai = cats.find((c: any) => c.name === 'Lazer');
  const ok = await api('/categories', t, 'POST', { name: 'Cinema', type: 'EXPENSE', parentId: pai.id });
  assert(ok.status === 201, JSON.stringify(ok.body));
  assert((await api('/categories', t, 'POST', { name: 'cinema', type: 'EXPENSE', parentId: pai.id })).status === 409, 'duplicada');
  assert((await api('/categories', t, 'POST', { name: 'X', type: 'INCOME', parentId: pai.id })).status === 422, 'tipo diferente do pai');
  assert((await api(`/categories/${ok.body.category.id}`, t, 'DELETE')).status === 204, 'arquivar');
  assert(!(await api('/categories?type=EXPENSE', t)).body.categories.some((c: any) => c.id === ok.body.category.id), 'arquivada não deve listar');
});

await check('carteira com saldo inicial: abertura no ledger, não é receita', async () => {
  const r = await api('/wallets', t, 'POST', { name: 'Itaú', type: 'CHECKING', institution: 'Itaú', openingBalance: '1000.00' });
  assert(r.status === 201 && r.body.wallet.balance === '1000.00', JSON.stringify(r.body));
  A = r.body.wallet.id;
  const led = await api(`/wallets/${A}/ledger`, t);
  assert(led.body.entries.length === 1 && led.body.entries[0].kind === 'OPENING', JSON.stringify(led.body));
  const st = await api(`/statement?from=${today}&to=${today}`, t);
  assert(st.body.summary.income === '0.00', 'saldo inicial não pode virar receita');
  B = (await api('/wallets', t, 'POST', { name: 'Nubank', type: 'DIGITAL_BANK', openingBalance: '0' })).body.wallet.id;
});

await check('despesa efetivada baixa o saldo; despesa prevista não altera (RN005/006)', async () => {
  const done = await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'Supermercado', amount: '100.50', categoryId: catExp, walletId: A, settled: true });
  assert(done.status === 201 && done.body.transaction.status === 'settled', JSON.stringify(done.body));
  assert((await bal(A)) === '899.50', `saldo ${await bal(A)}`);
  const planned = await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'Energia', amount: '200', dueDate: today });
  assert(planned.body.transaction.status === 'planned', 'deveria ser previsto');
  assert((await bal(A)) === '899.50', 'previsto não pode alterar o saldo');
});

await check('pagamento parcial mantém o restante em aberto e o excesso é recusado (RN026)', async () => {
  const p = await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'Internet', amount: '120', dueDate: today });
  const id = p.body.transaction.id;
  const half = await api(`/transactions/${id}/settle`, t, 'POST', { walletId: A, amount: '50' });
  assert(half.body.transaction.status === 'partial' && half.body.transaction.remaining === '70.00', JSON.stringify(half.body));
  assert((await bal(A)) === '849.50', `saldo ${await bal(A)}`);
  assert((await api(`/transactions/${id}/settle`, t, 'POST', { walletId: A, amount: '80' })).status === 422, 'excesso');
  const rest = await api(`/transactions/${id}/settle`, t, 'POST', { walletId: A });
  assert(rest.body.transaction.status === 'settled' && rest.body.transaction.paidAmount === '120.00', JSON.stringify(rest.body));
  assert((await bal(A)) === '779.50', `saldo ${await bal(A)}`);
  assert((await api(`/transactions/${id}/settle`, t, 'POST', { walletId: A })).status === 422, 'já efetivado');
});

await check('receita efetivada entra no saldo', async () => {
  const r = await api('/transactions', t, 'POST', { type: 'INCOME', description: 'Salário', amount: '7000', categoryId: catInc, walletId: A, settled: true });
  assert(r.status === 201 && (await bal(A)) === '7779.50', `saldo ${await bal(A)}`);
});

await check('regras de categoria: tipo errado é recusado', async () => {
  const r = await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'x', amount: '5', categoryId: catInc });
  assert(r.status === 422, `status ${r.status}`);
});

let transferId = '';
await check('transferência: duas pernas, patrimônio total inalterado, taxa à parte (RN014-017)', async () => {
  const before = (await api('/wallets', t)).body.summary.totalBalance;
  const r = await api('/transfers', t, 'POST', { fromWalletId: A, toWalletId: B, amount: '300', fee: '2.50' });
  assert(r.status === 201, JSON.stringify(r.body));
  transferId = r.body.transfer.id;
  assert((await bal(B)) === '300.00', `destino ${await bal(B)}`);
  assert((await bal(A)) === '7477.00', `origem ${await bal(A)}`); // 7779.50 - 300 - 2.50
  const after = (await api('/wallets', t)).body.summary.totalBalance;
  assert(Math.round((Number(before) - Number(after)) * 100) === 250, `patrimônio deveria cair só a taxa: ${before} → ${after}`);
  assert((await api('/transfers', t, 'POST', { fromWalletId: A, toWalletId: A, amount: '1' })).status === 400, 'mesma carteira');
});

await check('extrato unificado: transferência aparece uma vez e fica fora do resultado (RN015/073)', async () => {
  const st = await api(`/statement?from=${today}&to=${today}`, t);
  assert(st.status === 200, JSON.stringify(st.body));
  assert(st.body.items.filter((i: any) => i.kind === 'transfer').length === 1, 'transferência deve aparecer uma vez');
  assert(st.body.summary.income === '7000.00', `receitas ${st.body.summary.income}`);
  assert(st.body.summary.expense === '223.00', `despesas ${st.body.summary.expense}`); // 100,50 + 120 + taxa 2,50
});

await check('filtros do extrato: tipo, busca e status', async () => {
  const rec = await api(`/statement?from=${today}&to=${today}&type=receita`, t);
  assert(rec.body.items.every((i: any) => i.kind === 'income') && rec.body.items.length === 1, 'só receitas');
  const q = await api(`/statement?from=${today}&to=${today}&q=super`, t);
  assert(q.body.items.length === 1 && q.body.items[0].description === 'Supermercado', JSON.stringify(q.body.items));
  const planned = await api(`/statement?from=${today}&to=${today}&status=planned`, t);
  assert(planned.body.items.some((i: any) => i.description === 'Energia') && planned.body.summary.plannedExpense === '200.00', JSON.stringify(planned.body.summary));
  const tr = await api(`/statement?from=${today}&to=${today}&type=transferencia`, t);
  assert(tr.body.items.length === 1 && tr.body.items[0].description === 'Itaú → Nubank', JSON.stringify(tr.body.items));
});

await check('cancelar efetivado estorna sem apagar o histórico (RN008)', async () => {
  const st = await api(`/statement?from=${today}&to=${today}&q=super`, t);
  const id = st.body.items[0].id;
  const c = await api(`/transactions/${id}/cancel`, t, 'POST');
  assert(c.body.transaction.status === 'canceled', JSON.stringify(c.body));
  assert((await bal(A)) === '7577.50', `saldo ${await bal(A)}`); // +100.50
  const led = (await api(`/wallets/${A}/ledger`, t)).body.entries;
  assert(led.some((e: any) => e.kind === 'REVERSAL' && e.reversesEntryId), 'deveria haver um estorno no ledger');
  assert((await api(`/transactions/${id}/cancel`, t, 'POST')).status === 422, 'cancelar duas vezes');
  assert(!(await api(`/statement?from=${today}&to=${today}&q=super`, t)).body.items.length, 'cancelado sai do extrato');
});

await check('editar um lançamento efetivado refaz o ledger (estorno + novo)', async () => {
  const mk = await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'Farmácia', amount: '64.30', walletId: A, settled: true });
  const id = mk.body.transaction.id;
  const before = await bal(A);
  const up = await api(`/transactions/${id}`, t, 'PATCH', { amount: '70.00', description: 'Farmácia (corrigido)' });
  assert(up.body.transaction.plannedAmount === '70.00' && up.body.transaction.paidAmount === '70.00', JSON.stringify(up.body));
  assert(Math.round((Number(before) - Number(await bal(A))) * 100) === 570, `saldo ${before} → ${await bal(A)}`);
});

await check('cancelar transferência estorna as duas pernas e a taxa', async () => {
  const sumBefore = Number((await api('/wallets', t)).body.summary.totalBalance);
  assert((await api(`/transfers/${transferId}/cancel`, t, 'POST')).status === 200, 'cancelar');
  assert((await bal(B)) === '0.00', `destino ${await bal(B)}`);
  const sumAfter = Number((await api('/wallets', t)).body.summary.totalBalance);
  assert(Math.round((sumAfter - sumBefore) * 100) === 250, `taxa deveria voltar: ${sumBefore} → ${sumAfter}`);
  assert((await api(`/transfers/${transferId}/cancel`, t, 'POST')).status === 422, 'cancelar duas vezes');
});

await check('ajuste manual exige justificativa e vira lançamento de ajuste (RN018)', async () => {
  assert((await api(`/wallets/${A}/adjust`, t, 'POST', { newBalance: '5000' })).status === 400, 'sem justificativa');
  const r = await api(`/wallets/${A}/adjust`, t, 'POST', { newBalance: '5000', reason: 'Conferência com o extrato do banco' });
  assert(r.status === 201 && r.body.wallet.balance === '5000.00', JSON.stringify(r.body));
  const led = (await api(`/wallets/${A}/ledger`, t)).body.entries;
  assert(led.some((e: any) => e.kind === 'ADJUSTMENT' && e.description.includes('Conferência')), 'ajuste no ledger');
  assert((await api(`/wallets/${A}/adjust`, t, 'POST', { newBalance: '5000', reason: 'repetido' })).status === 409, 'sem diferença');
});

await check('reconciliação: cache = soma do ledger e a evolução termina no saldo atual', async () => {
  const r = await api(`/wallets/${A}/reconcile`, t);
  assert(r.body.consistent === true && r.body.ledgerBalance === '5000.00', JSON.stringify(r.body));
  const h = await api(`/wallets/${A}/balance-history?days=7`, t);
  assert(h.body.history.length === 7 && h.body.history.at(-1).balance === '5000.00', JSON.stringify(h.body.history.at(-1)));
});

await check('carteira arquivada mantém histórico e recusa lançamentos (RN019)', async () => {
  assert((await api(`/wallets/${B}/archive`, t, 'POST')).body.wallet.archived === true, 'arquivar');
  assert((await api('/wallets', t)).body.wallets.every((w: any) => w.id !== B), 'some da lista ativa');
  assert((await api('/wallets?status=archived', t)).body.wallets.length === 1, 'lista arquivadas');
  const r = await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'x', amount: '1', walletId: B, settled: true });
  assert(r.status === 422, `status ${r.status}`);
  assert((await api(`/wallets/${B}/unarchive`, t, 'POST')).body.wallet.archived === false, 'reativar');
});

await check('Idempotency-Key: repetir não duplica; conteúdo diferente com a mesma chave é recusado (RN011)', async () => {
  const key = randomUUID();
  const body = { type: 'EXPENSE', description: 'Café', amount: '10', walletId: A, settled: true };
  const before = Number(await bal(A));
  const one = await api('/transactions', t, 'POST', body, { 'Idempotency-Key': key });
  const two = await api('/transactions', t, 'POST', body, { 'Idempotency-Key': key });
  assert(one.status === 201 && two.status === 201 && one.body.transaction.id === two.body.transaction.id, 'mesma resposta');
  assert(Number(await bal(A)) === before - 10, 'cobrou duas vezes');
  assert((await api('/transactions', t, 'POST', { ...body, amount: '11' }, { 'Idempotency-Key': key })).status === 422, 'mesma chave, outro conteúdo');
});

await check('isolamento: outro usuário não vê nem usa carteiras e lançamentos alheios (RN001/009)', async () => {
  assert((await api(`/wallets/${A}`, other)).status === 404, 'ler carteira alheia');
  assert((await api(`/wallets/${A}/ledger`, other)).status === 404, 'ledger alheio');
  assert((await api('/transactions', other, 'POST', { type: 'EXPENSE', description: 'x', amount: '1', walletId: A, settled: true })).status === 404, 'lançar em carteira alheia');
  const st = await api(`/statement?from=${today}&to=${today}`, t);
  const id = st.body.items.find((i: any) => i.kind === 'expense').id;
  assert((await api(`/transactions/${id}`, other)).status === 404, 'ler lançamento alheio');
  assert((await api(`/transactions/${id}/cancel`, other, 'POST')).status === 404, 'cancelar lançamento alheio');
  assert((await api('/wallets', other)).body.wallets.length === 0, 'lista deveria vir vazia');
});

await check('validação: valor zero, data inválida e sem token', async () => {
  assert((await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'x', amount: '0' })).status === 400, 'valor zero');
  assert((await api('/transactions', t, 'POST', { type: 'EXPENSE', description: 'x', amount: '1', competenceDate: '2026-02-30' })).status === 400, 'data inválida');
  assert((await http(CORE, '/api/v1/wallets')).status === 401, 'sem token');
});

await check('importar CSV: prévia, importação e reimportação sem duplicar; depois OFX', async () => {
  const csv = 'Data;Descrição;Valor\n10/11/2026;PIX CLIENTE;650,00\n11/11/2026;COMPRA MERCADO;-142,30\n';
  const prev = await api(`/wallets/${A}/import`, t, 'POST', { format: 'csv', content: csv, commit: false });
  assert(prev.body.parsed === 2 && prev.body.toImport === 2 && prev.body.imported === 0, JSON.stringify(prev.body));
  const before = Number(await bal(A));
  const go = await api(`/wallets/${A}/import`, t, 'POST', { format: 'csv', content: csv, commit: true });
  assert(go.body.imported === 2, JSON.stringify(go.body));
  assert(Math.round((Number(await bal(A)) - before) * 100) === 50770, `saldo ${before} → ${await bal(A)}`); // +650 - 142.30
  const again = await api(`/wallets/${A}/import`, t, 'POST', { format: 'csv', content: csv, commit: true });
  assert(again.body.imported === 0 && again.body.duplicates === 2, JSON.stringify(again.body));
  const ofx = '<OFX><STMTTRN><DTPOSTED>20261112<TRNAMT>-19.90<FITID>Z9<MEMO>TARIFA</STMTTRN></OFX>';
  assert((await api(`/wallets/${A}/import`, t, 'POST', { format: 'ofx', content: ofx, commit: true })).body.imported === 1, 'ofx');
  assert((await api(`/wallets/${A}/import`, t, 'POST', { format: 'csv', content: 'lixo', commit: true })).status === 400, 'arquivo inválido');
  assert((await api(`/wallets/${A}/reconcile`, t)).body.consistent === true, 'ledger deve continuar consistente após importar');
});

finish();
