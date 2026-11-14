import { createLogger } from './logger.js';
import { publishEvent } from './queue.js';
import type { DomainEvent, EventType } from './events.js';

const log = createLogger('events');

/** Publica sem derrubar a operação principal: se o Redis estiver fora, só registra o aviso. */
export async function emit(type: EventType, userId: string, dedupeKey: string, payload: Record<string, unknown> = {}): Promise<void> {
  const event: DomainEvent = { type, userId, dedupeKey, payload, occurredAt: new Date().toISOString() };
  try {
    await publishEvent(event);
  } catch (e) {
    log.warn('falha ao publicar evento', { type, userId, message: (e as Error).message });
  }
}
