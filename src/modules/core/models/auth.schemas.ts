import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '../../../shared/auth/password.js';

const email = z.string().trim().toLowerCase().email('E-mail inválido').max(254);
const password = z.string().min(MIN_PASSWORD_LENGTH, `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres`).max(128);
const token = z.string().min(16).max(256);
const deviceName = z.string().trim().max(80).optional();

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(80),
  email,
  password,
  deviceName,
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(128), deviceName });
export const refreshSchema = z.object({ refreshToken: z.string().min(10).max(300) });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ token, password });
export const verifyEmailSchema = z.object({ token });

export const patchMeSchema = z
  .object({ name: z.string().trim().min(2).max(80), email })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo');
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });
export const passwordConfirmSchema = z.object({ password: z.string().min(1).max(128) });
export const sessionIdParamSchema = z.object({ id: z.string().uuid() });

export const preferencesSchema = z
  .object({
    currency: z.enum(['BRL', 'USD', 'EUR']),
    dateFormat: z.enum(['dd/mm/aaaa', 'mm/dd/aaaa', 'aaaa-mm-dd']),
    timezone: z.string().min(3).max(60),
    firstDayOfWeek: z.union([z.literal(0), z.literal(1)]),
    theme: z.enum(['escuro', 'claro', 'auto']),
    hideValuesOnOpen: z.boolean(),
    hideInBackground: z.boolean(),
    biometricLock: z.boolean(),
    balanceWidget: z.boolean(),
    analyticsOptIn: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos uma preferência');

export type RegisterInput = z.infer<typeof registerSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
