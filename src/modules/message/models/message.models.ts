import type { Notification, NotificationCategory, NotificationPreference } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../shared/database.js';

// ── Schemas de entrada ────────────────────────────────────────────────────────
export const listQuerySchema = z.object({
  category: z.enum(['venc', 'orc', 'meta', 'inv']).optional(),
  unread: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const idParamSchema = z.object({ id: z.string().uuid() });
export const preferencesSchema = z
  .object({
    venc: z.boolean(),
    orc: z.boolean(),
    meta: z.boolean(),
    inv: z.boolean(),
    leadDays: z.number().int().min(0).max(30),
    quietEnabled: z.boolean(),
    quietStart: z.number().int().min(0).max(23),
    quietEnd: z.number().int().min(0).max(23),
    pushEnabled: z.boolean(),
    emailEnabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos uma preferência');
export const deviceSchema = z.object({ token: z.string().min(10).max(300), platform: z.enum(['ios', 'android', 'web']) });
export const tokenParamSchema = z.object({ token: z.string().min(10).max(300) });
export const internalEventSchema = z.object({
  type: z.string().min(3).max(80),
  userId: z.string().uuid(),
  payload: z.record(z.unknown()).default({}),
  dedupeKey: z.string().min(3).max(200),
});

// ── Apresentação ──────────────────────────────────────────────────────────────
const catToApi: Record<NotificationCategory, 'venc' | 'orc' | 'meta' | 'inv'> = { VENC: 'venc', ORC: 'orc', META: 'meta', INV: 'inv' };
export const catToDb = (c: 'venc' | 'orc' | 'meta' | 'inv'): NotificationCategory => c.toUpperCase() as NotificationCategory;

export const toPublicNotification = (n: Notification) => ({
  id: n.id,
  type: n.type,
  category: catToApi[n.category],
  title: n.title,
  body: n.body,
  href: n.href,
  read: n.readAt !== null,
  createdAt: n.createdAt,
});

export const toPublicPreference = (p: NotificationPreference) => ({
  venc: p.venc, orc: p.orc, meta: p.meta, inv: p.inv, leadDays: p.leadDays,
  quietEnabled: p.quietEnabled, quietStart: p.quietStart, quietEnd: p.quietEnd,
  pushEnabled: p.pushEnabled, emailEnabled: p.emailEnabled,
});

// ── Acesso a dados (sempre filtrado por userId, RN001/RN009) ─────────────────
export const NotificationModel = {
  async list(userId: string, q: z.infer<typeof listQuerySchema>) {
    const where = {
      userId,
      ...(q.category ? { category: catToDb(q.category) } : {}),
      ...(q.unread === undefined ? {} : q.unread ? { readAt: null } : { readAt: { not: null } }),
    };
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, unread };
  },
  unreadCount: (userId: string) => prisma.notification.count({ where: { userId, readAt: null } }),
  markRead: (userId: string, id: string) => prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } }),
  exists: (userId: string, id: string) => prisma.notification.findFirst({ where: { id, userId }, select: { id: true } }),
  markAllRead: (userId: string) => prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } }),
  create: (data: { userId: string; type: string; category: NotificationCategory; title: string; body: string; href: string; dedupeKey: string; data?: object }) =>
    prisma.notification.create({ data: { ...data, data: data.data ?? {} } }),
};

export const PreferenceModel = {
  get: (userId: string) => prisma.notificationPreference.upsert({ where: { userId }, update: {}, create: { userId } }),
  update: (userId: string, patch: z.infer<typeof preferencesSchema>) =>
    prisma.notificationPreference.upsert({ where: { userId }, update: patch, create: { userId, ...patch } }),
};

export const DeviceModel = {
  register: (userId: string, token: string, platform: string) =>
    prisma.deviceToken.upsert({ where: { token }, update: { userId, platform, lastSeenAt: new Date() }, create: { userId, token, platform } }),
  remove: (userId: string, token: string) => prisma.deviceToken.deleteMany({ where: { userId, token } }),
  removeTokens: (tokens: string[]) => prisma.deviceToken.deleteMany({ where: { token: { in: tokens } } }),
  tokensOf: async (userId: string) => (await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } })).map((d) => d.token),
};

export const LogModel = {
  write: (userId: string | null, channel: 'email' | 'push' | 'in_app', type: string, status: 'sent' | 'skipped' | 'failed', detail?: string) =>
    prisma.messageLog.create({ data: { userId, channel, type, status, detail: detail?.slice(0, 500) ?? null } }).catch(() => undefined),
};

export const UserLookup = {
  /** O message lê só nome, e-mail e fuso do usuário (mesmo banco; nunca escreve em tabelas do core). */
  async get(userId: string) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, status: true, preferences: { select: { timezone: true } } } });
    return u ? { id: u.id, name: u.name, email: u.email, deleted: u.status === 'DELETED', timezone: u.preferences?.timezone ?? 'America/Sao_Paulo' } : null;
  },
};
