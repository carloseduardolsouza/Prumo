import { hashPassword, verifyPassword } from '../../../shared/auth/password.js';
import { badRequest, conflict, forbidden, notFound } from '../../../shared/errors.js';
import { AuditModel } from '../models/audit.model.js';
import type { PreferencesInput } from '../models/auth.schemas.js';
import { PreferenceModel, toPublicPreferences } from '../models/preference.model.js';
import { SessionModel, toPublicSession } from '../models/session.model.js';
import { UserModel, toPublicUser } from '../models/user.model.js';

async function requireUser(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user || user.status === 'DELETED') throw notFound('Usuário');
  return user;
}

async function requirePassword(userId: string, password: string) {
  const user = await requireUser(userId);
  if (!(await verifyPassword(user.passwordHash, password))) throw forbidden('Senha incorreta');
  return user;
}

export const AccountService = {
  async me(userId: string) {
    return toPublicUser(await requireUser(userId));
  },

  async updateProfile(userId: string, patch: { name?: string; email?: string }, ip?: string) {
    const user = await requireUser(userId);
    const data: { name?: string; email?: string; emailVerifiedAt?: null; status?: 'PENDING_EMAIL' } = {};
    if (patch.name) data.name = patch.name;
    if (patch.email && patch.email !== user.email) {
      if (await UserModel.findByEmail(patch.email)) throw conflict('Já existe uma conta com esse e-mail');
      Object.assign(data, { email: patch.email, emailVerifiedAt: null, status: 'PENDING_EMAIL' }); // novo e-mail exige nova validação
    }
    const updated = await UserModel.update(userId, data);
    await AuditModel.record({ userId, action: 'user.update_profile', entity: 'user', entityId: userId, before: { name: user.name, email: user.email }, after: { name: updated.name, email: updated.email }, ip });
    return toPublicUser(updated);
  },

  async getPreferences(userId: string) {
    return toPublicPreferences(await PreferenceModel.get(userId));
  },

  async updatePreferences(userId: string, input: PreferencesInput) {
    return toPublicPreferences(await PreferenceModel.update(userId, input));
  },

  async changePassword(userId: string, sessionId: string, currentPassword: string, newPassword: string, ip?: string) {
    const user = await requirePassword(userId, currentPassword);
    if (await verifyPassword(user.passwordHash, newPassword)) throw badRequest('A nova senha precisa ser diferente da atual');
    await UserModel.setPassword(userId, await hashPassword(newPassword));
    await SessionModel.revokeAllOf(userId, sessionId); // mantém só este dispositivo
    await AuditModel.record({ userId, action: 'user.change_password', entity: 'user', entityId: userId, ip });
  },

  async listSessions(userId: string, currentSessionId: string) {
    return (await SessionModel.listActive(userId)).map((s) => toPublicSession(s, currentSessionId));
  },

  async revokeSession(userId: string, sessionId: string) {
    const r = await SessionModel.revokeOwned(userId, sessionId);
    if (r.count === 0) throw notFound('Sessão');
  },

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    return (await SessionModel.revokeAllOf(userId, currentSessionId)).count;
  },

  async requestDeletion(userId: string, password: string, ip?: string) {
    await requirePassword(userId, password);
    const user = await UserModel.update(userId, { status: 'DELETION_REQUESTED', deletionRequestedAt: new Date() });
    await AuditModel.record({ userId, action: 'user.request_deletion', entity: 'user', entityId: userId, ip });
    return toPublicUser(user);
  },

  async cancelDeletion(userId: string) {
    const current = await requireUser(userId);
    if (current.status !== 'DELETION_REQUESTED') throw conflict('Não há pedido de exclusão em andamento');
    const user = await UserModel.update(userId, { status: current.emailVerifiedAt ? 'ACTIVE' : 'PENDING_EMAIL', deletionRequestedAt: null });
    await AuditModel.record({ userId, action: 'user.cancel_deletion', entity: 'user', entityId: userId });
    return toPublicUser(user);
  },

  /** Exportação dos dados do titular (LGPD). Cada entrega futura acrescenta suas seções. */
  async exportData(userId: string, currentSessionId: string) {
    const user = await requireUser(userId);
    const [preferences, sessions, audit] = await Promise.all([PreferenceModel.get(userId), SessionModel.listActive(userId), AuditModel.listByUser(userId)]);
    return {
      exportedAt: new Date().toISOString(),
      user: toPublicUser(user),
      preferences: toPublicPreferences(preferences),
      sessions: sessions.map((s) => toPublicSession(s, currentSessionId)),
      audit: audit.map((a) => ({ action: a.action, entity: a.entity, entityId: a.entityId, at: a.createdAt })),
    };
  },
};
