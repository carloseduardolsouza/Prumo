import { useState } from 'react';
import { meApi } from '@/api/auth';
import { Btn, Card, Field, Label, Notice, Screen, SwitchRow, T, useP } from '@/ui/kit';
import { errorMessage, useSession } from '@/state/session';

export default function Seguranca() {
  const p = useP();
  const { prefs, updatePrefs } = useSession();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const trocar = async () => {
    if (!atual) return setMsg({ ok: false, t: 'Informe a senha atual.' });
    if (nova.length < 8) return setMsg({ ok: false, t: 'A nova senha precisa ter ao menos 8 caracteres.' });
    if (nova !== conf) return setMsg({ ok: false, t: 'As senhas não coincidem.' });
    try {
      await meApi.changePassword(atual, nova);
      setAtual(''); setNova(''); setConf('');
      setMsg({ ok: true, t: 'Senha alterada. Os outros dispositivos foram desconectados.' });
    } catch (e) {
      setMsg({ ok: false, t: errorMessage(e) });
    }
  };

  return (
    <Screen eyebrow="Conta" title="Segurança" back>
      <Card style={{ gap: 14 }}>
        <Label>Alterar senha</Label>
        <Field label="Senha atual" value={atual} onChange={setAtual} secure />
        <Field label="Nova senha" value={nova} onChange={setNova} secure />
        <Field label="Confirmar nova senha" value={conf} onChange={setConf} secure />
        {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}
        <Btn onPress={trocar}>Alterar senha</Btn>
      </Card>
      <Card>
        <SwitchRow title="Bloqueio por biometria" sub="Pede digital ou rosto ao abrir o app" value={prefs?.biometricLock ?? false} onChange={(v) => updatePrefs({ biometricLock: v }).catch(() => undefined)} />
        <T s={11} c={p.mute}>A verificação em duas etapas chega em uma versão futura.</T>
      </Card>
    </Screen>
  );
}
