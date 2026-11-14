import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { prisma } from '../database.js';
import { authOf } from './auth.js';
import { AppError, unprocessable } from '../errors.js';

const TTL_MS = 24 * 3_600_000;

/**
 * Idempotência para POSTs financeiros (RN011). Com o header "Idempotency-Key", repetir a mesma
 * requisição devolve a resposta já gravada em vez de executar de novo (ex.: toque duplo, retry de rede).
 * Sem o header, a requisição segue normalmente.
 */
export const idempotent: RequestHandler = async (req, res, next) => {
  const key = req.header('idempotency-key');
  if (!key) return next();
  try {
    if (key.length < 8 || key.length > 120) throw unprocessable('Idempotency-Key deve ter entre 8 e 120 caracteres');
    const { userId } = authOf(req);
    const requestHash = createHash('sha256').update(`${req.method} ${req.originalUrl} ${JSON.stringify(req.body ?? {})}`).digest('hex');

    const existing = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } });
    if (existing && existing.expiresAt > new Date()) {
      if (existing.requestHash !== requestHash) throw unprocessable('Idempotency-Key já usada com outro conteúdo');
      if (existing.responseCode === null) throw new AppError(409, 'IN_PROGRESS', 'Requisição idêntica ainda em processamento');
      res.setHeader('Idempotent-Replay', 'true');
      return void res.status(existing.responseCode).json(existing.responseBody);
    }

    // Reserva a chave antes de executar; se outra requisição reservar primeiro, o unique impede a duplicata.
    if (existing) await prisma.idempotencyKey.delete({ where: { id: existing.id } });
    const reservation = await prisma.idempotencyKey.create({ data: { userId, key, method: req.method, path: req.path, requestHash, expiresAt: new Date(Date.now() + TTL_MS) } });

    const json = res.json.bind(res);
    res.json = (body: unknown) => {
      // Só respostas de sucesso ficam gravadas; qualquer erro libera a chave para o cliente tentar de novo.
      const op = res.statusCode >= 300
        ? prisma.idempotencyKey.delete({ where: { id: reservation.id } })
        : prisma.idempotencyKey.update({ where: { id: reservation.id }, data: { responseCode: res.statusCode, responseBody: body as object } });
      op.catch(() => undefined);
      return json(body);
    };
    next();
  } catch (e) {
    next((e as { code?: string })?.code === 'P2002' ? new AppError(409, 'IN_PROGRESS', 'Requisição idêntica ainda em processamento') : e);
  }
};
