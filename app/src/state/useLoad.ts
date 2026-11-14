import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { errorMessage } from './session';

/** Carrega dados da API sempre que a tela ganha foco; `reload` refaz a chamada depois de uma ação. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => { try { setData(await fn()); setError(''); } catch (e) { setError(errorMessage(e)); } }, deps);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { data, error, reload };
}
