import { environment } from '@/config';
import { tokenStore } from './token-store';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Service = 'core' | 'message';
const baseUrl = (s: Service) => (s === 'core' ? environment.coreUrl : environment.messageUrl);

interface Options {
  body?: unknown;
  /** false para rotas públicas (login, registro...). */
  auth?: boolean;
  service?: Service;
  /** true: devolve o corpo como texto (CSV) em vez de JSON. */
  raw?: boolean;
  headers?: Record<string, string>;
}

let onSessionExpired: (() => void) | undefined;
/** O SessionProvider registra aqui o que fazer quando o refresh falha (voltar ao login). */
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

async function send(service: Service, method: string, path: string, opts: Options, accessToken?: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  try {
    return await fetch(baseUrl(service) + path, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
  }
}

// Várias chamadas simultâneas com o token vencido compartilham UM refresh (o refresh é rotativo).
let refreshing: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const current = await tokenStore.get();
      if (!current) return false;
      const res = await send('core', 'POST', '/auth/refresh', { body: { refreshToken: current.refreshToken } });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      await tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data?.code ?? 'ERROR', data?.error ?? 'Erro inesperado', data?.details);
  return data as T;
}

export async function api<T = void>(method: string, path: string, opts: Options = {}): Promise<T> {
  const service = opts.service ?? 'core';
  const withAuth = opts.auth !== false;

  let tokens = withAuth ? await tokenStore.get() : null;
  if (withAuth && !tokens) throw new ApiError(401, 'UNAUTHORIZED', 'Faça login para continuar');

  let res = await send(service, method, path, opts, tokens?.accessToken);
  if (withAuth && res.status === 401) {
    if (await refreshTokens()) {
      tokens = await tokenStore.get();
      res = await send(service, method, path, opts, tokens?.accessToken);
    }
    if (res.status === 401) {
      await tokenStore.clear();
      onSessionExpired?.();
    }
  }
  if (opts.raw && res.ok) return (await res.text()) as T;
  return parse<T>(res);
}

export const get = <T>(path: string, opts?: Options) => api<T>('GET', path, opts);
export const post = <T = void>(path: string, body?: unknown, opts?: Options) => api<T>('POST', path, { ...opts, body });
export const put = <T>(path: string, body?: unknown, opts?: Options) => api<T>('PUT', path, { ...opts, body });
export const patch = <T>(path: string, body?: unknown, opts?: Options) => api<T>('PATCH', path, { ...opts, body });
export const del = <T = void>(path: string, opts?: Options) => api<T>('DELETE', path, opts);
