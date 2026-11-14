import { Worker } from 'bullmq';
import { createLogger } from '../../../shared/logger.js';
import { QUEUES, QUEUE_PREFIX } from '../../../shared/queue.js';
import { createRedis } from '../../../shared/redis.js';
import type { DomainEvent } from '../../../shared/events.js';
import { processEvent } from '../services/notify.service.js';

const log = createLogger('message');

/** Consome a fila "notifications" publicada pelo core. */
export function startNotificationsWorker(): Worker {
  const worker = new Worker<DomainEvent>(QUEUES.notifications, (job) => processEvent(job.data), {
    connection: createRedis(),
    prefix: QUEUE_PREFIX,
    concurrency: 5,
  });
  worker.on('completed', (job) => log.info('evento processado', { type: job.data.type, userId: job.data.userId }));
  worker.on('failed', (job, err) => log.warn('falha ao processar evento', { type: job?.data?.type, attempt: job?.attemptsMade, message: err.message }));
  worker.on('error', (err) => log.warn('worker com erro', { message: err.message }));
  return worker;
}
