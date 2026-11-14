import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { money, plannerApi } from '@/api/finance';
import { Bar, Card, Label, Notice, Pill, Ring, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { useLoad } from '@/state/useLoad';

export default function Saude() {
  const p = useP();
  const { data: h, error } = useLoad(plannerApi.health);
  const cor = !h?.score ? p.mute : h.score >= 80 ? C.green : h.score >= 60 ? C.green : h.score >= 40 ? C.yellow : C.red;
  return (
    <Screen eyebrow="Conta pessoal" title="Saúde financeira" back>
      {error ? <Notice kind="err">{error}</Notice> : null}
      {!h && !error && <ActivityIndicator color={p.accent} />}
      {h && (h.score === null ? (
        <Card style={{ gap: 8 }}><T s={15} w="700">Ainda não há dados suficientes</T><T s={12} c={p.sub}>Registre receitas, despesas e orçamentos nos últimos 3 meses para o app calcular a nota.</T></Card>
      ) : (
        <>
          <Card style={{ alignItems: 'center', gap: 14 }}>
            <Ring f={h.score / 100} color={cor} size={200} stroke={20}>
              <View style={{ alignItems: 'center' }}><T s={56} w="800">{h.score}</T><T s={12} w="800" c={cor}>{h.label}</T></View>
            </Ring>
            <T s={12} c={p.sub} style={{ textAlign: 'center' }}>Média dos últimos {h.window.days} dias: receita {money(h.window.averageIncome)}/mês · despesa {money(h.window.averageExpense)}/mês</T>
          </Card>

          <View style={{ gap: 10 }}>
            <T s={20} w="700">O que compõe a nota</T>
            {h.pillars.map((x) => (
              <Card key={x.id} style={{ gap: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}><T s={14} w="700" style={{ flex: 1 }}>{x.name}</T><Pill color={x.ok ? C.green : C.yellow} bg={x.ok ? p.okBg : p.warnBg}>{x.ok ? 'BOM' : 'ATENÇÃO'}</Pill></Row>
                <Row style={{ justifyContent: 'space-between' }}><T s={18} w="800">{x.value}</T><T s={11} c={p.mute} style={{ flex: 1, textAlign: 'right' }}>{x.reference}</T></Row>
                <Bar f={x.score} color={x.ok ? C.green : C.yellow} />
              </Card>
            ))}
          </View>

          {h.tips.length > 0 && (
            <View style={{ gap: 8 }}>
              <Label>Para subir a nota</Label>
              {h.tips.map((t) => (
                <Pressable key={t.title} onPress={() => router.push(t.href as never)} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, backgroundColor: p.card, alignItems: 'center', minHeight: 56 }}>
                  <View style={{ flex: 1, gap: 3 }}><T s={14} w="700">{t.title}</T><T s={12} c={p.sub}>{t.text}</T></View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ))}
      {h && <T s={11} c={p.mute}>{h.note}</T>}
    </Screen>
  );
}
