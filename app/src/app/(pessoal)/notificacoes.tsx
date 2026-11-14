import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { messageApi, type AppNotification, type NotificationCategory, type NotificationPrefs } from '@/api/message';
import { Badge, Card, Chips, I, Label, Notice, Pill, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const ICON: Record<NotificationCategory, [string, string]> = { venc: [I.cal, C.yellow], orc: [I.warn, C.red], meta: [I.target, C.green], inv: [I.coin, C.cyan] };

const DAY = 86_400_000;
function groupOf(iso: string): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((start.getTime() - new Date(iso).setHours(0, 0, 0, 0)) / DAY);
  return diff <= 0 ? 'HOJE' : diff === 1 ? 'ONTEM' : diff < 7 ? 'ESTA SEMANA' : 'ANTES';
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function Notificacoes() {
  const p = useP();
  const [f, setF] = useState<'todas' | NotificationCategory>('todas');
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [erro, setErro] = useState('');

  const load = useCallback(async (filter: 'todas' | NotificationCategory) => {
    try {
      const [r, pr] = await Promise.all([messageApi.list(filter === 'todas' ? undefined : filter), messageApi.preferences()]);
      setItems(r.notifications);
      setPrefs(pr);
      setErro('');
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(f); }, [load, f]));

  const abrir = async (n: AppNotification) => {
    if (!n.read) {
      setItems((l) => l?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      messageApi.markRead(n.id).catch(() => undefined);
    }
    if (n.href) router.push(n.href as never);
  };
  const marcarTodas = async () => {
    await messageApi.markAllRead().catch(() => undefined);
    setItems((l) => l?.map((x) => ({ ...x, read: true })) ?? null);
  };

  const grupos = (items ?? []).reduce<{ t: string; itens: AppNotification[] }[]>((acc, n) => {
    const t = groupOf(n.createdAt);
    const g = acc.find((x) => x.t === t);
    g ? g.itens.push(n) : acc.push({ t, itens: [n] });
    return acc;
  }, []);
  const naoLidas = items?.filter((n) => !n.read).length ?? 0;

  return (
    <Screen
      eyebrow="Conta pessoal" title="Notificações" back
      right={naoLidas > 0 ? <Pressable onPress={marcarTodas} style={{ minHeight: 44, justifyContent: 'center' }}><T s={12} w="700" c={p.link}>Marcar todas</T></Pressable> : undefined}>
      <Chips value={f} onChange={setF} items={[['todas', 'Todas'], ['venc', 'Vencimentos'], ['orc', 'Orçamento'], ['meta', 'Metas'], ['inv', 'Investimentos']]} />
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      {!items && !erro && <ActivityIndicator color={p.accent} />}
      {items && items.length === 0 && <Card><T s={13} c={p.mute} style={{ textAlign: 'center' }}>Nenhuma notificação por aqui.</T></Card>}
      {grupos.map((g) => (
        <View key={g.t} style={{ gap: 8 }}>
          <Label>{g.t}</Label>
          {g.itens.map((n) => {
            const [icon, cor] = ICON[n.category];
            return (
              <Pressable key={n.id} onPress={() => abrir(n)} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, backgroundColor: p.card, opacity: n.read ? 0.7 : 1 }}>
                <Badge d={icon} color={cor} size={42} bg={p.card2} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <T s={14} w="700" style={{ flex: 1 }}>{n.title}</T>
                    <T s={11} c={p.mute}>{hora(n.createdAt)}</T>
                  </Row>
                  <T s={13} c={p.sub}>{n.body}</T>
                  {n.category === 'inv' && <View style={{ alignSelf: 'flex-start', marginTop: 2 }}><Pill color={C.cyan} bg={p.okBg}>CONTA INVESTIMENTOS</Pill></View>}
                </View>
                {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.accent, marginTop: 6 }} />}
              </Pressable>
            );
          })}
        </View>
      ))}
      {prefs && (
        <Card style={{ gap: 10 }}>
          {[['Avisar vencimentos com antecedência', `${prefs.leadDays} dias`], ['Horário silencioso', prefs.quietEnabled ? `${prefs.quietStart}h – ${prefs.quietEnd}h` : 'desligado']].map(([l, v]) => (
            <Row key={l} style={{ justifyContent: 'space-between' }}><T s={13} c={p.sub} style={{ flex: 1 }}>{l}</T><T s={13} w="800">{v}</T></Row>
          ))}
          <Pressable onPress={() => router.push('/config-notificacoes')} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="700" c={p.link}>Ajustar notificações</T></Pressable>
        </Card>
      )}
    </Screen>
  );
}
