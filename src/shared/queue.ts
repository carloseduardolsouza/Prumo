import { Queue, type JobsOptions } from 'bullmq';
import { createRedis } from './redis.js';
import type { DomainEvent } from './events.js';

export const QUEUES = { notifications: 'notifications' } as const;
// O Redis do WSL é compartilhado com outros projetos; o prefixo isola as filas do Prumo.
export const QUEUE_PREFIX = 'prumo';

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

let notificationsQueue: Queue | undefined;

export function getNotificationsQueue(): Queue {
  notificationsQueue ??= new Queue(QUEUES.notifications, { connection: createRedis(), prefix: QUEUE_PREFIX, defaultJobOptions });
  return notificationsQueue;
}

/** jobId derivado do dedupeKey: o BullMQ ignora um segundo job com o mesmo id (idempotência, RNF027). O BullMQ não aceita ":" em ids. */
export const jobIdFor = (dedupeKey: string): string => dedupeKey.replace(/:/g, "__");

export async function publishEvent(event: DomainEvent): Promise<void> {
  await getNotificationsQueue().add(event.type, event, { jobId: jobIdFor(event.dedupeKey) });
}
