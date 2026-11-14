import type { Session } from '@prisma/client';
import { prisma } from '../../../shared/database.js';

export const SessionModel = {
  create: (data: { userId: string; refreshHash: string; expiresAt: Date; deviceName?: string | undefined; userAgent?: string | undefined; ip?: string | undefined }) =>
    prisma.session.create({ data }),
  findById: (id: string) => prisma.session.findUnique({ where: { id } }),
  rotate: (id: string, data: { refreshHash: string; prevRefreshHash: string; expiresAt: Date }) =>
    prisma.session.update({ where: { id }, data: { ...data, lastUsedAt: new Date() } }),
  revoke: (id: string) => prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }),
  /** Revoga só se a sessão for do usuário (isolamento, RN009). */
  revokeOwned: (userId: string, id: string) => prisma.session.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  revokeAllOf: (userId: string, exceptId?: string) =>
    prisma.session.updateMany({ where: { userId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) }, data: { revokedAt: new Date() } }),
  listActive: (userId: string): Promise<Session[]> =>
    prisma.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' } }),
};

export const toPublicSession = (s: Session, currentId: string) => ({
  id: s.id,
  deviceName: s.deviceName ?? 'Dispositivo desconhecido',
  ip: s.ip,
  createdAt: s.createdAt,
  lastUsedAt: s.lastUsedAt,
  current: s.id === currentId,
});
