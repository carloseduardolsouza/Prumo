import { Redis } from 'ioredis';
import { env } from './config/env.js';
import { createLogger } from './logger.js';

const log = createLogger('redis');

export function createRedis(): Redis {
  const client = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // exigido pelo BullMQ
    lazyConnect: true, // o servidor sobe mesmo sem Redis; /health informa o estado
  });
  client.on('error', (e) => log.warn('redis indisponível', { message: e.message }));
  return client;
}

export const redis = createRedis();
