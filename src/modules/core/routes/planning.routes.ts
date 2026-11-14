import { Router } from 'express';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { authOf, requireAuth } from '../../../shared/middleware/auth.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { requireInternalKey } from '../../../shared/middleware/internal-key.js';
import { validate } from '../../../shared/middleware/validate.js';
import { idParam } from '../models/finance.schemas.js';
import { calendarQuery, projectionBody, projectionQuery, ruleCreateSchema, ruleUpdateSchema, splitCreateSchema, splitPaySchema } from '../models/recurring.schemas.js';
import { runReminders } from '../jobs/reminders.job.js';
import { CalendarService } from '../services/calendar.service.js';
import { RecurringService } from '../services/recurring.service.js';
import { SplitService } from '../services/split.service.js';
import { z } from 'zod';

type Req = Parameters<Parameters<typeof h>[0]>[0];
const uid = (req: Req) => authOf(req).userId;
const pid = (req: Req) => String(req.params['id']);
const vq = <T>(req: unknown) => (req as { validatedQuery: T }).validatedQuery;

export const recurring = Router().use(requireAuth);
recurring.get('/', h(async (req, res) => { res.json(await RecurringService.summary(uid(req))); }));
recurring.post('/', idempotent, validate({ body: ruleCreateSchema }), h(async (req, res) => { res.status(201).json({ rule: await RecurringService.create(uid(req), req.body) }); }));
recurring.get('/:id', validate({ params: idParam }), h(async (req, res) => { res.json({ rule: await RecurringService.get(uid(req), pid(req)) }); }));
recurring.patch('/:id', validate({ params: idParam, body: ruleUpdateSchema }), h(async (req, res) => { res.json({ rule: await RecurringService.update(uid(req), pid(req), req.body) }); }));
recurring.post('/:id/stop', validate({ params: idParam }), h(async (req, res) => { res.json(await RecurringService.stop(uid(req), pid(req))); }));

export const splits = Router().use(requireAuth);
splits.get('/', h(async (req, res) => { res.json(await SplitService.list(uid(req))); }));
splits.post('/', idempotent, validate({ body: splitCreateSchema }), h(async (req, res) => { res.status(201).json({ split: await SplitService.create(uid(req), req.body) }); }));
splits.post('/:id/participants/:pid/pay', validate({ params: z.object({ id: z.string().uuid(), pid: z.string().uuid() }), body: splitPaySchema }), h(async (req, res) => {
  res.json({ split: await SplitService.markPaid(uid(req), pid(req), String(req.params['pid']), req.body) });
}));

export const calendar = Router().use(requireAuth);
calendar.get('/', validate({ query: calendarQuery }), h(async (req, res) => { const q = vq<{ from: string; to: string }>(req); res.json(await CalendarService.events(uid(req), q.from, q.to)); }));

export const cashFlow = Router().use(requireAuth);
cashFlow.get('/projection', validate({ query: projectionQuery }), h(async (req, res) => { res.json(await CalendarService.projection(uid(req), vq(req))); }));
cashFlow.post('/simulate', validate({ body: projectionBody }), h(async (req, res) => { res.json(await CalendarService.projection(uid(req), req.body)); }));

/** Disparo manual dos lembretes (operação/testes), protegido pela chave interna. */
export const internal = Router().use(requireInternalKey);
internal.post('/jobs/reminders', h(async (req, res) => {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId : undefined;
  res.json(await runReminders(userId));
}));
