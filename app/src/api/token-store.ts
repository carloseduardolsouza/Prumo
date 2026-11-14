import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'prumo.tokens';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

// Nativo: Keychain/Keystore via SecureStore. Web (só desenvolvimento): localStorage.
async function read(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(KEY);
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

async function write(value: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') return value === null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, value);
    if (value === null) await SecureStore.deleteItemAsync(KEY);
    else await SecureStore.setItemAsync(KEY, value);
  } catch {
    /* sem armazenamento: a sessão só dura enquanto o app estiver aberto */
  }
}

let cache: Tokens | null | undefined;

export const tokenStore = {
  async get(): Promise<Tokens | null> {
    if (cache !== undefined) return cache;
    const raw = await read();
    cache = raw ? (JSON.parse(raw) as Tokens) : null;
    return cache;
  },
  async set(tokens: Tokens): Promise<void> {
    cache = tokens;
    await write(JSON.stringify(tokens));
  },
  async clear(): Promise<void> {
    cache = null;
    await write(null);
  },
};
