import { env } from '../../../shared/config/env.js';
import { unauthorized } from '../../../shared/errors.js';
import { parseDuration, parseRefreshToken, randomSecret, safeEqual, sha256, signAccessToken } from '../../../shared/auth/tokens.js';
import { SessionModel } from '../models/session.model.js';
import { UserModel } from '../models/user.model.js';

export interface ClientMeta {
  deviceName?: string | undefined;
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Segundos até o access token expirar. */
  expiresIn: number;
}

const refreshExpiry = () => new Date(Date.now() + parseDuration(env.REFRESH_TTL));
const accessSeconds = () => Math.floor(parseDuration(env.ACCESS_TTL) / 1000);

/** Abre uma sessão (um dispositivo) e devolve o par de tokens. */
export async function startSession(userId: string, meta: ClientMeta): Promise<TokenPair & { sessionId: string }> {
  const secret = randomSecret();
  const session = await SessionModel.create({ userId, refreshHash: sha256(secret), expiresAt: refreshExpiry(), ...meta });
  return {
    sessionId: session.id,
    accessToken: signAccessToken({ sub: userId, sid: session.id }),
    refreshToken: `${session.id}.${secret}`,
    expiresIn: accessSeconds(),
  };
}

/**
 * Troca o refresh token por um novo par (rotativo). Reapresentar um refresh já usado indica
 * possível roubo: a sessão inteira é revogada.
 */
export async function refreshSession(refreshToken: string): Promise<TokenPair & { userId: string }> {
  const { sessionId, secret } = parseRefreshToken(refreshToken);
  const session = await SessionModel.findById(sessionId);
  if (!session || session.revokedAt || session.expiresAt < new Date()) throw unauthorized('Sessão encerrada');

  const given = sha256(secret);
  if (session.prevRefreshHash && safeEqual(given, session.prevRefreshHash)) {
    await SessionModel.revoke(session.id);
    throw unauthorized('Sessão encerrada por segurança');
  }
  if (!safeEqual(given, session.refreshHash)) throw unauthorized('Refresh token inválido');

  const user = await UserModel.findById(session.userId);
  if (!user || user.status === 'DELETED') throw unauthorized('Conta indisponível');

  const next = randomSecret();
  await SessionModel.rotate(session.id, { refreshHash: sha256(next), prevRefreshHash: session.refreshHash, expiresAt: refreshExpiry() });
  return {
    userId: user.id,
    accessToken: signAccessToken({ sub: user.id, sid: session.id }),
    refreshToken: `${session.id}.${next}`,
    expiresIn: accessSeconds(),
  };
}
