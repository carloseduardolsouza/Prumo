import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { authOf, requireAuth } from '../../../shared/middleware/auth.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { validate } from '../../../shared/middleware/validate.js';
import { consortiumAdjustSchema, consortiumCreateSchema, consortiumEventSchema, consortiumPatchSchema, consortiumPaySchema, extraSchema, financingCreateSchema, numberParam, officialBalanceSchema, payInstallmentSchema, payoffSchema } from '../models/debt.schemas.js';
import { idParam } from '../models/finance.schemas.js';
import { calendarSources } from '../services/calendar.service.js';
import { ConsortiumService } from '../services/consortium.service.js';
import { debtCalendarSource, debtSummary } from '../services/debt-cash.js';
import { FinancingService } from '../services/financing.service.js';

calendarSources.push(debtCalendarSource); // parcelas e assembleias aparecem no calendário

type Req = Parameters<Parameters<typeof h>[0]>[0];
const uid = (req: Req) => authOf(req).userId;
const pid = (req: Req) => String(req.params['id']);
const num = (req: Req) => Number(req.params['number']);

export const financings = Router().use(requireAuth);
financings.get('/', h(async (req, res) => { res.json(await FinancingService.list(uid(req))); }));
financings.post('/', idempotent, validate({ body: financingCreateSchema }), h(async (req, res) => { res.status(201).json(await FinancingService.create(uid(req), req.body)); }));
financings.get('/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await FinancingService.get(uid(req), pid(req))); }));
financings.post('/:id/installments/:number/pay', idempotent, validate({ params: numberParam, body: payInstallmentSchema }), h(async (req, res) => { res.json(await FinancingService.payInstallment(uid(req), pid(req), num(req), req.body)); }));
financings.post('/:id/installments/:number/cancel-payment', validate({ params: numberParam }), h(async (req, res) => { res.json(await FinancingService.cancelPayment(uid(req), pid(req), num(req))); }));
financings.post('/:id/extra-amortization', validate({ params: idParam, body: extraSchema }), h(async (req, res) => { res.json(await FinancingService.extra(uid(req), pid(req), req.body)); }));
financings.post('/:id/payoff', idempotent, validate({ params: idParam, body: payoffSchema }), h(async (req, res) => { res.json(await FinancingService.payoff(uid(req), pid(req), req.body)); }));
financings.put('/:id/official-balance', validate({ params: idParam, body: officialBalanceSchema }), h(async (req, res) => { res.json(await FinancingService.setOfficialBalance(uid(req), pid(req), req.body.amount, req.body.date)); }));

export const consortiums = Router().use(requireAuth);
consortiums.get('/', h(async (req, res) => { res.json(await ConsortiumService.list(uid(req))); }));
consortiums.post('/', idempotent, validate({ body: consortiumCreateSchema }), h(async (req, res) => { res.status(201).json(await ConsortiumService.create(uid(req), req.body)); }));
consortiums.get('/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await ConsortiumService.get(uid(req), pid(req))); }));
consortiums.patch('/:id', validate({ params: idParam, body: consortiumPatchSchema }), h(async (req, res) => { res.json(await ConsortiumService.patch(uid(req), pid(req), req.body)); }));
consortiums.post('/:id/pay', idempotent, validate({ params: idParam, body: consortiumPaySchema }), h(async (req, res) => { res.json(await ConsortiumService.pay(uid(req), pid(req), req.body)); }));
consortiums.post('/:id/installments/:number/cancel-payment', validate({ params: numberParam }), h(async (req, res) => { res.json(await ConsortiumService.cancelPayment(uid(req), pid(req), num(req))); }));
consortiums.post('/:id/adjustments', validate({ params: idParam, body: consortiumAdjustSchema }), h(async (req, res) => { res.status(201).json(await ConsortiumService.adjust(uid(req), pid(req), req.body)); }));
consortiums.post('/:id/events', validate({ params: idParam, body: consortiumEventSchema }), h(async (req, res) => { res.status(201).json(await ConsortiumService.addEvent(uid(req), pid(req), req.body)); }));

export const debts = Router().use(requireAuth);
debts.get('/summary', h(async (req, res) => { res.json(await debtSummary(uid(req))); }));
void z;
