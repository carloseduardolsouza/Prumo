import type { ThemeMode, UserPreference } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import type { PreferencesInput } from './auth.schemas.js';

const themeToDb: Record<'escuro' | 'claro' | 'auto', ThemeMode> = { escuro: 'ESCURO', claro: 'CLARO', auto: 'AUTO' };
const themeFromDb: Record<ThemeMode, 'escuro' | 'claro' | 'auto'> = { ESCURO: 'escuro', CLARO: 'claro', AUTO: 'auto' };

export const toPublicPreferences = (p: UserPreference) => ({
  currency: p.currency,
  dateFormat: p.dateFormat,
  timezone: p.timezone,
  firstDayOfWeek: p.firstDayOfWeek,
  theme: themeFromDb[p.theme],
  hideValuesOnOpen: p.hideValuesOnOpen,
  hideInBackground: p.hideInBackground,
  biometricLock: p.biometricLock,
  balanceWidget: p.balanceWidget,
  analyticsOptIn: p.analyticsOptIn,
});

export const PreferenceModel = {
  /** Garante a linha (contas antigas) e devolve. */
  get: (userId: string) => prisma.userPreference.upsert({ where: { userId }, update: {}, create: { userId } }),
  update: (userId: string, input: PreferencesInput) => {
    const { theme, ...rest } = input;
    const data = { ...rest, ...(theme ? { theme: themeToDb[theme] } : {}) };
    return prisma.userPreference.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  },
};
