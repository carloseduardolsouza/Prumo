import { Router } from 'express';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { requireAuth } from '../../../shared/middleware/auth.js';
import { requireInternalKey } from '../../../shared/middleware/internal-key.js';
import { validate } from '../../../shared/middleware/validate.js';
import { DeviceController, InternalController, NotificationController, PreferenceController } from '../controllers/message.controller.js';
import { deviceSchema, idParamSchema, internalEventSchema, listQuerySchema, preferencesSchema, tokenParamSchema } from '../models/message.models.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ name: 'prumo-message', version: '0.2.0' });
});

// Rotas internas entre serviços (sem JWT; chave compartilhada).
router.post('/internal/events', requireInternalKey, validate({ body: internalEventSchema }), h(InternalController['publish']!));

// Rotas do usuário.
router.use(requireAuth);
router.get('/notifications', validate({ query: listQuerySchema }), h(NotificationController['list']!));
router.get('/notifications/unread-count', h(NotificationController['unreadCount']!));
router.post('/notifications/read-all', h(NotificationController['markAllRead']!));
router.patch('/notifications/:id/read', validate({ params: idParamSchema }), h(NotificationController['markRead']!));

router.get('/preferences', h(PreferenceController['get']!));
router.put('/preferences', validate({ body: preferencesSchema }), h(PreferenceController['put']!));

router.post('/devices', validate({ body: deviceSchema }), h(DeviceController['register']!));
router.delete('/devices/:token', validate({ params: tokenParamSchema }), h(DeviceController['remove']!));

export default router;
