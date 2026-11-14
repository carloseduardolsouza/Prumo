import type { Request } from 'express';
import type { Handler } from '../../../shared/http/async-handler.js';
import { authOf } from '../../../shared/middleware/auth.js';
import { refreshSession } from '../services/session.service.js';
import { AuthService } from '../services/auth.service.js';

const meta = (req: Request, deviceName?: string) => ({ deviceName, userAgent: req.header('user-agent') ?? undefined, ip: req.ip });

// Controllers só traduzem HTTP ↔ service; a regra de negócio fica nos services.
export const AuthController: Record<string, Handler> = {
  register: async (req, res) => {
    const { deviceName, ...input } = req.body;
    res.status(201).json(await AuthService.register(input, meta(req, deviceName)));
  },
  login: async (req, res) => {
    res.json(await AuthService.login(req.body.email, req.body.password, meta(req, req.body.deviceName)));
  },
  refresh: async (req, res) => {
    res.json(await refreshSession(req.body.refreshToken));
  },
  logout: async (req, res) => {
    const { userId, sessionId } = authOf(req);
    await AuthService.logout(sessionId, userId);
    res.status(204).end();
  },
  forgotPassword: async (req, res) => {
    await AuthService.forgotPassword(req.body.email);
    res.status(202).json({ message: 'Se houver uma conta com esse e-mail, enviaremos as instruções.' });
  },
  resetPassword: async (req, res) => {
    await AuthService.resetPassword(req.body.token, req.body.password);
    res.json({ message: 'Senha redefinida. Entre novamente.' });
  },
  verifyEmail: async (req, res) => {
    res.json({ user: await AuthService.verifyEmail(req.body.token) });
  },
  resendVerification: async (req, res) => {
    await AuthService.resendVerification(authOf(req).userId);
    res.status(202).json({ message: 'Enviamos um novo link de verificação.' });
  },
};
