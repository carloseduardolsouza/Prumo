import type { Handler } from '../../../shared/http/async-handler.js';
import { notFound } from '../../../shared/errors.js';
import { authOf } from '../../../shared/middleware/auth.js';
import { publishEvent } from '../../../shared/queue.js';
import { EVENT_TYPES, type EventType } from '../../../shared/events.js';
import { badRequest } from '../../../shared/errors.js';
import { DeviceModel, NotificationModel, PreferenceModel, toPublicNotification, toPublicPreference } from '../models/message.models.js';

export const NotificationController: Record<string, Handler> = {
  list: async (req, res) => {
    const q = (req as unknown as { validatedQuery: Parameters<typeof NotificationModel.list>[1] }).validatedQuery;
    const { items, total, unread } = await NotificationModel.list(authOf(req).userId, q);
    res.json({ notifications: items.map(toPublicNotification), page: q.page, limit: q.limit, total, unread });
  },
  unreadCount: async (req, res) => {
    res.json({ unread: await NotificationModel.unreadCount(authOf(req).userId) });
  },
  markRead: async (req, res) => {
    const userId = authOf(req).userId;
    const id = String(req.params['id']);
    if (!(await NotificationModel.exists(userId, id))) throw notFound('Notificação');
    await NotificationModel.markRead(userId, id);
    res.status(204).end();
  },
  markAllRead: async (req, res) => {
    res.json({ updated: (await NotificationModel.markAllRead(authOf(req).userId)).count });
  },
};

export const PreferenceController: Record<string, Handler> = {
  get: async (req, res) => {
    res.json({ preferences: toPublicPreference(await PreferenceModel.get(authOf(req).userId)) });
  },
  put: async (req, res) => {
    res.json({ preferences: toPublicPreference(await PreferenceModel.update(authOf(req).userId, req.body)) });
  },
};

export const DeviceController: Record<string, Handler> = {
  register: async (req, res) => {
    await DeviceModel.register(authOf(req).userId, req.body.token, req.body.platform);
    res.status(204).end();
  },
  remove: async (req, res) => {
    await DeviceModel.remove(authOf(req).userId, decodeURIComponent(String(req.params['token'])));
    res.status(204).end();
  },
};

/** Entrada interna (x-api-key): outros serviços enfileiram eventos por HTTP quando não têm acesso ao Redis. */
export const InternalController: Record<string, Handler> = {
  publish: async (req, res) => {
    const { type, userId, payload, dedupeKey } = req.body;
    if (!(EVENT_TYPES as readonly string[]).includes(type)) throw badRequest(`Tipo de evento desconhecido: ${type}`);
    await publishEvent({ type: type as EventType, userId, payload, dedupeKey, occurredAt: new Date().toISOString() });
    res.status(202).json({ queued: true });
  },
};
