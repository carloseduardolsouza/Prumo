import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';
import { createLogger } from '../logger.js';

const log = createLogger('http');

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}`, code: 'ROUTE_NOT_FOUND' });
};

// Formato de erro único: { error: string, code: string, details? }
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return void res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details });
  }
  if (err instanceof AppError) {
    return void res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  }
  // JSON malformado no body
  if (err?.type === 'entity.parse.failed') {
    return void res.status(400).json({ error: 'JSON inválido', code: 'INVALID_JSON' });
  }
  // Prisma: violação de unicidade / registro inexistente (checagem estrutural, sem depender do client gerado)
  if (err?.code === 'P2002') return void res.status(409).json({ error: 'Registro já existe', code: 'CONFLICT' });
  if (err?.code === 'P2025') return void res.status(404).json({ error: 'Registro não encontrado', code: 'NOT_FOUND' });

  log.error('erro não tratado', { method: req.method, path: req.path, message: err?.message, stack: err?.stack });
  res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
};
