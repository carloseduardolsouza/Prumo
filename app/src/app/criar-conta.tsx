import { useState } from 'react';
import { Btn, Field, Notice, Screen, SwitchRow } from '@/ui/kit';
import { errorMessage, useSession } from '@/state/session';

export default function CriarConta() {
  const { signUp } = useSession();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const criar = async () => {
    if (nome.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return setErro('Informe nome e um e-mail válido.');
    if (senha.length < 8) return setErro('A senha precisa ter ao menos 8 caracteres.');
    if (senha !== conf) return setErro('As senhas não coincidem.');
    if (!aceito) return setErro('Aceite os termos de uso e a política de privacidade.');
    setErro('');
    setLoading(true);
    try {
      await signUp(nome.trim(), email.trim().toLowerCase(), senha); // autenticado: a raiz redireciona para o app
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen eyebrow="Conta pessoal" title="Criar conta" back>
      <Field label="Nome" value={nome} onChange={setNome} placeholder="Como quer ser chamado" />
      <Field label="E-mail" value={email} onChange={setEmail} placeholder="voce@email.com" keyboard="email-address" hint="Enviaremos um link para validar o e-mail." />
      <Field label="Senha" value={senha} onChange={setSenha} secure placeholder="Mínimo de 8 caracteres" />
      <Field label="Confirmar senha" value={conf} onChange={setConf} secure />
      <SwitchRow title="Li e aceito os termos de uso e a política de privacidade" value={aceito} onChange={setAceito} />
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      <Btn onPress={loading ? undefined : criar}>{loading ? 'Criando...' : 'Criar conta'}</Btn>
    </Screen>
  );
}
