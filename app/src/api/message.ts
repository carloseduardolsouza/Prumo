import { del, get, patch, post, put } from './client';

export type NotificationCategory = 'venc' | 'orc' | 'meta' | 'inv';

export interface AppNotification {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  venc: boolean;
  orc: boolean;
  meta: boolean;
  inv: boolean;
  leadDays: number;
  quietEnabled: boolean;
  quietStart: number;
  quietEnd: number;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

const svc = { service: 'message' as const };

export const messageApi = {
  list: (category?: NotificationCategory) =>
    get<{ notifications: AppNotification[]; total: number; unread: number }>(`/notifications?limit=50${category ? `&category=${category}` : ''}`, svc),
  unreadCount: async () => (await get<{ unread: number }>('/notifications/unread-count', svc)).unread,
  markRead: (id: string) => patch(`/notifications/${id}/read`, undefined, svc),
  markAllRead: () => post('/notifications/read-all', undefined, svc),
  preferences: async () => (await get<{ preferences: NotificationPrefs }>('/preferences', svc)).preferences,
  updatePreferences: async (p: Partial<NotificationPrefs>) => (await put<{ preferences: NotificationPrefs }>('/preferences', p, svc)).preferences,
  registerDevice: (token: string, platform: 'ios' | 'android' | 'web') => post('/devices', { token, platform }, svc),
  removeDevice: (token: string) => del(`/devices/${encodeURIComponent(token)}`, svc),
};
