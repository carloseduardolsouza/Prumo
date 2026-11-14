import type { Handler } from '../../../shared/http/async-handler.js';
import { authOf } from '../../../shared/middleware/auth.js';
import { AccountService } from '../services/account.service.js';

export const MeController: Record<string, Handler> = {
  get: async (req, res) => {
    res.json({ user: await AccountService.me(authOf(req).userId) });
  },
  patch: async (req, res) => {
    res.json({ user: await AccountService.updateProfile(authOf(req).userId, req.body, req.ip) });
  },
  getPreferences: async (req, res) => {
    res.json({ preferences: await AccountService.getPreferences(authOf(req).userId) });
  },
  putPreferences: async (req, res) => {
    res.json({ preferences: await AccountService.updatePreferences(authOf(req).userId, req.body) });
  },
  changePassword: async (req, res) => {
    const { userId, sessionId } = authOf(req);
    await AccountService.changePassword(userId, sessionId, req.body.currentPassword, req.body.newPassword, req.ip);
    res.json({ message: 'Senha alterada. Os outros dispositivos foram desconectados.' });
  },
  listSessions: async (req, res) => {
    const { userId, sessionId } = authOf(req);
    res.json({ sessions: await AccountService.listSessions(userId, sessionId) });
  },
  revokeSession: async (req, res) => {
    await AccountService.revokeSession(authOf(req).userId, String(req.params['id']));
    res.status(204).end();
  },
  revokeOtherSessions: async (req, res) => {
    const { userId, sessionId } = authOf(req);
    res.json({ revoked: await AccountService.revokeOtherSessions(userId, sessionId) });
  },
  requestDeletion: async (req, res) => {
    res.json({ user: await AccountService.requestDeletion(authOf(req).userId, req.body.password, req.ip) });
  },
  cancelDeletion: async (req, res) => {
    res.json({ user: await AccountService.cancelDeletion(authOf(req).userId) });
  },
  exportData: async (req, res) => {
    const { userId, sessionId } = authOf(req);
    res.setHeader('Content-Disposition', 'attachment; filename="prumo-meus-dados.json"');
    res.json(await AccountService.exportData(userId, sessionId));
  },
};
