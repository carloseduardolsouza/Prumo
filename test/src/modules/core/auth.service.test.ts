import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../../../src/shared/auth/password.js';

vi.mock('../../../../src/modules/core/models/user.model.js', () => ({
  UserModel: { findByEmail: vi.fn(), create: vi.fn(), findById: vi.fn(), setPassword: vi.fn(), markEmailVerified: vi.fn() },
  toPublicUser: (u: { id: string }) => ({ id: u.id }),
}));
vi.mock('../../../../src/modules/core/models/session.model.js', () => ({ SessionModel: { create: vi.fn(), revokeAllOf: vi.fn(), revokeOwned: vi.fn() } }));
vi.mock('../../../../src/modules/core/models/email-token.model.js', () => ({
  EmailTokenModel: { create: vi.fn(), findByHash: vi.fn(), markUsed: vi.fn(), invalidatePending: vi.fn() },
}));
vi.mock('../../../../src/modules/core/models/audit.model.js', () => ({ AuditModel: { record: vi.fn() } }));
vi.mock('../../../../src/shared/events-publisher.js', () => ({ emit: vi.fn() }));

const { UserModel } = await import('../../../../src/modules/core/models/user.model.js');
const { SessionModel } = await import('../../../../src/modules/core/models/session.model.js');
const { EmailTokenModel } = await import('../../../../src/modules/core/models/email-token.model.js');
const { emit } = await import('../../../../src/shared/events-publisher.js');
const { AuthService } = await import('../../../../src/modules/core/services/auth.service.js');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(SessionModel.create).mockResolvedValue({ id: 'sess1' } as never);
});

describe('AuthService.register', () => {
  it('recusa e-mail já cadastrado', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue({ id: 'x' } as never);
    await expect(AuthService.register({ name: 'Ana', email: 'a@a.com', password: '12345678' }, {})).rejects.toMatchObject({ status: 409 });
    expect(UserModel.create).not.toHaveBeenCalled();
  });

  it('cria usuário com senha em hash, emite o evento e abre sessão', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue(null);
    vi.mocked(UserModel.create).mockResolvedValue({ id: 'u1', name: 'Ana', email: 'a@a.com' } as never);
    const out = await AuthService.register({ name: 'Ana', email: 'a@a.com', password: '12345678' }, {});

    const created = vi.mocked(UserModel.create).mock.calls[0]![0];
    expect(created.passwordHash).toMatch(/^\$argon2id\$/);
    expect(created.passwordHash).not.toContain('12345678');
    expect(emit).toHaveBeenCalledWith('user.registered', 'u1', expect.any(String), expect.objectContaining({ email: 'a@a.com', verifyToken: expect.any(String) }));
    expect(out.refreshToken).toMatch(/^sess1\./);
  });
});

describe('AuthService.login', () => {
  it('mesma mensagem para e-mail inexistente e senha errada', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue(null);
    const unknown = await AuthService.login('x@x.com', 'qualquer', {}).catch((e) => e);

    vi.mocked(UserModel.findByEmail).mockResolvedValue({ id: 'u1', status: 'ACTIVE', passwordHash: await hashPassword('certa-12345') } as never);
    const wrong = await AuthService.login('x@x.com', 'errada-12345', {}).catch((e) => e);

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.message).toBe(wrong.message);
  });

  it('senha certa devolve tokens', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue({ id: 'u1', status: 'ACTIVE', passwordHash: await hashPassword('certa-12345') } as never);
    const out = await AuthService.login('x@x.com', 'certa-12345', {});
    expect(out.accessToken).toBeTruthy();
    expect(out.refreshToken).toMatch(/^sess1\./);
  });
});

describe('AuthService.forgotPassword / resetPassword', () => {
  it('não revela se o e-mail existe (nenhum evento, nenhum erro)', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue(null);
    await expect(AuthService.forgotPassword('nao@existe.com')).resolves.toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });

  it('token inválido, usado ou expirado é recusado', async () => {
    vi.mocked(EmailTokenModel.findByHash).mockResolvedValue(null);
    await expect(AuthService.resetPassword('x'.repeat(20), 'nova-senha-123')).rejects.toMatchObject({ status: 400 });
    vi.mocked(EmailTokenModel.findByHash).mockResolvedValue({ id: 't', userId: 'u1', usedAt: new Date(), expiresAt: new Date(Date.now() + 1e6) } as never);
    await expect(AuthService.resetPassword('x'.repeat(20), 'nova-senha-123')).rejects.toMatchObject({ status: 400 });
  });

  it('reset válido troca a senha e derruba todas as sessões', async () => {
    vi.mocked(EmailTokenModel.findByHash).mockResolvedValue({ id: 't', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 1e6) } as never);
    await AuthService.resetPassword('x'.repeat(20), 'nova-senha-123');
    expect(UserModel.setPassword).toHaveBeenCalledWith('u1', expect.stringMatching(/^\$argon2id\$/));
    expect(SessionModel.revokeAllOf).toHaveBeenCalledWith('u1');
    expect(EmailTokenModel.markUsed).toHaveBeenCalledWith('t');
  });
});
