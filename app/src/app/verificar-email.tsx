import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { authApi } from '@/api/auth';
import { Btn, Notice, Screen, useP } from '@/ui/kit';
import { errorMessage, useSession } from '@/state/session';

// Abre pelo link do e-mail (prumo://verificar-email?token=...).
export default function VerificarEmail() {
  const p = useP();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { status, setUser } = useSession();
  const [state, setState] = useState<'loading' | 'ok' | 'erro'>('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('erro');
      setMsg('Link inválido.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then(({ user }) => {
        if (status === 'authenticated') setUser(user);
        setState('ok');
      })
      .catch((e) => {
        setState('erro');
        setMsg(errorMessage(e));
      });
    // roda uma vez por token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Screen eyebrow="Conta" title="Verificar e-mail">
      {state === 'loading' && <ActivityIndicator color={p.accent} />}
      {state === 'ok' && <Notice>E-mail verificado. Obrigado!</Notice>}
      {state === 'erro' && <Notice kind="err">{msg}</Notice>}
      {state !== 'loading' && <Btn onPress={() => router.replace(status === 'authenticated' ? '/inicio' : '/')}>Continuar</Btn>}
    </Screen>
  );
}
