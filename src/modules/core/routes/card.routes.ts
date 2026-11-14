import { Router } from 'express';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { authOf, requireAuth } from '../../../shared/middleware/auth.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { validate } from '../../../shared/middleware/validate.js';
import { cardCreateSchema, cardStatusSchema, cardUpdateSchema, invoiceListQuery, limitAdjustSchema, payInvoiceSchema, purchaseCreateSchema, refundSchema } from '../models/card.schemas.js';
import { idParam } from '../models/finance.schemas.js';
import { CardService } from '../services/card.service.js';
import { InvoiceService } from '../services/invoice.service.js';
import { PurchaseService } from '../services/purchase.service.js';
import { z } from 'zod';

const uid = (req: Parameters<Parameters<typeof h>[0]>[0]) => authOf(req).userId;
const pid = (req: Parameters<Parameters<typeof h>[0]>[0]) => String(req.params['id']);
const vq = <T>(req: unknown) => (req as { validatedQuery: T }).validatedQuery;
const archivedQuery = z.object({ archived: z.enum(['true', 'false']).transform((v) => v === 'true').optional() });

export const cards = Router().use(requireAuth);
cards.get('/', validate({ query: archivedQuery }), h(async (req, res) => { res.json(await CardService.list(uid(req), vq<{ archived?: boolean }>(req).archived)); }));
cards.post('/', idempotent, validate({ body: cardCreateSchema }), h(async (req, res) => { res.status(201).json({ card: await CardService.create(uid(req), req.body) }); }));
cards.get('/:id', validate({ params: idParam }), h(async (req, res) => { res.json({ card: await CardService.get(uid(req), pid(req)) }); }));
cards.patch('/:id', validate({ params: idParam, body: cardUpdateSchema }), h(async (req, res) => { res.json({ card: await CardService.update(uid(req), pid(req), req.body) }); }));
cards.post('/:id/status', validate({ params: idParam, body: cardStatusSchema }), h(async (req, res) => { res.json({ card: await CardService.setStatus(uid(req), pid(req), req.body.status) }); }));
cards.post('/:id/limit', validate({ params: idParam, body: limitAdjustSchema }), h(async (req, res) => { res.json({ card: await CardService.adjustLimit(uid(req), pid(req), req.body.limit, req.body.reason) }); }));
cards.get('/:id/invoices', validate({ params: idParam, query: invoiceListQuery }), h(async (req, res) => {
  const q = vq<{ from: number; to: number }>(req);
  res.json(await InvoiceService.list(uid(req), pid(req), q.from, q.to));
}));
cards.get('/:id/future-installments', validate({ params: idParam }), h(async (req, res) => { res.json(await InvoiceService.future(uid(req), pid(req))); }));

export const invoices = Router().use(requireAuth);
invoices.get('/:id', validate({ params: idParam }), h(async (req, res) => { res.json(await InvoiceService.get(uid(req), pid(req))); }));
invoices.post('/:id/pay', idempotent, validate({ params: idParam, body: payInvoiceSchema }), h(async (req, res) => { res.status(201).json(await InvoiceService.pay(uid(req), pid(req), req.body)); }));
invoices.post('/payments/:id/cancel', validate({ params: idParam }), h(async (req, res) => { res.json(await InvoiceService.cancelPayment(uid(req), pid(req))); }));

export const cardPurchases = Router().use(requireAuth);
cardPurchases.post('/', idempotent, validate({ body: purchaseCreateSchema }), h(async (req, res) => { res.status(201).json({ purchase: await PurchaseService.create(uid(req), req.body) }); }));
cardPurchases.get('/:id', validate({ params: idParam }), h(async (req, res) => { res.json({ purchase: await PurchaseService.get(uid(req), pid(req)) }); }));
cardPurchases.post('/:id/cancel', validate({ params: idParam }), h(async (req, res) => { res.json({ purchase: await PurchaseService.cancel(uid(req), pid(req)) }); }));
cardPurchases.post('/:id/refund', idempotent, validate({ params: idParam, body: refundSchema }), h(async (req, res) => { res.status(201).json({ purchase: await PurchaseService.refund(uid(req), pid(req), req.body) }); }));
