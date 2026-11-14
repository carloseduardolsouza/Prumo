import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, setSessionExpiredHandler } from '@/api/client';
import { authApi, meApi, type Preferences, type User } from '@/api/auth';
import { tokenStore } from '@/api/token-store';
import { useMode } from '@/ui/themeMode';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface SessionValue {
  status: Status;
  user: User | null;
  prefs: Preferences | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
  /** Salva no servidor; a tela já reflete a mudança (otimista) e volta atrás se a API recusar. */
  updatePrefs: (patch: Partial<Preferences>) => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession fora do SessionProvider');
  return v;
}

/** Mensagem amigável para qualquer erro vindo da API. */
export const errorMessage = (e: unknown): string => (e instanceof ApiError ? e.message : 'Algo deu errado. Tente novamente.');

export function SessionProvider({ children }: { children: ReactNode }) {
  const { setMode } = useMode();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);

  const load = useCallback(
    async (known?: User) => {
      const [u, p] = await Promise.all([known ? Promise.resolve(known) : meApi.get(), meApi.preferences()]);
      setUser(u);
      setPrefs(p);
      setMode(p.theme);
      setStatus('authenticated');
    },
    [setMode],
  );

  const reset = useCallback(() => {
    setUser(null);
    setPrefs(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(reset);
    (async () => {
      try {
        if (!(await tokenStore.get())) return reset();
        await load();
      } catch {
        reset();
      }
    })();
  }, [load, reset]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      prefs,
      signIn: async (email, password) => load(await authApi.login(email, password)),
      signUp: async (name, email, password) => load(await authApi.register(name, email, password)),
      signOut: async () => {
        await authApi.logout().catch(() => undefined);
        reset();
      },
      setUser,
      updatePrefs: async (patch) => {
        const before = prefs;
        setPrefs((p) => (p ? { ...p, ...patch } : p));
        if (patch.theme) setMode(patch.theme);
        try {
          setPrefs(await meApi.updatePreferences(patch));
        } catch (e) {
          setPrefs(before);
          if (before && patch.theme) setMode(before.theme);
          throw e;
        }
      },
    }),
    [status, user, prefs, load, reset, setMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
