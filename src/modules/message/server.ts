import { env } from '../../shared/config/env.js';
import { createApp, listen } from '../../shared/http/create-app.js';
import router from './routes/index.js';
import { startNotificationsWorker } from './workers/notifications.worker.js';

const app = createApp({ service: 'message', prefix: '/message/v1', router });
listen(app, 'message', env.PORT_MESSAGE);
startNotificationsWorker();

export default app;
