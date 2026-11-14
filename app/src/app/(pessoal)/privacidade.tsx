import { useState } from 'react';
import { Share } from 'react-native';
import { meApi } from '@/api/auth';
import { Btn, Card, Label, Notice, Screen, SwitchRow, T, useP } from '@/ui/kit';
import { errorMessage, useSession } from '@/state/session';
import type { Preferences } from '@/api/auth';

export default function Privacidade() {
  const p = useP();
  const { prefs, updatePrefs } = useSession();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  if (!prefs) return null;
  const save = (patch: Partial<Preferences>) => updatePrefs(patch).catch((e) => setMsg({ ok: false, t: errorMessage(e) }));

  const exportar = async () => {
    try {
      const data = await meApi.exportData();
      await Share.share({ title: 'Meus dados do Prumo', message: JSON.stringify(data, null, 2) });
      setMsg({ ok: true, t: 'Exportação gerada.' });
    } catch (e) {
      setMsg({ ok: false, t: errorMessage(e) });
    }
  };

  return (
    <Screen eyebrow="Preferências" title="Privacidade e dados" back>
      <Card>
        <SwitchRow title="Ocultar valores ao abrir" value={prefs.hideValuesOnOpen} onChange={(v) => save({ hideValuesOnOpen: v })} />
        <SwitchRow title="Ocultar valores em segundo plano" sub="Esconde o conteúdo na lista de apps recentes" value={prefs.hideInBackground} onChange={(v) => save({ hideInBackground: v })} />
        <SwitchRow title="Compartilhar dados de uso anônimos" sub="Ajuda a melhorar o app; sem dados financeiros" value={prefs.analyticsOptIn} onChange={(v) => save({ analyticsOptIn: v })} />
      </Card>
      <Card style={{ gap: 10 }}>
        <Label>Seus direitos (LGPD)</Label>
        <T s={13} c={p.sub}>Você pode exportar seus dados ou pedir a exclusão da conta (em Dados pessoais) a qualquer momento.</T>
        {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}
        <Btn kind="ghost" onPress={exportar}>Exportar meus dados</Btn>
      </Card>
      <T s={11} c={p.mute}>O app não armazena número completo de cartão, CVV nem senhas bancárias. Os dados são isolados por usuário.</T>
    </Screen>
  );
}
