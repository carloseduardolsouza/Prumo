import type { EmailTokenKind } from '@prisma/client';
import { prisma } from '../../../shared/database.js';

export const EmailTokenModel = {
  create: (data: { userId: string; kind: EmailTokenKind; tokenHash: string; expiresAt: Date }) => prisma.emailToken.create({ data }),
  findByHash: (tokenHash: string, kind: EmailTokenKind) => prisma.emailToken.findFirst({ where: { tokenHash, kind } }),
  markUsed: (id: string) => prisma.emailToken.update({ where: { id }, data: { usedAt: new Date() } }),
  /** Invalida os pendentes do mesmo tipo antes de emitir um novo. */
  invalidatePending: (userId: string, kind: EmailTokenKind) =>
    prisma.emailToken.updateMany({ where: { userId, kind, usedAt: null }, data: { usedAt: new Date() } }),
};
