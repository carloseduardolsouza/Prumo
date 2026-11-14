import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { money, parseMoney, plannerApi, shortDate } from '@/api/finance';
import { Bar, Btn, Card, Field, Label, Notice, Ring, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { C, pct } from '@/ui/theme';
import { errorMessage } from '@/state/session';
import { useLoad } from '@/state/useLoad';

export default function Meta() {
  const p = useP();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(() => plannerApi.goal(id), [id]);
  const [modo, setModo] = useState<'in' | 'out'>('in');
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  if (!data) return <Screen title="Meta" back>{error ? <Notice kind="err">{error}</Notice> : <ActivityIndicator color={p.accent} />}</Screen>;
  const g = data.goal;
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setValor(''); setMsg({ ok: true, t: ok }); await reload(); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); } };
  const amount = parseMoney(valor);
  const cancelar = () => Alert.alert('Cancelar meta?', 'A meta sai da lista. Os valores guardados continuam nas suas carteiras.', [
    { text: 'Manter', style: 'cancel' }, { text: 'Cancelar meta', style: 'destructive', onPress: async () => { await plannerApi.cancelGoal(g.id).catch(() => undefined); router.back(); } },
  ]);

  return (
    <Screen eyebrow={g.kind === 'FREEDOM' ? 'Renda passiva' : 'Meta'} title={g.name} back>
      <Card style={{ gap: 14, alignItems: 'center' }}>
        <Ring f={Math.min(1, g.percent / 100)} color={g.color ?? C.green} size={150} stroke={16}><T s={28} w="800">{pct(g.percent, 0)}</T></Ring>
        <T s={20} w="800">{money(g.saved)} <T s={13} c={p.mute}>de {money(g.target)}{g.kind === 'FREEDOM' ? '/mês' : ''}</T></T>
        {g.status === 'REACHED' && <T s={14} w="800" c={C.green}>Meta alcançada</T>}
        {g.kind === 'SAVING' && g.monthlyNeeded && <T s={12} c={p.sub}>Guardando {money(g.monthlyNeeded)} por mês você chega em {g.targetDate?.split('-').reverse().join('/')}</T>}
        <View style={{ alignSelf: 'stretch' }}><Bar f={Math.min(1, g.percent / 100)} color={g.color ?? C.green} h={10} /></View>
      </Card>
      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}

      {g.kind === 'SAVING' ? (
        <>
          <Card style={{ gap: 12 }}>
            <Seg value={modo} onChange={setModo} items={[['in', 'Guardar'], ['out', 'Retirar']]} />
            <Field label="Valor (R$)" value={valor} onChange={setValor} keyboard="decimal-pad" hint="Reserva simbólica: não tira dinheiro da carteira nem vira despesa." />
            <Btn onPress={() => run(() => plannerApi.contribute(g.id, modo === 'in' ? amount : `-${amount}`), modo === 'in' ? 'Valor guardado.' : 'Retirada registrada.')}>{modo === 'in' ? 'Guardar na meta' : 'Retirar da meta'}</Btn>
          </Card>
          <View style={{ gap: 4 }}>
            <T s={20} w="700">Histórico</T>
            {data.contributions.length === 0 && <T s={12} c={p.mute}>Nenhum valor guardado ainda.</T>}
            {data.contributions.map((c) => (
              <Row key={c.id} style={{ paddingVertical: 8 }}>
                <View style={{ flex: 1 }}><T s={14} w="600">{c.note ?? (Number(c.amount) >= 0 ? 'Guardado' : 'Retirada')}</T><T s={11} c={p.mute}>{shortDate(c.date)}</T></View>
                <T s={14} w="700" c={Number(c.amount) >= 0 ? C.green : p.red}>{money(c.amount, { sign: true })}</T>
              </Row>
            ))}
          </View>
        </>
      ) : <Card><T s={13} c={p.sub}>O progresso desta meta vem dos proventos registrados na Conta Investimentos (média mensal dos últimos 12 meses).</T></Card>}

      <Pressable onPress={cancelar} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}><T s={14} w="800" c={p.red}>Cancelar meta</T></Pressable>
    </Screen>
  );
}
