import { useState } from 'react';
import { router } from 'expo-router';
import { authApi } from '@/api/auth';
import { Btn, Field, Notice, Screen, T, useP } from '@/ui/kit';
import { errorMessage } from '@/state/session';

export default function EsqueciSenha() {
  const p = useP();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const enviar = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErro('Informe um e-mail válido.');
    setErro('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setEnviado(true);
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Acesso" title="Recuperar senha" back>
      <T s={14} c={p.sub}>Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.</T>
      <Field label="E-mail" value={email} onChange={setEmail} placeholder="voce@email.com" keyboard="email-address" />
      {enviado && <Notice>Se houver uma conta com esse e-mail, o link chega em instantes.</Notice>}
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      <Btn onPress={loading ? undefined : enviar}>{loading ? 'Enviando...' : 'Enviar link'}</Btn>
      {enviado && <Btn kind="ghost" onPress={() => router.push('/redefinir-senha')}>Já tenho o código</Btn>}
      <Btn kind="ghost" onPress={() => router.back()}>Voltar ao login</Btn>
    </Screen>
  );
}
