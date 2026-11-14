import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../../shared/config/env.js';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { requireAuth } from '../../../shared/middleware/auth.js';
import { validate } from '../../../shared/middleware/validate.js';
import { AuthController } from '../controllers/auth.controller.js';
import { forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from '../models/auth.schemas.js';

// Freio contra tentativa em massa de senha (RNF007). Desligado nos testes.
const limiter = (max: number) =>
  rateLimit({
    windowMs: 15 * 60_000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { error: 'Muitas tentativas. Aguarde alguns minutos.', code: 'RATE_LIMITED' },
  });

const router = Router();


router.post('/register', limiter(20), validate({ body: registerSchema }), h(AuthController['register']!));
router.post('/login', limiter(20), validate({ body: loginSchema }), h(AuthController['login']!));
router.post('/refresh', limiter(60), validate({ body: refreshSchema }), h(AuthController['refresh']!));
router.post('/logout', requireAuth, h(AuthController['logout']!));
router.post('/forgot-password', limiter(10), validate({ body: forgotPasswordSchema }), h(AuthController['forgotPassword']!));
router.post('/reset-password', limiter(10), validate({ body: resetPasswordSchema }), h(AuthController['resetPassword']!));
router.post('/verify-email', validate({ body: verifyEmailSchema }), h(AuthController['verifyEmail']!));
router.post('/resend-verification', requireAuth, limiter(5), h(AuthController['resendVerification']!));

export default router;
