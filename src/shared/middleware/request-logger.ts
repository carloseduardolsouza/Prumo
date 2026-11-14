import type { RequestHandler } from 'express';
import type { Logger } from '../logger.js';

export const requestLogger = (log: Logger): RequestHandler => (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path === '/health') return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    log.info('request', { method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) });
  });
  next();
};
