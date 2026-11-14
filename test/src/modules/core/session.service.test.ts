import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '../../../../src/shared/auth/tokens.js';

const session = { id: 's1', userId: 'u1', refreshHash: sha256('segredo-atual'), prevRefreshHash: sha256('segredo-antigo') as string | null, revokedAt: null as Date | null, expiresAt: new Date(Date.now() + 1e9) };

vi.mock('../../../../src/modules/core/models/session.model.js', () => ({
  SessionModel: { findById: vi.fn(), rotate: vi.fn(), revoke: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../../src/modules/core/models/user.model.js', () => ({ UserModel: { findById: vi.fn() } }));

const { SessionModel } = await import('../../../../src/modules/core/models/session.model.js');
const { UserModel } = await import('../../../../src/modules/core/models/user.model.js');
const { refreshSession } = await import('../../../../src/modules/core/services/session.service.js');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(SessionModel.findById).mockResolvedValue({ ...session } as never);
  vi.mocked(UserModel.findById).mockResolvedValue({ id: 'u1', status: 'ACTIVE' } as never);
});

describe('refreshSession', () => {
  it('rotaciona: grava o novo hash e guarda o anterior', async () => {
    const out = await refreshSession('s1.segredo-atual');
    expect(out.refreshToken).toMatch(/^s1\./);
    expect(out.refreshToken).not.toBe('s1.segredo-atual');
    const call = vi.mocked(SessionModel.rotate).mock.calls[0]!;
    expect(call[1].prevRefreshHash).toBe(sha256('segredo-atual'));
  });

  it('reuso de um refresh antigo revoga a sessão inteira', async () => {
    await expect(refreshSession('s1.segredo-antigo')).rejects.toMatchObject({ status: 401 });
    expect(SessionModel.revoke).toHaveBeenCalledWith('s1');
    expect(SessionModel.rotate).not.toHaveBeenCalled();
  });

  it('segredo desconhecido é recusado sem revogar', async () => {
    await expect(refreshSession('s1.qualquer')).rejects.toMatchObject({ status: 401 });
    expect(SessionModel.revoke).not.toHaveBeenCalled();
  });

  it('sessão revogada ou expirada é recusada', async () => {
    vi.mocked(SessionModel.findById).mockResolvedValue({ ...session, revokedAt: new Date() } as never);
    await expect(refreshSession('s1.segredo-atual')).rejects.toMatchObject({ status: 401 });
    vi.mocked(SessionModel.findById).mockResolvedValue({ ...session, expiresAt: new Date(Date.now() - 1) } as never);
    await expect(refreshSession('s1.segredo-atual')).rejects.toMatchObject({ status: 401 });
  });

  it('conta excluída não renova', async () => {
    vi.mocked(UserModel.findById).mockResolvedValue({ id: 'u1', status: 'DELETED' } as never);
    await expect(refreshSession('s1.segredo-atual')).rejects.toMatchObject({ status: 401 });
  });
});
