import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { FREQUENCIES, financeApi, money, planningApi, shortDate, type RecurringSummary, type Rule, type SplitItem, type Wallet } from '@/api/finance';
import { Badge, Card, I, Icon, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const freqLabel = (f: string) => FREQUENCIES.find(([k]) => k === f)?.[1] ?? f;

export default function Recorrentes() {
  const p = useP();
  const [data, setData] = useState<RecurringSummary | null>(null);
  const [splits, setSplits] = useState<{ splits: SplitItem[]; receivable: string } | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, s, w] = await Promise.all([planningApi.recurring(), planningApi.splits(), financeApi.wallets()]);
      setData(r); setSplits(s); setWallets(w.wallets); setErro('');
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const receber = async (sp: SplitItem, pid: string) => {
    if (!wallets[0]) return;
    try { await planningApi.paySplit(sp.id, pid, wallets[0].id); await load(); } catch (e) { setErro(errorMessage(e)); }
  };

  const fixo = Number(data?.fixed.total ?? 0), assin = Number(data?.subscriptions.total ?? 0);
  const linha = (r: Rule, d: string) => (
    <Pressable key={r.id} onPress={() => router.push({ pathname: '/recorrencia', params: { id: r.id } })}>
      <Row style={{ paddingVertical: 8 }}>
        <Badge d={r.isSubscription ? I.play : I.repeat} color={r.isSubscription ? C.yellow : C.blue} />
        <View style={{ flex: 1 }}>
          <T s={15} w="600">{r.description}</T>
          <T s={12} c={p.mute}>{freqLabel(r.frequency)}{r.nextDate ? ` · próx. ${shortDate(r.nextDate)}` : ''}{r.walletName ? ` · ${r.walletName}` : ''}</T>
        </View>
        <T s={15} w="700" c={r.type === 'INCOME' ? C.green : p.text}>{money(r.amount)}</T>
      </Row>
    </Pressable>
  );

  return (
    <Screen
      eyebrow="Conta pessoal" title="Recorrentes" back
      right={<Pressable accessibilityLabel="Nova recorrência" onPress={() => router.push('/recorrencia')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon d={I.plus} size={24} sw={1.8} /></Pressable>}>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      {!data && !erro && <ActivityIndicator color={p.accent} />}
      {data && (
        <>
          <Card style={{ gap: 12 }}>
            <Label>Total recorrente por mês</Label>
            <T s={32} w="700">{money(data.monthlyTotal)}</T>
            <View style={{ height: 12, flexDirection: 'row', borderRadius: 999, overflow: 'hidden', gap: 2, backgroundColor: p.track }}>
              {fixo + assin > 0 && <><View style={{ flex: Math.max(fixo, 0.0001), backgroundColor: C.blue }} /><View style={{ flex: Math.max(assin, 0.0001), backgroundColor: C.yellow }} /></>}
            </View>
            <Row style={{ gap: 16 }}>{[[C.blue, `Contas fixas ${money(data.fixed.total)}`], [C.yellow, `Assinaturas ${money(data.subscriptions.total)}`]].map(([c, l]) => <Row key={l} style={{ gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><T s={11} c={p.sub}>{l}</T></Row>)}</Row>
          </Card>

          {data.alerts.map((a) => (
            <Card key={a.ruleId} style={{ flexDirection: 'row', backgroundColor: p.warnBg, gap: 12, alignItems: 'center' }}>
              <Icon d={I.up} color={C.yellow} />
              <View style={{ flex: 1, gap: 3 }}><T s={14} w="800" c={C.yellow}>{a.description} ficou mais caro</T><T s={12} c={p.sub}>Passou de {money(a.from)} para {money(a.to)}. São + {money(a.yearlyImpact)} por ano.</T></View>
            </Card>
          ))}

          {data.fixed.items.length + data.subscriptions.items.length + data.income.items.length === 0 && (
            <Card style={{ gap: 6 }}><T s={14} w="700">Nada recorrente ainda</T><T s={12} c={p.sub}>Cadastre contas fixas, assinaturas e receitas que se repetem. Elas viram lançamentos previstos no calendário.</T></Card>
          )}
          {data.fixed.items.length > 0 && <View style={{ gap: 4 }}><Label>Contas fixas</Label>{data.fixed.items.map((r) => linha(r, 'fixa'))}</View>}
          {data.subscriptions.items.length > 0 && <View style={{ gap: 4 }}><Label>Assinaturas</Label>{data.subscriptions.items.map((r) => linha(r, 'assinatura'))}</View>}
          {data.income.items.length > 0 && <View style={{ gap: 4 }}><Label>Receitas recorrentes</Label>{data.income.items.map((r) => linha(r, 'receita'))}</View>}
        </>
      )}

      <View style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}><Label>Divisão de despesas</Label>{splits && Number(splits.receivable) > 0 && <T s={12} w="800" c={C.green}>a receber {money(splits.receivable)}</T>}</Row>
        {splits?.splits.filter((s) => Number(s.receivable) > 0).map((s) => (
          <Card key={s.id} style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}><T s={15} w="700">{s.description}</T><T s={12} c={p.mute}>{money(s.totalAmount)} · {s.participants.length + 1} pessoas</T></Row>
            {s.participants.map((pt) => (
              <Row key={pt.id}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }}><T s={11} w="800" c="#121316">{pt.name.slice(0, 2).toUpperCase()}</T></View>
                <T s={14} w="600" style={{ flex: 1 }}>{pt.name}</T>
                {pt.paid ? <T s={13} w="700" c={p.mute}>pago</T> : (
                  <Pressable onPress={() => receber(s, pt.id)} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="700" c={C.green}>deve {money(pt.amount)} · receber</T></Pressable>
                )}
              </Row>
            ))}
          </Card>
        ))}
        <Pressable onPress={() => router.push('/nova-divisao')} style={{ height: 52, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.dash, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={I.plus} size={18} /><T s={14} w="700">Nova divisão</T>
        </Pressable>
      </View>
    </Screen>
  );
}
