import { z } from 'zod';

// Schema puro (sem efeitos colaterais) para poder ser testado sem um .env real.
const secret = z.string().min(16, 'use ao menos 16 caracteres (ex.: openssl rand -hex 32)');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT_CORE: z.coerce.number().int().default(3000),
  PORT_MESSAGE: z.coerce.number().int().default(3001),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_USER: z.string().min(1, 'preencha DB_USER no .env'),
  DB_PASSWORD: z.string().min(1, 'preencha DB_PASSWORD no .env'),
  DB_NAME: z.string().min(1).default('prumo'),
  DB_SCHEMA: z.string().min(1).default('public'),

  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().default(''),

  JWT_ACCESS_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL: z.string().default('30d'),
  INTERNAL_API_KEY: secret,

  CORE_URL: z.string().url().default('http://localhost:3000'),
  MESSAGE_URL: z.string().url().default('http://localhost:3001'),
  APP_URL: z.string().default(''),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default('Prumo <no-reply@prumo.local>'),
  EXPO_ACCESS_TOKEN: z.string().default(''),
  // Jobs periódicos do core (recorrências e lembretes). Desligue em testes/CI.
  JOBS_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuração inválida no .env:\n${lines.join('\n')}`);
  }
  return result.data;
}
