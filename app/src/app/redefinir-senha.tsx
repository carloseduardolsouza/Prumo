import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { authApi } from '@/api/auth';
import { Btn, Field, Notice, Screen } from '@/ui/kit';
import { errorMessage } from '@/state/session';

// Abre pelo link do e-mail (prumo://redefinir-senha?token=...) ou com o código colado à mão.
export default function RedefinirSenha() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const salvar = async () => {
    if (token.trim().length < 16) return setErro('Cole o código recebido por e-mail.');
    if (senha.length < 8) return setErro('A senha precisa ter ao menos 8 caracteres.');
    if (senha !== conf) return setErro('As senhas não coincidem.');
    setErro('');
    setLoading(true);
    try {
      await authApi.resetPassword(token.trim(), senha);
      setOk(true);
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Acesso" title="Nova senha" back>
      <Field label="Código do e-mail" value={token} onChange={setToken} placeholder="Cole aqui" />
      <Field label="Nova senha" value={senha} onChange={setSenha} secure placeholder="Mínimo de 8 caracteres" />
      <Field label="Confirmar nova senha" value={conf} onChange={setConf} secure />
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      {ok ? <Notice>Senha redefinida. Entre com a nova senha.</Notice> : null}
      {ok ? <Btn onPress={() => router.replace('/')}>Ir para o login</Btn> : <Btn onPress={loading ? undefined : salvar}>{loading ? 'Salvando...' : 'Redefinir senha'}</Btn>}
    </Screen>
  );
}
