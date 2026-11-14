import type { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/database.js';

interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string | undefined;
}

// Nunca passe senhas, tokens ou dados de cartão em before/after (RN007, RNF008).
export const AuditModel = {
  record: (e: AuditEntry) =>
    prisma.auditLog.create({
      data: {
        userId: e.userId ?? null,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId ?? null,
        ip: e.ip ?? null,
        ...(e.before !== undefined ? { before: e.before } : {}),
        ...(e.after !== undefined ? { after: e.after } : {}),
      },
    }),
  listByUser: (userId: string, take = 1000) => prisma.auditLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take }),
};
