import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../../shared/database.js';

export type PublicUser = ReturnType<typeof toPublicUser>;

export const toPublicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  emailVerified: u.emailVerifiedAt !== null,
  status: u.status,
  deletionRequestedAt: u.deletionRequestedAt,
  createdAt: u.createdAt,
});

export const UserModel = {
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  /** Cria o usuário já com as preferências padrão (mesma transação). */
  create: (data: { name: string; email: string; passwordHash: string }) =>
    prisma.user.create({ data: { ...data, preferences: { create: {} } } }),

  update: (id: string, data: Prisma.UserUpdateInput) => prisma.user.update({ where: { id }, data }),
  setPassword: (id: string, passwordHash: string) => prisma.user.update({ where: { id }, data: { passwordHash } }),
  markEmailVerified: (id: string) => prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date(), status: 'ACTIVE' } }),
};
