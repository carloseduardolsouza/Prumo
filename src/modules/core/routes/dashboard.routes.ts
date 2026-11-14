import { Router } from 'express';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { authOf, requireAuth } from '../../../shared/middleware/auth.js';
import { validate } from '../../../shared/middleware/validate.js';
import { byCategoryQuery, dashboardQuery, monthlyResultQuery, rangeRequired } from '../models/dashboard.schemas.js';
import { DashboardService } from '../services/dashboard.service.js';
import { ReportService } from '../services/report.service.js';

const vq = <T>(req: unknown) => (req as { validatedQuery: T }).validatedQuery;

export const dashboard = Router().use(requireAuth);
dashboard.get('/', validate({ query: dashboardQuery }), h(async (req, res) => {
  res.json(await DashboardService.get(authOf(req).userId, vq(req)));
}));

export const reports = Router().use(requireAuth);
reports.get('/by-category', validate({ query: byCategoryQuery }), h(async (req, res) => {
  const q = vq<{ type: 'INCOME' | 'EXPENSE'; from: string; to: string }>(req);
  res.json(await ReportService.byCategory(authOf(req).userId, q.type, q.from, q.to));
}));
reports.get('/monthly-result', validate({ query: monthlyResultQuery }), h(async (req, res) => {
  res.json(await ReportService.monthlyResult(authOf(req).userId, vq<{ year?: number }>(req).year));
}));
reports.get('/transfers', validate({ query: rangeRequired }), h(async (req, res) => {
  const q = vq<{ from: string; to: string }>(req);
  res.json(await ReportService.transfers(authOf(req).userId, q.from, q.to));
}));
