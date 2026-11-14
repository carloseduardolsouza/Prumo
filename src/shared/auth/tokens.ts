import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../errors.js';

export interface AccessClaims {
  sub: string; // userId
  sid: string; // sessionId
}

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
export const randomSecret = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** "15m", "30d", "12h" → milissegundos. */
export function parseDuration(value: string): number {
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(value.trim());
  if (!m) throw new Error(`Duração inválida: ${value} (use 30s, 15m, 12h ou 30d)`);
  const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return Number(m[1]) * unit;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: Math.floor(parseDuration(env.ACCESS_TTL) / 1000) });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded['sid'] !== 'string') throw new Error('claims');
    return { sub: decoded.sub, sid: decoded['sid'] as string };
  } catch {
    throw unauthorized('Token inválido ou expirado');
  }
}

/** Refresh opaco: "<sessionId>.<segredo>". Só o hash do segredo vai para o banco. */
export function parseRefreshToken(token: string): { sessionId: string; secret: string } {
  const i = token.indexOf('.');
  if (i < 1 || i === token.length - 1) throw unauthorized('Refresh token inválido');
  return { sessionId: token.slice(0, i), secret: token.slice(i + 1) };
}
