import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../../src/shared/middleware/error-handler.js';
import { AppError, notFound } from '../../../src/shared/errors.js';

function run(err: unknown) {
  const res = { headersSent: false, status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  errorHandler(err, { method: 'GET', path: '/x' } as never, res as never, vi.fn());
  return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
}

describe('errorHandler', () => {
  it('Zod vira 400 com detalhes por campo', () => {
    const parsed = z.object({ email: z.string().email() }).safeParse({ email: 'x' });
    const { status, body } = run(parsed.success ? null : parsed.error);
    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details[0].path).toBe('email');
  });

  it('AppError mantém status e código', () => {
    const { status, body } = run(notFound('Carteira'));
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: 'Carteira não encontrado', code: 'NOT_FOUND' });
    expect(run(new AppError(409, 'CONFLICT', 'dup')).status).toBe(409);
  });

  it('erro desconhecido vira 500 sem vazar a mensagem', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { status, body } = run(new Error('segredo interno'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('segredo');
  });

  it('código P2002 do Prisma vira 409', () => {
    expect(run({ code: 'P2002' }).status).toBe(409);
  });
});
