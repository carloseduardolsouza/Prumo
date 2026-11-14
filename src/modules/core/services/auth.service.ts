import type { EmailTokenKind } from '@prisma/client';
import { hashPassword, verifyPassword } from '../../../shared/auth/password.js';
import { randomSecret, sha256 } from '../../../shared/auth/tokens.js';
import { badRequest, conflict, unauthorized } from '../../../shared/errors.js';
import { emit } from '../../../shared/events-publisher.js';
import { AuditModel } from '../models/audit.model.js';
import type { RegisterInput } from '../models/auth.schemas.js';
import { EmailTokenModel } from '../models/email-token.model.js';
import { SessionModel } from '../models/session.model.js';
import { UserModel, toPublicUser } from '../models/user.model.js';
import { startSession, type ClientMeta } from './session.service.js';

const VERIFY_TTL_MS = 24 * 3_600_000;
const RESET_TTL_MS = 3_600_000;

// Hash fixo para gastar o mesmo tempo quando o e-mail não existe (evita enumerar contas pelo tempo de resposta).
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('prumo-dummy-password'));

async function issueEmailToken(userId: string, kind: EmailTokenKind, ttlMs: number): Promise<string> {
  const token = randomSecret();
  await EmailTokenModel.invalidatePending(userId, kind);
  await EmailTokenModel.create({ userId, kind, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function consumeEmailToken(rawToken: string, kind: EmailTokenKind) {
  const record = await EmailTokenModel.findByHash(sha256(rawToken), kind);
  if (!record || record.usedAt || record.expiresAt < new Date()) throw badRequest('Link inválido ou expirado');
  await EmailTokenModel.markUsed(record.id);
  return record;
}

export const AuthService = {
  async register(input: RegisterInput, meta: ClientMeta) {
    if (await UserModel.findByEmail(input.email)) throw conflict('Já existe uma conta com esse e-mail');

    const user = await UserModel.create({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) });
    const verifyToken = await issueEmailToken(user.id, 'VERIFY_EMAIL', VERIFY_TTL_MS);
    await AuditModel.record({ userId: user.id, action: 'user.register', entity: 'user', entityId: user.id, ip: meta.ip });
    await emit('user.registered', user.id, `user.registered__${user.id}`, { name: user.name, email: user.email, verifyToken });

    const tokens = await startSession(user.id, { ...meta, deviceName: input.deviceName ?? meta.deviceName });
    return { user: toPublicUser(user), ...tokens };
  },

  async login(email: string, password: string, meta: ClientMeta) {
    const user = await UserModel.findByEmail(email);
    const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
    if (!user || !ok || user.status === 'DELETED') throw unauthorized('E-mail ou senha incorretos');

    await AuditModel.record({ userId: user.id, action: 'user.login', entity: 'session', ip: meta.ip });
    const tokens = await startSession(user.id, meta);
    return { user: toPublicUser(user), ...tokens };
  },

  async logout(sessionId: string, userId: string) {
    await SessionModel.revokeOwned(userId, sessionId);
  },

  /** Sempre "aceita", exista a conta ou não (RN: não revelar quais e-mails estão cadastrados). */
  async forgotPassword(email: string) {
    const user = await UserModel.findByEmail(email);
    if (!user || user.status === 'DELETED') return;
    const resetToken = await issueEmailToken(user.id, 'RESET_PASSWORD', RESET_TTL_MS);
    await emit('user.password_reset_requested', user.id, `user.password_reset_requested__${user.id}__${Date.now()}`, { name: user.name, email: user.email, resetToken });
  },

  async resetPassword(token: string, newPassword: string) {
    const record = await consumeEmailToken(token, 'RESET_PASSWORD');
    await UserModel.setPassword(record.userId, await hashPassword(newPassword));
    await SessionModel.revokeAllOf(record.userId); // derruba todos os dispositivos
    await AuditModel.record({ userId: record.userId, action: 'user.password_reset', entity: 'user', entityId: record.userId });
  },

  async verifyEmail(token: string) {
    const record = await consumeEmailToken(token, 'VERIFY_EMAIL');
    const user = await UserModel.markEmailVerified(record.userId);
    await AuditModel.record({ userId: user.id, action: 'user.verify_email', entity: 'user', entityId: user.id });
    return toPublicUser(user);
  },

  async resendVerification(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw unauthorized();
    if (user.emailVerifiedAt) throw conflict('E-mail já verificado');
    const verifyToken = await issueEmailToken(user.id, 'VERIFY_EMAIL', VERIFY_TTL_MS);
    await emit('user.registered', user.id, `user.registered__${user.id}__${Date.now()}`, { name: user.name, email: user.email, verifyToken });
  },
};
