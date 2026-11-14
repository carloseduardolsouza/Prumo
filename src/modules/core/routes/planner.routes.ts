import { Router } from 'express';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { authOf, requireAuth } from '../../../shared/middleware/auth.js';
import { validate } from '../../../shared/middleware/validate.js';
import { idParam } from '../models/finance.schemas.js';
import { autoInvestPatchSchema, autoInvestSchema, budgetSchema, categoryParam, contributionParam, contributionSchema, exportQuery, goalCreateSchema, goalPatchSchema, monthQuery } from '../models/planner.schemas.js';
import { BudgetService } from '../services/budget.service.js';
import { ExportService } from '../services/export.service.js';
import { AutoInvestService, GoalService } from '../services/goal.service.js';
import { HealthService } from '../services/health.service.js';

type Req = Parameters<Parameters<typeof h>[0]>[0];
const uid = (req: Req) => authOf(req).userId;
const pid = (req: Req) => String(req.params['id']);
const q = <T>(req: Req) => (req as unknown as { validatedQuery: T }).validatedQuery;

export const budgets = Router().use(requireAuth);
budgets.get('/', validate({ query: monthQuery }), h(async (req, res) => { res.json(await BudgetService.list(uid(req), q<{ month?: string }>(req).month)); }));
budgets.get('/spendable', h(async (req, res) => { res.json(await BudgetService.spendable(uid(req))); }));
budgets.put('/:categoryId', validate({ params: categoryParam, body: budgetSchema }), h(async (req, res) => { res.json(await BudgetService.set(uid(req), String(req.params['categoryId']), req.body.amount)); }));
budgets.delete('/:categoryId', validate({ params: categoryParam }), h(async (req, res) => { res.json(await BudgetService.remove(uid(req), String(req.params['categoryId']))); }));

export const goals = Router().use(requireAuth);
goals.get('/', h(async (req, res) => { res.json(await GoalService.list(uid(req))); }));
goals.post('/', validate({ body: goalCreateSchema }), h(async (req, res) => { res.status(201).json(await GoalService.create(uid(req), req.body)); }));
goals.get('/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await GoalService.get(uid(req), pid(req))); }));
goals.patch('/:id', validate({ params: idParam, body: goalPatchSchema }), h(async (req, res) => { res.json(await GoalService.patch(uid(req), pid(req), req.body)); }));
goals.post('/:id/contributions', validate({ params: idParam, body: contributionSchema }), h(async (req, res) => { res.status(201).json(await GoalService.contribute(uid(req), pid(req), req.body)); }));
goals.delete('/:id/contributions/:contributionId', validate({ params: contributionParam }), h(async (req, res) => { res.json(await GoalService.removeContribution(uid(req), pid(req), String(req.params['contributionId']))); }));

export const autoInvest = Router().use(requireAuth);
autoInvest.get('/', h(async (req, res) => { res.json(await AutoInvestService.list(uid(req))); }));
autoInvest.post('/', validate({ body: autoInvestSchema }), h(async (req, res) => { res.status(201).json(await AutoInvestService.create(uid(req), req.body)); }));
autoInvest.patch('/:id', validate({ params: idParam, body: autoInvestPatchSchema }), h(async (req, res) => { res.json(await AutoInvestService.patch(uid(req), pid(req), req.body)); }));
autoInvest.delete('/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await AutoInvestService.remove(uid(req), pid(req))); }));
autoInvest.post('/:id/confirm', validate({ params: idParam }), h(async (req, res) => { res.json(await AutoInvestService.confirm(uid(req), pid(req))); }));

export const insights = Router().use(requireAuth);
insights.get('/health-score', h(async (req, res) => { res.json(await HealthService.score(uid(req))); }));
insights.get('/net-worth', h(async (req, res) => { res.json(await HealthService.netWorth(uid(req))); }));
insights.get('/export', validate({ query: exportQuery }), h(async (req, res) => {
  const { kind, from, to } = q<{ kind: 'transactions' | 'investments'; from: string; to: string }>(req);
  const body = kind === 'transactions' ? await ExportService.transactions(uid(req), from, to) : await ExportService.investments(uid(req), from, to);
  res.type('text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="prumo-${kind}-${from}-${to}.csv"`).send(body);
}));
