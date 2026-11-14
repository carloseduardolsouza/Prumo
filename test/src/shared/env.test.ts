import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../../src/shared/config/env-schema.js';

const valid = {
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  INTERNAL_API_KEY: 'c'.repeat(32),
};

describe('parseEnv', () => {
  it('aplica defaults e converte números', () => {
    const e = parseEnv({ ...valid, PORT_CORE: '4000' });
    expect(e.PORT_CORE).toBe(4000);
    expect(e.PORT_MESSAGE).toBe(3001);
    expect(e.DB_NAME).toBe('prumo');
  });

  it('falha apontando as variáveis que faltam', () => {
    expect(() => parseEnv({})).toThrow(/DB_USER/);
    expect(() => parseEnv({ ...valid, JWT_ACCESS_SECRET: 'curto' })).toThrow(/JWT_ACCESS_SECRET/);
  });
});
