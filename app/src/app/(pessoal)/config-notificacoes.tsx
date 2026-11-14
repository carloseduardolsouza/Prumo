import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { messageApi, type NotificationPrefs } from '@/api/message';
import { Card, Chips, Label, Notice, Screen, SwitchRow, T, useP } from '@/ui/kit';
import { errorMessage } from '@/state/session';

const categorias: [keyof NotificationPrefs, string, string][] = [
  ['venc', 'Vencimentos', 'contas, faturas, parcelas e saldo projetado negativo'],
  ['orc', 'Orçamento e limites', 'orçamento próximo do limite, limite do cartão, assinaturas'],
  ['meta', 'Metas', 'meta atingida ou próxima de ser atingida'],
  ['inv', 'Investimentos', 'proventos a caminho e preço-alvo atingido'],
];

export default function ConfigNotificacoes() {
  const p = useP();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    messageApi.preferences().then(setPrefs).catch((e) => setErro(errorMessage(e)));
  }, []);

  // Otimista: reflete na hora e volta atrás se o servidor recusar.
  const save = async (patch: Partial<NotificationPrefs>) => {
    const before = prefs;
    setPrefs((x) => (x ? { ...x, ...patch } : x));
    try {
      setPrefs(await messageApi.updatePreferences(patch));
      setErro('');
    } catch (e) {
      setPrefs(before);
      setErro(errorMessage(e));
    }
  };

  if (!prefs) return <Screen eyebrow="Preferências" title="Notificações" back>{erro ? <Notice kind="err">{erro}</Notice> : <ActivityIndicator color={p.accent} />}</Screen>;

  return (
    <Screen eyebrow="Preferências" title="Notificações" back>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      <Card>{categorias.map(([k, t, s]) => <SwitchRow key={k} title={t} sub={s} value={Boolean(prefs[k])} onChange={(v) => save({ [k]: v })} />)}</Card>
      <View style={{ gap: 10 }}>
        <Label>Antecedência dos avisos</Label>
        <Chips value={prefs.leadDays} onChange={(v) => save({ leadDays: v })} items={[[1, '1 dia'], [3, '3 dias'], [5, '5 dias'], [7, '7 dias']]} />
      </View>
      <Card>
        <SwitchRow title="Horário silencioso" sub={`${prefs.quietStart}h às ${prefs.quietEnd}h, sem push`} value={prefs.quietEnabled} onChange={(v) => save({ quietEnabled: v })} />
        {prefs.quietEnabled && (
          <View style={{ gap: 10, paddingBottom: 8 }}>
            <Label>Começa às</Label>
            <Chips value={prefs.quietStart} onChange={(v) => save({ quietStart: v })} items={[[20, '20h'], [21, '21h'], [22, '22h'], [23, '23h']]} />
            <Label>Termina às</Label>
            <Chips value={prefs.quietEnd} onChange={(v) => save({ quietEnd: v })} items={[[6, '6h'], [7, '7h'], [8, '8h'], [9, '9h']]} />
          </View>
        )}
        <SwitchRow title="Notificações no celular" value={prefs.pushEnabled} onChange={(v) => save({ pushEnabled: v })} />
        <SwitchRow title="Também por e-mail" value={prefs.emailEnabled} onChange={(v) => save({ emailEnabled: v })} />
      </Card>
      <T s={11} c={p.mute}>Avisos não efetivam pagamentos nem movimentações; você sempre confirma no app. Alertas de conta (verificação de e-mail, redefinição de senha) sempre são enviados.</T>
    </Screen>
  );
}
