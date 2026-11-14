import cors from 'cors';
import express, { type Express, type Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../database.js';
import { redis } from '../redis.js';
import { createLogger } from '../logger.js';
import { errorHandler, notFoundHandler } from '../middleware/error-handler.js';
import { requestLogger } from '../middleware/request-logger.js';

async function probe(fn: () => Promise<unknown>): Promise<'up' | 'down'> {
  try {
    await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500))]);
    return 'up';
  } catch {
    return 'down';
  }
}

type Service = 'core' | 'message';

interface AppOptions {
  service: Service;
  /** Prefixo versionado da API, ex.: "/api/v1". */
  prefix: string;
  router: Router;
}

export function createApp({ service, prefix, router }: AppOptions): Express {
  const log = createLogger(service);
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(requestLogger(log));

  app.get('/health', async (_req, res) => {
    const [db, queue] = await Promise.all([
      probe(() => prisma.$queryRaw`SELECT 1`),
      probe(async () => {
        if (redis.status === 'wait') await redis.connect();
        return redis.ping();
      }),
    ]);
    const ok = db === 'up' && queue === 'up';
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', service, database: db, redis: queue, timestamp: new Date().toISOString() });
  });

  app.use(prefix, router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export function listen(app: Express, service: Service, port: number): void {
  const log = createLogger(service);
  const server = app.listen(port, () => log.info(`${service} ouvindo`, { port, env: env.NODE_ENV }));
  const stop = async () => {
    server.close();
    await prisma.$disconnect().catch(() => undefined);
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
