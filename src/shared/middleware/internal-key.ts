import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { forbidden } from '../errors.js';

/** Protege rotas internas entre serviços (header x-api-key). */
export const requireInternalKey: RequestHandler = (req, _res, next) => {
  const given = Buffer.from(String(req.header('x-api-key') ?? ''));
  const expected = Buffer.from(env.INTERNAL_API_KEY);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return next(forbidden('Chave interna inválida'));
  next();
};
