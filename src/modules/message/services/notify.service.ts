import { EVENT_TYPES, type DomainEvent } from '../../../shared/events.js';
import { createLogger } from '../../../shared/logger.js';
import { sendMail } from '../providers/smtp.js';
import { sendPush } from '../providers/expo.js';
import { DeviceModel, LogModel, NotificationModel, PreferenceModel, UserLookup, catToDb } from '../models/message.models.js';
import { categoryOf, inAppContent, notificationMail, transactionalMail } from './templates.js';
import { isQuietHour } from './quiet-hours.js';

const log = createLogger('message');

/** Código de erro do Prisma para violação de unicidade (mesmo evento entregue duas vezes). */
const isDuplicate = (e: unknown) => (e as { code?: string })?.code === 'P2002';

/** E-mails transacionais da conta: sempre enviados, independem das preferências de alerta. */
async function handleTransactional(event: DomainEvent): Promise<void> {
  const user = await UserLookup.get(event.userId);
  if (!user || user.deleted) return void (await LogModel.write(event.userId, 'email', event.type, 'skipped', 'usuário inexistente'));
  const mail = transactionalMail(event, user.email);
  if (!mail) return;
  try {
    await sendMail(mail);
    await LogModel.write(user.id, 'email', event.type, 'sent');
  } catch (e) {
    await LogModel.write(user.id, 'email', event.type, 'failed', (e as Error).message);
    throw e; // o BullMQ tenta de novo com backoff
  }
}

/** Alertas: in-app sempre (se a categoria estiver ligada), push e e-mail conforme preferências e horário silencioso. */
async function handleAlert(event: DomainEvent): Promise<void> {
  const category = categoryOf(event.type);
  const content = inAppContent(event);
  if (!category || !content) return void (await LogModel.write(event.userId, 'in_app', event.type, 'skipped', 'evento sem notificação'));

  const [user, prefs] = await Promise.all([UserLookup.get(event.userId), PreferenceModel.get(event.userId)]);
  if (!user || user.deleted) return;
  if (!prefs[category]) return void (await LogModel.write(user.id, 'in_app', event.type, 'skipped', `categoria ${category} desligada`));

  try {
    await NotificationModel.create({ userId: user.id, type: event.type, category: catToDb(category), ...content, dedupeKey: event.dedupeKey, data: event.payload });
  } catch (e) {
    if (isDuplicate(e)) return void log.info('evento duplicado ignorado', { dedupeKey: event.dedupeKey });
    throw e;
  }
  await LogModel.write(user.id, 'in_app', event.type, 'sent');

  const quiet = isQuietHour(new Date(), user.timezone, prefs);
  if (prefs.pushEnabled && !quiet) {
    const tokens = await DeviceModel.tokensOf(user.id);
    if (tokens.length) {
      try {
        const r = await sendPush(tokens, { title: content.title, body: content.body, data: { href: content.href } });
        if (r.invalidTokens.length) await DeviceModel.removeTokens(r.invalidTokens);
        await LogModel.write(user.id, 'push', event.type, 'sent', `${r.sent} enviados`);
      } catch (e) {
        await LogModel.write(user.id, 'push', event.type, 'failed', (e as Error).message); // push é best-effort
      }
    }
  } else if (prefs.pushEnabled && quiet) {
    // shortcut: no horário silencioso o push é descartado (a notificação in-app continua); reagendar para o fim da janela fica para a E10.
    await LogModel.write(user.id, 'push', event.type, 'skipped', 'horário silencioso');
  }

  if (prefs.emailEnabled) {
    try {
      await sendMail(notificationMail(content, user.email));
      await LogModel.write(user.id, 'email', event.type, 'sent');
    } catch (e) {
      await LogModel.write(user.id, 'email', event.type, 'failed', (e as Error).message);
    }
  }
}

export async function processEvent(event: DomainEvent): Promise<void> {
  if (!(EVENT_TYPES as readonly string[]).includes(event.type)) return void log.warn('evento desconhecido', { type: event.type });
  if (event.type === 'user.registered' || event.type === 'user.password_reset_requested') return handleTransactional(event);
  return handleAlert(event);
}
