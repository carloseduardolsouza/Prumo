import { Router } from 'express';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { requireAuth } from '../../../shared/middleware/auth.js';
import { validate } from '../../../shared/middleware/validate.js';
import { MeController } from '../controllers/me.controller.js';
import { changePasswordSchema, passwordConfirmSchema, patchMeSchema, preferencesSchema, sessionIdParamSchema } from '../models/auth.schemas.js';

const router = Router();

router.use(requireAuth); // tudo em /me exige usuário autenticado

router.get('/', h(MeController['get']!));
router.patch('/', validate({ body: patchMeSchema }), h(MeController['patch']!));

router.get('/preferences', h(MeController['getPreferences']!));
router.put('/preferences', validate({ body: preferencesSchema }), h(MeController['putPreferences']!));

router.post('/password', validate({ body: changePasswordSchema }), h(MeController['changePassword']!));

router.get('/sessions', h(MeController['listSessions']!));
router.delete('/sessions', h(MeController['revokeOtherSessions']!));
router.delete('/sessions/:id', validate({ params: sessionIdParamSchema }), h(MeController['revokeSession']!));

router.post('/deletion-request', validate({ body: passwordConfirmSchema }), h(MeController['requestDeletion']!));
router.delete('/deletion-request', h(MeController['cancelDeletion']!));

router.get('/data-export', h(MeController['exportData']!));

export default router;
