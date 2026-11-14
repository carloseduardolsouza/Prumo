import { describe, expect, it } from 'vitest';
import { parseDuration, parseRefreshToken, safeEqual, sha256, signAccessToken, verifyAccessToken } from '../../../src/shared/auth/tokens.js';
import { hashPassword, verifyPassword } from '../../../src/shared/auth/password.js';

describe('tokens', () => {
  it('parseDuration converte unidades e rejeita formato inválido', () => {
    expect(parseDuration('15m')).toBe(900_000);
    expect(parseDuration('30d')).toBe(30 * 86_400_000);
    expect(() => parseDuration('15')).toThrow();
  });

  it('access token faz ida e volta e rejeita adulteração', () => {
    const t = signAccessToken({ sub: 'u1', sid: 's1' });
    expect(verifyAccessToken(t)).toEqual({ sub: 'u1', sid: 's1' });
    expect(() => verifyAccessToken(t + 'x')).toThrow();
  });

  it('refresh token: separa sessão e segredo', () => {
    expect(parseRefreshToken('abc.def.ghi')).toEqual({ sessionId: 'abc', secret: 'def.ghi' });
    expect(() => parseRefreshToken('semponto')).toThrow();
    expect(() => parseRefreshToken('.x')).toThrow();
  });

  it('sha256 e safeEqual', () => {
    expect(sha256('a')).toHaveLength(64);
    expect(safeEqual(sha256('a'), sha256('a'))).toBe(true);
    expect(safeEqual(sha256('a'), sha256('b'))).toBe(false);
    expect(safeEqual('a', 'ab')).toBe(false);
  });
});

describe('password', () => {
  it('argon2id: valida a senha certa e rejeita a errada', async () => {
    const hash = await hashPassword('senha-forte-123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'senha-forte-123')).toBe(true);
    expect(await verifyPassword(hash, 'outra')).toBe(false);
    expect(await verifyPassword('lixo', 'x')).toBe(false);
  });
});
