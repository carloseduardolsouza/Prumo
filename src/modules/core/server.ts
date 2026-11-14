import { env } from '../../shared/config/env.js';
import { createApp, listen } from '../../shared/http/create-app.js';
import { startJobs } from './jobs/reminders.job.js';
import router from './routes/index.js';

const app = createApp({ service: 'core', prefix: '/api/v1', router });
listen(app, 'core', env.PORT_CORE);
if (env.JOBS_ENABLED) startJobs();

export default app;
