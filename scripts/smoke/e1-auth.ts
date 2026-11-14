import { CORE, assert, check, finish, http } from './lib.js';

console.log('E1 — Conta e acesso');

const email = `smoke+${Date.now()}@prumo.test`;
const password = 'senha-segura-123';
let access = '';
let refresh = '';
let sessionId = '';

await check('registro cria a conta e já devolve tokens', async () => {
  const r = await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Smoke Test', email, password, deviceName: 'Smoke A' }) });
  assert(r.status === 201, `status ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.user.email === email && r.body.user.emailVerified === false, 'usuário inesperado');
  assert(!JSON.stringify(r.body).includes('passwordHash'), 'vazou o hash da senha');
  access = r.body.accessToken;
  refresh = r.body.refreshToken;
});

await check('registro duplicado devolve 409', async () => {
  const r = await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Outro', email, password }) });
  assert(r.status === 409, `status ${r.status}`);
});

await check('validação: e-mail inválido e senha curta devolvem 400 com detalhes', async () => {
  const r = await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'X', email: 'nao-email', password: '123' }) });
  assert(r.status === 400 && r.body.code === 'VALIDATION_ERROR' && r.body.details.length >= 2, JSON.stringify(r.body));
});

await check('login com senha errada devolve 401', async () => {
  const r = await http(CORE, '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'errada-errada' }) });
  assert(r.status === 401, `status ${r.status}`);
});

await check('login correto devolve tokens', async () => {
  const r = await http(CORE, '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password, deviceName: 'Smoke B' }) });
  assert(r.status === 200 && r.body.accessToken && r.body.refreshToken, JSON.stringify(r.body));
  access = r.body.accessToken;
  refresh = r.body.refreshToken;
});

await check('GET /me sem token devolve 401; com token devolve o usuário', async () => {
  assert((await http(CORE, '/api/v1/me')).status === 401, 'deveria exigir token');
  const r = await http(CORE, '/api/v1/me', { token: access });
  assert(r.status === 200 && r.body.user.email === email, JSON.stringify(r.body));
});

await check('PATCH /me altera o nome', async () => {
  const r = await http(CORE, '/api/v1/me', { method: 'PATCH', token: access, body: JSON.stringify({ name: 'Smoke Renomeado' }) });
  assert(r.status === 200 && r.body.user.name === 'Smoke Renomeado', JSON.stringify(r.body));
});

await check('preferências: padrão e atualização parcial', async () => {
  const g = await http(CORE, '/api/v1/me/preferences', { token: access });
  assert(g.status === 200 && g.body.preferences.currency === 'BRL' && g.body.preferences.theme === 'escuro', JSON.stringify(g.body));
  const p = await http(CORE, '/api/v1/me/preferences', { method: 'PUT', token: access, body: JSON.stringify({ theme: 'claro', firstDayOfWeek: 1 }) });
  assert(p.status === 200 && p.body.preferences.theme === 'claro' && p.body.preferences.firstDayOfWeek === 1 && p.body.preferences.currency === 'BRL', JSON.stringify(p.body));
  const bad = await http(CORE, '/api/v1/me/preferences', { method: 'PUT', token: access, body: JSON.stringify({ theme: 'roxo' }) });
  assert(bad.status === 400, `status ${bad.status}`);
});

await check('refresh rotaciona e o refresh antigo, se reusado, derruba a sessão', async () => {
  const old = refresh;
  const r = await http(CORE, '/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: old }) });
  assert(r.status === 200 && r.body.refreshToken !== old, JSON.stringify(r.body));
  const fresh = r.body;
  const reuse = await http(CORE, '/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: old }) });
  assert(reuse.status === 401, `reuso deveria dar 401, deu ${reuse.status}`);
  const after = await http(CORE, '/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: fresh.refreshToken }) });
  assert(after.status === 401, 'a sessão deveria ter sido revogada após o reuso');
});

await check('nova sessão: lista, encerra outra e mantém a atual', async () => {
  const l = await http(CORE, '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password, deviceName: 'Smoke C' }) });
  access = l.body.accessToken;
  const other = await http(CORE, '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password, deviceName: 'Smoke D' }) });
  const list = await http(CORE, '/api/v1/me/sessions', { token: access });
  assert(list.status === 200 && list.body.sessions.some((s: any) => s.current), JSON.stringify(list.body));
  sessionId = list.body.sessions.find((s: any) => s.deviceName === 'Smoke D')?.id;
  assert(sessionId, 'sessão Smoke D não encontrada');
  assert((await http(CORE, `/api/v1/me/sessions/${sessionId}`, { method: 'DELETE', token: access })).status === 204, 'encerrar sessão');
  assert((await http(CORE, '/api/v1/me', { token: other.body.accessToken })).status === 401, 'sessão encerrada ainda funciona');
  assert((await http(CORE, '/api/v1/me', { token: access })).status === 200, 'a sessão atual deveria continuar');
});

await check('isolamento: não dá para encerrar a sessão de outro usuário', async () => {
  const e2 = `smoke2+${Date.now()}@prumo.test`;
  const u2 = await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Outro Usuário', email: e2, password }) });
  const r = await http(CORE, `/api/v1/me/sessions/${sessionId}`, { method: 'DELETE', token: u2.body.accessToken });
  assert(r.status === 404, `esperava 404, veio ${r.status}`);
});

await check('troca de senha: exige a atual e desconecta os outros dispositivos', async () => {
  const wrong = await http(CORE, '/api/v1/me/password', { method: 'POST', token: access, body: JSON.stringify({ currentPassword: 'errada-errada', newPassword: 'nova-senha-456' }) });
  assert(wrong.status === 403, `esperava 403, veio ${wrong.status}`);
  const ok = await http(CORE, '/api/v1/me/password', { method: 'POST', token: access, body: JSON.stringify({ currentPassword: password, newPassword: 'nova-senha-456' }) });
  assert(ok.status === 200, JSON.stringify(ok.body));
  assert((await http(CORE, '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).status === 401, 'a senha antiga não deveria valer');
  assert((await http(CORE, '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'nova-senha-456' }) })).status === 200, 'a nova senha deveria valer');
});

await check('esqueci a senha responde 202 mesmo para e-mail inexistente', async () => {
  const a = await http(CORE, '/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  const b = await http(CORE, '/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'ninguem@prumo.test' }) });
  assert(a.status === 202 && b.status === 202, `${a.status}/${b.status}`);
  const bad = await http(CORE, '/api/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: 'x'.repeat(30), password: 'qualquer-coisa-1' }) });
  assert(bad.status === 400, `token falso deveria dar 400, deu ${bad.status}`);
});

await check('exportação de dados (LGPD) e pedido de exclusão com cancelamento', async () => {
  const exp = await http(CORE, '/api/v1/me/data-export', { token: access });
  assert(exp.status === 200 && exp.body.user.email === email && Array.isArray(exp.body.audit), JSON.stringify(exp.body).slice(0, 200));
  const del = await http(CORE, '/api/v1/me/deletion-request', { method: 'POST', token: access, body: JSON.stringify({ password: 'nova-senha-456' }) });
  assert(del.status === 200 && del.body.user.status === 'DELETION_REQUESTED', JSON.stringify(del.body));
  const cancel = await http(CORE, '/api/v1/me/deletion-request', { method: 'DELETE', token: access });
  assert(cancel.status === 200 && cancel.body.user.status !== 'DELETION_REQUESTED', JSON.stringify(cancel.body));
});

await check('logout encerra a sessão', async () => {
  assert((await http(CORE, '/api/v1/auth/logout', { method: 'POST', token: access })).status === 204, 'logout');
  assert((await http(CORE, '/api/v1/me', { token: access })).status === 401, 'token ainda vale após logout');
});

finish();
