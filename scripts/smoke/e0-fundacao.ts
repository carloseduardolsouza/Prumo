import { CORE, MESSAGE, assert, check, finish, http } from './lib.js';

console.log('E0 — Fundação');

await check('core /health responde 200 com banco e redis "up"', async () => {
  const r = await http(CORE, '/health');
  assert(r.status === 200, `status ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.service === 'core' && r.body.database === 'up' && r.body.redis === 'up', JSON.stringify(r.body));
});

await check('message /health responde 200 com banco e redis "up"', async () => {
  const r = await http(MESSAGE, '/health');
  assert(r.status === 200, `status ${r.status}: ${JSON.stringify(r.body)}`);
  assert(r.body.service === 'message' && r.body.database === 'up' && r.body.redis === 'up', JSON.stringify(r.body));
});

await check('core GET /api/v1 identifica o serviço', async () => {
  const r = await http(CORE, '/api/v1');
  assert(r.status === 200 && r.body.name === 'prumo-core', JSON.stringify(r.body));
});

await check('message GET /message/v1 identifica o serviço', async () => {
  const r = await http(MESSAGE, '/message/v1');
  assert(r.status === 200 && r.body.name === 'prumo-message', JSON.stringify(r.body));
});

await check('rota inexistente devolve 404 no formato padrão', async () => {
  const r = await http(CORE, '/api/v1/nao-existe');
  assert(r.status === 404 && r.body.code === 'ROUTE_NOT_FOUND', JSON.stringify(r.body));
});

await check('JSON inválido devolve 400 (error handler global)', async () => {
  const r = await http(CORE, '/api/v1', { method: 'POST', body: '{ quebrado', headers: { 'content-type': 'application/json' } });
  assert(r.status === 400 && r.body.code === 'INVALID_JSON', JSON.stringify(r.body));
});

finish();
