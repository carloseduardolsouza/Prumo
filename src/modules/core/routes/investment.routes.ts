import { Router } from 'express';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { authOf, requireAuth } from '../../../shared/middleware/auth.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { validate } from '../../../shared/middleware/validate.js';
import { idParam } from '../models/finance.schemas.js';
import { alertSchema, assetSchema, brokerageSchema, operationSchema, opsQuery, profileSchema, quoteSchema, rebalanceQuery, targetsSchema, yearQuery } from '../models/investment.schemas.js';
import { calendarSources } from '../services/calendar.service.js';
import { InvestmentService as S, investmentCalendarSource } from '../services/investment.service.js';

calendarSources.push(investmentCalendarSource); // proventos aparecem no calendário

type Req = Parameters<Parameters<typeof h>[0]>[0];
const uid = (req: Req) => authOf(req).userId;
const pid = (req: Req) => String(req.params['id']);
const q = <T>(req: Req) => (req as unknown as { validatedQuery: T }).validatedQuery;

const r = Router().use(requireAuth);
r.get('/overview', h(async (req, res) => { res.json(await S.overview(uid(req))); }));
r.get('/brokerages', h(async (req, res) => { res.json(await S.brokerages(uid(req))); }));
r.post('/brokerages', validate({ body: brokerageSchema }), h(async (req, res) => { res.status(201).json(await S.createBrokerage(uid(req), req.body)); }));
r.delete('/brokerages/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await S.removeBrokerage(uid(req), pid(req))); }));
r.get('/assets', h(async (req, res) => { res.json(await S.assets(uid(req))); }));
r.post('/assets', validate({ body: assetSchema }), h(async (req, res) => { res.status(201).json(await S.createAsset(uid(req), req.body)); }));
r.get('/assets/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await S.asset(uid(req), pid(req))); }));
r.delete('/assets/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await S.archiveAsset(uid(req), pid(req))); }));
r.put('/assets/:id/quote', validate({ params: idParam, body: quoteSchema }), h(async (req, res) => { res.json(await S.setQuote(uid(req), pid(req), req.body)); }));
r.get('/operations', validate({ query: opsQuery }), h(async (req, res) => { res.json(await S.operations(uid(req), q(req))); }));
r.post('/operations', idempotent, validate({ body: operationSchema }), h(async (req, res) => { res.status(201).json(await S.addOperation(uid(req), req.body)); }));
r.delete('/operations/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await S.removeOperation(uid(req), pid(req))); }));
r.get('/alerts', h(async (req, res) => { res.json(await S.alerts(uid(req))); }));
r.post('/alerts', validate({ body: alertSchema }), h(async (req, res) => { res.status(201).json(await S.addAlert(uid(req), req.body)); }));
r.delete('/alerts/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await S.removeAlert(uid(req), pid(req))); }));
r.get('/rebalance', validate({ query: rebalanceQuery }), h(async (req, res) => { res.json(await S.rebalance(uid(req), q<{ contribution: number }>(req).contribution)); }));
r.put('/targets', validate({ body: targetsSchema }), h(async (req, res) => { res.json(await S.setTargets(uid(req), req.body.targets)); }));
r.get('/profile', h(async (req, res) => { res.json(await S.profile(uid(req))); }));
r.put('/profile', validate({ body: profileSchema }), h(async (req, res) => { res.json(await S.setProfile(uid(req), req.body.answers)); }));
r.get('/tax', validate({ query: yearQuery }), h(async (req, res) => { res.json(await S.tax(uid(req), q<{ year?: number }>(req).year)); }));

export const investments = r;
