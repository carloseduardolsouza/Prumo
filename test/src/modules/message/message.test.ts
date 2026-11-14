import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isQuietHour } from '../../../../src/modules/message/services/quiet-hours.js';
import { categoryOf, inAppContent, transactionalMail } from '../../../../src/modules/message/services/templates.js';
import type { DomainEvent } from '../../../../src/shared/events.js';

const ev = (type: DomainEvent['type'], payload: Record<string, unknown> = {}): DomainEvent => ({ type, userId: 'u1', payload, dedupeKey: `${type}__1`, occurredAt: new Date().toISOString() });

describe('isQuietHour', () => {
  const cfg = { quietEnabled: true, quietStart: 22, quietEnd: 7 };
  // 01:00 UTC = 22:00 em Brasília (GMT-3)
  it('janela que cruza a meia-noite, no fuso do usuário', () => {
    expect(isQuietHour(new Date('2026-11-14T01:00:00Z'), 'America/Sao_Paulo', cfg)).toBe(true); // 22h
    expect(isQuietHour(new Date('2026-11-14T09:59:00Z'), 'America/Sao_Paulo', cfg)).toBe(true); // 06h59
    expect(isQuietHour(new Date('2026-11-14T10:00:00Z'), 'America/Sao_Paulo', cfg)).toBe(false); // 07h
    expect(isQuietHour(new Date('2026-11-14T15:00:00Z'), 'America/Sao_Paulo', cfg)).toBe(false); // 12h
  });
  it('desligado ou janela vazia nunca silencia', () => {
    expect(isQuietHour(new Date('2026-11-14T01:00:00Z'), 'America/Sao_Paulo', { ...cfg, quietEnabled: false })).toBe(false);
    expect(isQuietHour(new Date('2026-11-14T01:00:00Z'), 'America/Sao_Paulo', { ...cfg, quietStart: 8, quietEnd: 8 })).toBe(false);
  });
  it('janela no mesmo dia (13h–15h)', () => {
    const c = { quietEnabled: true, quietStart: 13, quietEnd: 15 };
    expect(isQuietHour(new Date('2026-11-14T16:30:00Z'), 'America/Sao_Paulo', c)).toBe(true); // 13h30
    expect(isQuietHour(new Date('2026-11-14T19:00:00Z'), 'America/Sao_Paulo', c)).toBe(false); // 16h
  });
});

describe('templates', () => {
  it('cada evento de alerta tem categoria e conteúdo; os de conta não', () => {
    expect(categoryOf('invoice.due_soon')).toBe('venc');
    expect(categoryOf('budget.threshold')).toBe('orc');
    expect(categoryOf('goal.reached')).toBe('meta');
    expect(categoryOf('investment.dividend_incoming')).toBe('inv');
    expect(categoryOf('user.registered')).toBeUndefined();
    expect(inAppContent(ev('user.registered'))).toBeUndefined();
  });

  it('formata valores em reais e prazos', () => {
    const c = inAppContent(ev('invoice.due_soon', { card: 'Nubank', amount: 1842.1, days: 6 }))!;
    expect(c.title).toBe('Fatura Nubank vence em 6 dias');
    expect(c.body).toContain('R$ 1.842,10');
    expect(c.href).toBe('/fatura');
    expect(inAppContent(ev('bill.due_soon', { name: 'Energia', amount: 214.9, days: 0, dueDate: '18/11' }))!.title).toBe('Energia vence hoje');
  });

  it('e-mail de verificação e de reset trazem link e código; HTML escapa o nome', () => {
    const m = transactionalMail(ev('user.registered', { name: '<b>Ana</b>', verifyToken: 'tok-verify-123' }), 'a@a.com')!;
    expect(m.to).toBe('a@a.com');
    expect(m.text).toContain('verificar-email?token=tok-verify-123');
    expect(m.html).not.toContain('<b>Ana</b>');
    const r = transactionalMail(ev('user.password_reset_requested', { name: 'Ana', resetToken: 'tok-reset-456' }), 'a@a.com')!;
    expect(r.subject).toMatch(/senha/i);
    expect(r.text).toContain('redefinir-senha?token=tok-reset-456');
    expect(transactionalMail(ev('user.registered', { name: 'Ana' }), 'a@a.com')).toBeUndefined();
  });
});

vi.mock('../../../../src/modules/message/models/message.models.js', () => ({
  NotificationModel: { create: vi.fn() },
  PreferenceModel: { get: vi.fn() },
  DeviceModel: { tokensOf: vi.fn(), removeTokens: vi.fn() },
  LogModel: { write: vi.fn() },
  UserLookup: { get: vi.fn() },
  catToDb: (c: string) => c.toUpperCase(),
}));
vi.mock('../../../../src/modules/message/providers/smtp.js', () => ({ sendMail: vi.fn() }));
vi.mock('../../../../src/modules/message/providers/expo.js', () => ({ sendPush: vi.fn().mockResolvedValue({ sent: 1, invalidTokens: [] }) }));

const M = await import('../../../../src/modules/message/models/message.models.js');
const { sendMail } = await import('../../../../src/modules/message/providers/smtp.js');
const { sendPush } = await import('../../../../src/modules/message/providers/expo.js');
const { processEvent } = await import('../../../../src/modules/message/services/notify.service.js');

const prefs = { venc: true, orc: true, meta: true, inv: true, leadDays: 3, quietEnabled: false, quietStart: 22, quietEnd: 7, pushEnabled: true, emailEnabled: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(M.UserLookup.get).mockResolvedValue({ id: 'u1', name: 'Ana', email: 'a@a.com', deleted: false, timezone: 'America/Sao_Paulo' });
  vi.mocked(M.PreferenceModel.get).mockResolvedValue(prefs as never);
  vi.mocked(M.DeviceModel.tokensOf).mockResolvedValue(['ExponentPushToken[abc]']);
  vi.mocked(M.NotificationModel.create).mockResolvedValue({} as never); // clearAllMocks não restaura implementações
});

describe('processEvent', () => {
  it('alerta ligado: cria in-app e envia push', async () => {
    await processEvent(ev('invoice.due_soon', { card: 'Nubank', amount: 10, days: 3 }));
    expect(M.NotificationModel.create).toHaveBeenCalledOnce();
    expect(sendPush).toHaveBeenCalledOnce();
  });

  it('categoria desligada: não cria nada', async () => {
    vi.mocked(M.PreferenceModel.get).mockResolvedValue({ ...prefs, venc: false } as never);
    await processEvent(ev('invoice.due_soon', { card: 'Nubank', amount: 10, days: 3 }));
    expect(M.NotificationModel.create).not.toHaveBeenCalled();
  });

  it('evento duplicado (unique) é ignorado sem erro e sem push', async () => {
    vi.mocked(M.NotificationModel.create).mockRejectedValue({ code: 'P2002' });
    await expect(processEvent(ev('goal.reached', { goal: 'Viagem' }))).resolves.toBeUndefined();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('horário silencioso: mantém o in-app e descarta o push', async () => {
    vi.mocked(M.PreferenceModel.get).mockResolvedValue({ ...prefs, quietEnabled: true, quietStart: 0, quietEnd: 23 } as never);
    vi.useFakeTimers({ now: new Date('2026-11-14T15:00:00Z') });
    await processEvent(ev('goal.reached', { goal: 'Viagem' }));
    vi.useRealTimers();
    expect(M.NotificationModel.create).toHaveBeenCalledOnce();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('e-mail só quando ligado nas preferências', async () => {
    await processEvent(ev('goal.reached', { goal: 'Viagem' }));
    expect(sendMail).not.toHaveBeenCalled();
    vi.mocked(M.PreferenceModel.get).mockResolvedValue({ ...prefs, emailEnabled: true } as never);
    await processEvent(ev('goal.reached', { goal: 'Viagem 2' }));
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it('e-mail transacional é enviado mesmo com tudo desligado e falha de SMTP repassa o erro (retry)', async () => {
    vi.mocked(M.PreferenceModel.get).mockResolvedValue({ ...prefs, venc: false, emailEnabled: false } as never);
    await processEvent(ev('user.registered', { name: 'Ana', verifyToken: 'tok-verify-123' }));
    expect(sendMail).toHaveBeenCalledOnce();
    vi.mocked(sendMail).mockRejectedValueOnce(new Error('smtp fora'));
    await expect(processEvent(ev('user.registered', { name: 'Ana', verifyToken: 'tok-verify-456' }))).rejects.toThrow('smtp fora');
  });

  it('tipo desconhecido é ignorado', async () => {
    await processEvent({ ...ev('goal.reached'), type: 'nao.existe' as never });
    expect(M.NotificationModel.create).not.toHaveBeenCalled();
  });
});
