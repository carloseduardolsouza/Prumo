import type { RequestHandler } from 'express';
import { prisma } from '../database.js';
import { forbidden, unauthorized } from '../errors.js';
import { verifyAccessToken } from '../auth/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; sessionId: string };
    }
  }
}

/** Exige "Authorization: Bearer <access token>" de uma sessão ativa de um usuário não excluído (RN001). */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization') ?? '';
    if (!header.startsWith('Bearer ')) throw unauthorized();
    const claims = verifyAccessToken(header.slice(7));

    const session = await prisma.session.findUnique({ where: { id: claims.sid }, include: { user: { select: { id: true, status: true } } } });
    if (!session || session.userId !== claims.sub || session.revokedAt || session.expiresAt < new Date()) throw unauthorized('Sessão encerrada');
    if (session.user.status === 'DELETED') throw forbidden('Conta excluída');

    req.auth = { userId: session.userId, sessionId: session.id };
    next();
  } catch (e) {
    next(e);
  }
};

/** Para usar nos controllers depois do requireAuth. */
export function authOf(req: { auth?: { userId: string; sessionId: string } }): { userId: string; sessionId: string } {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
