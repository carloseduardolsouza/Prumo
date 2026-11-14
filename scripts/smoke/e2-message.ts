import { CORE, MESSAGE, assert, check, finish, http } from './lib.js';

console.log('E2 — Serviço de mensagens');

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const KEY = process.env.INTERNAL_API_KEY ?? '';
const email = `msg+${Date.now()}@prumo.test`;
const password = 'senha-segura-123';
let token = '';
let userId = '';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(fn: () => Promise<T | undefined>, ms = 15000): Promise<T | undefined> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v !== undefined) return v;
    await sleep(500);
  }
  return undefined;
}

await check('registro no core dispara o e-mail de verificação (Mailpit)', async () => {
  const r = await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Msg Teste', email, password }) });
  assert(r.status === 201, `registro: ${r.status}`);
  token = r.body.accessToken;
  userId = r.body.user.id;
  const mail = await waitFor(async () => {
    const list = await http(MAILPIT, `/api/v1/search?query=${encodeURIComponent('to:' + email)}`);
    return list.body?.messages?.[0];
  });
  assert(mail, 'o e-mail não chegou no Mailpit (o serviço message está no ar? SMTP_HOST/PORT corretos?)');
  assert(/confirme/i.test(mail.Subject), `assunto inesperado: ${mail.Subject}`);
  const full = await http(MAILPIT, `/api/v1/message/${mail.ID}`);
  const m = /verificar-email\?token=([\w-]+)/.exec(full.body.Text);
  assert(m, 'o e-mail não traz o link de verificação');
  // fecha o ciclo: o token do e-mail realmente verifica a conta
  const v = await http(CORE, '/api/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: m[1] }) });
  assert(v.status === 200 && v.body.user.emailVerified === true, `verificação: ${JSON.stringify(v.body)}`);
});

await check('esqueci a senha envia o e-mail e o código redefine a senha', async () => {
  await http(CORE, '/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  const mail = await waitFor(async () => {
    const list = await http(MAILPIT, `/api/v1/search?query=${encodeURIComponent('to:' + email + ' subject:senha')}`);
    return list.body?.messages?.[0];
  });
  assert(mail, 'o e-mail de redefinição não chegou');
  const full = await http(MAILPIT, `/api/v1/message/${mail.ID}`);
  const m = /redefinir-senha\?token=([\w-]+)/.exec(full.body.Text);
  assert(m, 'sem link de redefinição');
  const r = await http(CORE, '/api/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: m[1], password: 'nova-senha-789' }) });
  assert(r.status === 200, `reset: ${JSON.stringify(r.body)}`);
  const l = await http(CORE, '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'nova-senha-789' }) });
  assert(l.status === 200, 'login com a nova senha');
  token = l.body.accessToken;
});

await check('rotas do message exigem token; a interna exige a chave', async () => {
  assert((await http(MESSAGE, '/message/v1/notifications')).status === 401, 'listagem sem token');
  assert((await http(MESSAGE, '/message/v1/internal/events', { method: 'POST', body: '{}' })).status === 403, 'interna sem chave');
});

await check('evento interno vira notificação in-app, sem duplicar', async () => {
  assert(KEY, 'defina INTERNAL_API_KEY no ambiente (já está no .env; rode via npm run smoke:e2)');
  const body = JSON.stringify({ type: 'invoice.due_soon', userId, payload: { card: 'Nubank', amount: 1842.1, days: 6 }, dedupeKey: `smoke__${userId}__fatura` });
  const send = () => http(MESSAGE, '/message/v1/internal/events', { method: 'POST', body, headers: { 'x-api-key': KEY } });
  assert((await send()).status === 202, 'enfileirar');
  await send(); // repetido: deve ser ignorado
  const list = await waitFor(async () => {
    const r = await http(MESSAGE, '/message/v1/notifications', { token });
    return r.body.notifications?.length ? r.body : undefined;
  });
  assert(list, 'a notificação não apareceu');
  await sleep(1500);
  const again = await http(MESSAGE, '/message/v1/notifications', { token });
  assert(again.body.total === 1, `esperava 1 notificação, há ${again.body.total}`);
  const n = again.body.notifications[0];
  assert(n.category === 'venc' && n.title === 'Fatura Nubank vence em 6 dias' && n.href === '/fatura' && n.read === false, JSON.stringify(n));
});

await check('contador, filtro por categoria e marcar como lida', async () => {
  const u = await http(MESSAGE, '/message/v1/notifications/unread-count', { token });
  assert(u.body.unread === 1, `não lidas: ${JSON.stringify(u.body)}`);
  const orc = await http(MESSAGE, '/message/v1/notifications?category=orc', { token });
  assert(orc.body.total === 0, 'filtro orc deveria vir vazio');
  const venc = await http(MESSAGE, '/message/v1/notifications?category=venc', { token });
  const id = venc.body.notifications[0].id;
  assert((await http(MESSAGE, `/message/v1/notifications/${id}/read`, { method: 'PATCH', token })).status === 204, 'marcar lida');
  assert((await http(MESSAGE, '/message/v1/notifications/unread-count', { token })).body.unread === 0, 'contador deveria zerar');
  assert((await http(MESSAGE, '/message/v1/notifications/00000000-0000-4000-8000-000000000000/read', { method: 'PATCH', token })).status === 404, 'id inexistente');
});

await check('preferência desligada impede a notificação; isolamento entre usuários', async () => {
  const off = await http(MESSAGE, '/message/v1/preferences', { method: 'PUT', token, body: JSON.stringify({ orc: false, leadDays: 5 }) });
  assert(off.status === 200 && off.body.preferences.orc === false && off.body.preferences.leadDays === 5, JSON.stringify(off.body));
  await http(MESSAGE, '/message/v1/internal/events', { method: 'POST', headers: { 'x-api-key': KEY }, body: JSON.stringify({ type: 'budget.threshold', userId, payload: { category: 'Transporte', percent: 110, spent: 660, limit: 600 }, dedupeKey: `smoke__${userId}__orc` }) });
  await sleep(2500);
  assert((await http(MESSAGE, '/message/v1/notifications?category=orc', { token })).body.total === 0, 'categoria desligada não deveria notificar');

  const other = await http(CORE, '/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Outro', email: `msg2+${Date.now()}@prumo.test`, password }) });
  const theirs = await http(MESSAGE, '/message/v1/notifications', { token: other.body.accessToken });
  assert(theirs.body.total === 0, 'outro usuário não pode ver notificações alheias');
});

await check('registrar e remover token de push', async () => {
  const t = 'ExponentPushToken[smoke-token-123456]';
  assert((await http(MESSAGE, '/message/v1/devices', { method: 'POST', token, body: JSON.stringify({ token: t, platform: 'android' }) })).status === 204, 'registrar');
  assert((await http(MESSAGE, `/message/v1/devices/${encodeURIComponent(t)}`, { method: 'DELETE', token })).status === 204, 'remover');
});

finish();
