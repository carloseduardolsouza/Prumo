import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { cardApi, dashboardApi, money, today, type CreditCard, type Dashboard, type PeriodKey } from '@/api/finance';
import { Bar, Btn, Card, Chips, Donut, Field, Grid, Label, Notice, Row, Screen, Stat, T, useP } from '@/ui/kit';
import { Bars, Lines } from '@/ui/charts';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const PERIODS: [PeriodKey, string][] = [['today', 'Hoje'], ['week', 'Semana'], ['month', 'Mês'], ['prev_month', 'Mês anterior'], ['3m', '3 meses'], ['6m', '6 meses'], ['year', 'Ano'], ['custom', 'Personalizado']];
const TITULO: Record<PeriodKey, string> = { today: 'Gasto hoje', week: 'Gasto na semana', month: 'Gasto no mês', prev_month: 'Gasto no mês', '3m': 'Gasto no trimestre', '6m': 'Gasto no semestre', year: 'Gasto no ano', custom: 'Gasto no período' };

export default function DashboardScreen() {
  const p = useP();
  const [per, setPer] = useState<PeriodKey>('month');
  const [de, setDe] = useState(today().slice(0, 8) + '01');
  const [ate, setAte] = useState(today());
  const [aplicado, setAplicado] = useState<{ from: string; to: string } | undefined>();
  const [data, setData] = useState<Dashboard | null>(null);
  const [cartoes, setCartoes] = useState<CreditCard[]>([]);
  const [erro, setErro] = useState('');

  const load = useCallback(async (key: PeriodKey, custom?: { from: string; to: string }) => {
    if (key === 'custom' && !custom) return;
    try {
      const [dash, cs] = await Promise.all([dashboardApi.get(key, custom), cardApi.list().catch(() => null)]);
      setData(dash);
      setCartoes(cs?.cards.filter((c) => c.status === 'ACTIVE') ?? []);
      setErro('');
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(per, aplicado); }, [load, per, aplicado]));

  const aplicar = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return setErro('Use as datas no formato AAAA-MM-DD.');
    if (de > ate) return setErro('A data inicial precisa ser anterior à final.');
    setErro('');
    setAplicado({ from: de, to: ate });
  };

  // Rótulos esparsos quando há muitas barras (ex.: 30 dias).
  const passo = data ? Math.ceil(data.series.length / 7) : 1;
  const barras = (data?.series ?? []).map((s, i) => ({ label: i % passo === 0 ? s.label : '', values: [Number(s.income), Number(s.expense)], colors: [C.blue, C.yellow] }));
  const temBarras = barras.some((b) => b.values.some((v) => v > 0));
  const saldo = (data?.balanceEvolution ?? []).map((x) => Number(x.balance));
  const gastoTotal = data ? Number(data.summary.expense) : 0;

  return (
    <Screen eyebrow="Conta pessoal" title="Dashboard" right={data ? <T s={12} c={p.mute} style={{ maxWidth: 150, textAlign: 'right' }}>{data.period.label}</T> : undefined}>
      <Chips value={per} onChange={(k) => { setPer(k); if (k !== 'custom') setAplicado(undefined); }} items={PERIODS} />
      {per === 'custom' && (
        <Card style={{ gap: 12 }}>
          <Row>
            <View style={{ flex: 1 }}><Field label="De" value={de} onChange={setDe} placeholder="AAAA-MM-DD" /></View>
            <View style={{ flex: 1 }}><Field label="Até" value={ate} onChange={setAte} placeholder="AAAA-MM-DD" /></View>
          </Row>
          <Btn onPress={aplicar}>Aplicar período</Btn>
        </Card>
      )}
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      {!data && !erro && <ActivityIndicator color={p.accent} />}

      {data && (
        <>
          <View style={{ alignItems: 'center' }}>
            <Donut size={280} stroke={26} gap={gastoTotal > 0 && data.expensesByCategory.length > 1 ? 32 : 0} bg={p.bg}
              parts={gastoTotal > 0 ? data.expensesByCategory.map((c) => ({ f: c.percent / 100, color: c.color })) : [{ f: 1, color: p.track }]}>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Label>{TITULO[per]}</Label>
                <T s={32} w="700">{money(data.summary.expense)}</T>
                <T s={13} w="700" c={C.green}>Receitas {money(data.summary.income)}</T>
              </View>
            </Donut>
          </View>

          {data.upcoming.overdueCount > 0 && (
            <Card style={{ backgroundColor: p.errBg, gap: 4 }}>
              <T s={13} w="800" c={p.red}>{data.upcoming.overdueCount} {data.upcoming.overdueCount === 1 ? 'conta atrasada' : 'contas atrasadas'}</T>
              <T s={12} c={p.sub}>{money(data.upcoming.overdueAmount)} em aberto com vencimento já passado.</T>
            </Card>
          )}

          <T s={20} w="700">Categorias</T>
          {data.expensesByCategory.length === 0 ? (
            <T s={13} c={p.mute}>Nenhuma despesa efetivada neste período.</T>
          ) : (
            <Grid cols={2} gap={12}>
              {data.expensesByCategory.map((c) => (
                <View key={c.name} style={{ height: 124, borderRadius: 24, backgroundColor: p.card, padding: 16, justifyContent: 'space-between' }}>
                  <T s={13} w="700" c={p.sub} style={{ alignSelf: 'flex-end' }}>{c.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</T>
                  <View style={{ gap: 2 }}><T s={17} w="700">{money(c.amount)}</T><T s={13} c={p.mute} lines={1}>{c.name}</T></View>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color }} />
                </View>
              ))}
            </Grid>
          )}

          <Row>
            <Stat label="Poupança" value={data.summary.savingsRate === null ? '—' : `${data.summary.savingsRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} />
            <Stat label="A pagar 30d" value={money(data.upcoming.plannedExpense)} />
            <Stat label="Resultado" value={money(data.summary.result)} color={Number(data.summary.result) >= 0 ? C.green : p.red} />
          </Row>

          <Card style={{ gap: 16 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Label>Receitas × despesas</Label>
              <Row style={{ gap: 12 }}>
                {[[C.blue, 'Receitas'], [C.yellow, 'Despesas']].map(([c, l]) => <Row key={l} style={{ gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><T s={11} c={p.sub}>{l}</T></Row>)}
              </Row>
            </Row>
            {temBarras ? <Bars height={170} items={barras} /> : <T s={13} c={p.mute} style={{ textAlign: 'center', paddingVertical: 24 }}>Sem movimentações neste período.</T>}
          </Card>

          <Card style={{ gap: 14 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Label>Evolução do saldo</Label>
              {saldo.length > 1 && <T s={13} w="700" c={saldo.at(-1)! >= saldo[0]! ? C.green : p.red}>{money(saldo.at(-1)! - saldo[0]!, { sign: true })}</T>}
            </Row>
            <T s={26} w="700">{money(data.balance.total)}</T>
            {saldo.length > 1 ? <Lines series={[{ values: saldo, color: C.blue, area: true }]} /> : <T s={12} c={p.mute}>Selecione um período com mais de um dia para ver a evolução.</T>}
            {saldo.length > 0 && <T s={12} c={p.mute}>Início do período: <T s={12} w="800">{money(saldo[0]!)}</T></T>}
          </Card>

          {data.incomeByCategory.length > 0 && (
            <Card style={{ gap: 14 }}>
              <Label>Receitas por categoria</Label>
              {data.incomeByCategory.map((c) => (
                <View key={c.name} style={{ gap: 8 }}>
                  <Row style={{ justifyContent: 'space-between' }}><T s={13} w="600">{c.name}</T><T s={13} w="800">{money(c.amount)}</T></Row>
                  <Bar f={c.percent / 100} color={c.color} h={10} />
                </View>
              ))}
            </Card>
          )}
          {cartoes.length > 0 && (
            <Card style={{ gap: 16 }}>
              <Label>Limite usado por cartão</Label>
              {cartoes.map((c) => (
                <View key={c.id} style={{ gap: 8 }}>
                  <Row style={{ justifyContent: 'space-between' }}><T s={13} w="600">{c.name}</T><T s={13} w="800">{Math.round(c.summary?.usedPercent ?? 0)}%</T></Row>
                  <Bar f={(c.summary?.usedPercent ?? 0) / 100} color={c.color ?? C.violet} h={10} />
                </View>
              ))}
            </Card>
          )}
          <T s={11} c={p.mute}>{data.methodology}</T>
        </>
      )}
    </Screen>
  );
}
