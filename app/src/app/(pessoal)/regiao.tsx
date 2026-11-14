import { View } from 'react-native';
import { Chips, Label, Screen, T, useP } from '@/ui/kit';
import { useSession } from '@/state/session';
import type { Preferences } from '@/api/auth';

const TZ: [string, string][] = [['America/Sao_Paulo', 'Brasília (GMT-3)'], ['America/Manaus', 'Manaus (GMT-4)'], ['America/Noronha', 'Noronha (GMT-2)']];

export default function Regiao() {
  const p = useP();
  const { prefs, updatePrefs } = useSession();
  if (!prefs) return null;
  const save = (patch: Partial<Preferences>) => updatePrefs(patch).catch(() => undefined);

  return (
    <Screen eyebrow="Preferências" title="Moeda e região" back>
      <View style={{ gap: 10 }}><Label>Moeda principal</Label><Chips value={prefs.currency} onChange={(v) => save({ currency: v })} items={[['BRL', 'BRL'], ['USD', 'USD'], ['EUR', 'EUR']]} /></View>
      {prefs.currency !== 'BRL' && <T s={12} c={p.mute}>Nesta versão os valores continuam em reais; outras moedas chegam em breve.</T>}
      <View style={{ gap: 10 }}><Label>Formato de data</Label><Chips value={prefs.dateFormat} onChange={(v) => save({ dateFormat: v })} items={[['dd/mm/aaaa', 'dd/mm/aaaa'], ['mm/dd/aaaa', 'mm/dd/aaaa'], ['aaaa-mm-dd', 'aaaa-mm-dd']]} /></View>
      <View style={{ gap: 10 }}><Label>Fuso horário</Label><Chips value={prefs.timezone} onChange={(v) => save({ timezone: v })} items={TZ} /></View>
      <View style={{ gap: 10 }}><Label>Primeiro dia da semana</Label><Chips value={prefs.firstDayOfWeek} onChange={(v) => save({ firstDayOfWeek: v })} items={[[0, 'Domingo'], [1, 'Segunda']]} /></View>
      <T s={12} c={p.sub}>Prévia: {prefs.dateFormat === 'dd/mm/aaaa' ? '14/11/2026' : prefs.dateFormat === 'mm/dd/aaaa' ? '11/14/2026' : '2026-11-14'} · R$ 1.234,56</T>
    </Screen>
  );
}
