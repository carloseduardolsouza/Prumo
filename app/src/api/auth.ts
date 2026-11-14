import { Platform } from 'react-native';
import { del, get, patch, post, put } from './client';
import { tokenStore } from './token-store';

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  status: 'PENDING_EMAIL' | 'ACTIVE' | 'DELETION_REQUESTED' | 'DELETED';
  deletionRequestedAt: string | null;
  createdAt: string;
}

export type ThemePref = 'escuro' | 'claro' | 'auto';

export interface Preferences {
  currency: 'BRL' | 'USD' | 'EUR';
  dateFormat: 'dd/mm/aaaa' | 'mm/dd/aaaa' | 'aaaa-mm-dd';
  timezone: string;
  firstDayOfWeek: 0 | 1;
  theme: ThemePref;
  hideValuesOnOpen: boolean;
  hideInBackground: boolean;
  biometricLock: boolean;
  balanceWidget: boolean;
  analyticsOptIn: boolean;
}

export interface SessionInfo {
  id: string;
  deviceName: string;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

const deviceName = `Prumo · ${Platform.OS}`;

async function startFrom(res: AuthResponse): Promise<User> {
  await tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  return res.user;
}

export const authApi = {
  register: async (name: string, email: string, password: string) =>
    startFrom(await post<AuthResponse>('/auth/register', { name, email, password, deviceName }, { auth: false })),
  login: async (email: string, password: string) => startFrom(await post<AuthResponse>('/auth/login', { email, password, deviceName }, { auth: false })),
  logout: async () => {
    try {
      await post('/auth/logout');
    } finally {
      await tokenStore.clear();
    }
  },
  forgotPassword: (email: string) => post('/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (token: string, password: string) => post('/auth/reset-password', { token, password }, { auth: false }),
  verifyEmail: (token: string) => post<{ user: User }>('/auth/verify-email', { token }, { auth: false }),
  resendVerification: () => post('/auth/resend-verification'),
};

export const meApi = {
  get: async () => (await get<{ user: User }>('/me')).user,
  update: async (patchBody: { name?: string; email?: string }) => (await patch<{ user: User }>('/me', patchBody)).user,
  preferences: async () => (await get<{ preferences: Preferences }>('/me/preferences')).preferences,
  updatePreferences: async (p: Partial<Preferences>) => (await put<{ preferences: Preferences }>('/me/preferences', p)).preferences,
  changePassword: (currentPassword: string, newPassword: string) => post('/me/password', { currentPassword, newPassword }),
  sessions: async () => (await get<{ sessions: SessionInfo[] }>('/me/sessions')).sessions,
  revokeSession: (id: string) => del(`/me/sessions/${id}`),
  revokeOtherSessions: () => del('/me/sessions'),
  requestDeletion: async (password: string) => (await post<{ user: User }>('/me/deletion-request', { password })).user,
  cancelDeletion: async () => (await del<{ user: User }>('/me/deletion-request')).user,
  exportData: () => get<Record<string, unknown>>('/me/data-export'),
};
