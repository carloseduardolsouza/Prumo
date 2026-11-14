import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { env } from '../../../shared/config/env.js';

const expo = new Expo(env.EXPO_ACCESS_TOKEN ? { accessToken: env.EXPO_ACCESS_TOKEN } : {});

export interface PushResult {
  sent: number;
  /** Tokens que o Expo declarou inválidos (app desinstalado etc.) e devem ser removidos. */
  invalidTokens: string[];
}

export async function sendPush(tokens: string[], message: { title: string; body: string; data?: Record<string, unknown> }): Promise<PushResult> {
  const valid = tokens.filter((t) => Expo.isExpoPushToken(t));
  const invalidTokens: string[] = tokens.filter((t) => !Expo.isExpoPushToken(t));
  const messages: ExpoPushMessage[] = valid.map((to) => ({ to, sound: 'default', title: message.title, body: message.body, data: message.data ?? {} }));

  let sent = 0;
  for (const chunk of expo.chunkPushNotifications(messages)) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    tickets.forEach((t, i) => {
      if (t.status === 'ok') sent++;
      else if (t.details?.error === 'DeviceNotRegistered') (invalidTokens as string[]).push(String(chunk[i]?.to));
    });
  }
  return { sent, invalidTokens };
}
