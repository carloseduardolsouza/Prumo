import { useState } from 'react';
import { Pressable } from 'react-native';
import { meApi } from '@/api/auth';
import { Btn, Card, Field, Notice, Screen, T, useP } from '@/ui/kit';
import { errorMessage, useSession } from '@/state/session';

export default function Dados() {
  const p = useP();
  const { user, setUser } = useSession();
  const [nome, setNome] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [senha, setSenha] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const pedido = user?.status === 'DELETION_REQUESTED';

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, t: errorMessage(e) });
    }
  };

  const salvar = () =>
    run(async () => {
      const patch: { name?: string; email?: string } = {};
      if (nome.trim() !== user?.name) patch.name = nome.trim();
      if (email.trim().toLowerCase() !== user?.email) patch.email = email.trim().toLowerCase();
      if (!Object.keys(patch).length) return setMsg({ ok: true, t: 'Nada para alterar.' });
      const u = await meApi.update(patch);
      setUser(u);
      setMsg({ ok: true, t: patch.email ? 'Dados atualizados. Enviaremos um novo link para validar o e-mail.' : 'Dados atualizados.' });
    });

  const excluir = () =>
    run(async () => {
      setUser(await meApi.requestDeletion(senha));
      setSenha('');
      setConfirmando(false);
      setMsg({ ok: false, t: 'Pedido de exclusão registrado. Você pode cancelar enquanto não for concluído.' });
    });

  const cancelar = () =>
    run(async () => {
      setUser(await meApi.cancelDeletion());
      setMsg({ ok: true, t: 'Pedido de exclusão cancelado.' });
    });

  return (
    <Screen eyebrow="Conta" title="Dados pessoais" back>
      <Field label="Nome de exibição" value={nome} onChange={setNome} />
      <Field label="E-mail" value={email} onChange={setEmail} keyboard="email-address" hint={user?.emailVerified ? 'E-mail verificado.' : 'E-mail ainda não verificado. Alterar o e-mail exige nova validação.'} />
      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}
      <Btn onPress={salvar}>Salvar alterações</Btn>

      <Card style={{ gap: 10 }}>
        <T s={15} w="700">Excluir conta</T>
        <T s={12} c={p.sub}>Apaga seus dados, respeitadas as obrigações legais de retenção. Esta ação não pode ser desfeita.</T>
        {pedido ? (
          <Pressable onPress={cancelar} style={{ minHeight: 44, justifyContent: 'center' }}><T s={14} w="800" c={p.link}>Cancelar pedido de exclusão</T></Pressable>
        ) : confirmando ? (
          <>
            <Field label="Confirme sua senha" value={senha} onChange={setSenha} secure />
            <Btn onPress={senha ? excluir : undefined}>Confirmar exclusão</Btn>
            <Pressable onPress={() => setConfirmando(false)} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="700" c={p.sub}>Voltar</T></Pressable>
          </>
        ) : (
          <Pressable onPress={() => setConfirmando(true)} style={{ minHeight: 44, justifyContent: 'center' }}><T s={14} w="800" c={p.red}>Solicitar exclusão da conta</T></Pressable>
        )}
      </Card>
    </Screen>
  );
}
