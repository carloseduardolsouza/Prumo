import { useState } from 'react';
import { View } from 'react-native';
import { COLOR_BY_CLASS, investApi, money } from '@/api/finance';
import { Bar, Card, Grid, Label, Notice, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { Bars, Lines } from '@/ui/charts';
import { C, pct } from '@/ui/theme';
import { useLoad } from '@/state/useLoad';

const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
type P = '3' | '6' | '12';

export default function InvDashboard() {
  const p = useP();
  const [per, setPer] = useState<P>('12');
  const { data: o, error } = useLoad(investApi.overview);
  const { data: assets } = useLoad(investApi.assets);
  const n = Number(per);
  const series = (o?.series ?? []).slice(-n);
  const divs = (o?.dividends.monthly ?? []).slice(-n);
  const label = (m: string) => MES[Number(m.slice(5, 7)) - 1]!;
  const provSum = divs.reduce((s, x) => s + x.amount, 0);
  const aporteNoPeriodo = series.length ? series[series.length - 1]!.contributed - series[0]!.contributed : 0;
  const ganhoPeriodo = series.length ? series[series.length - 1]!.value - series[0]!.value - aporteNoPeriodo : 0;
  const held = (assets ?? []).filter((a) => Number(a.quantity) > 0);
  const ordered = [...held].filter((a) => a.unrealizedPercent !== null).sort((a, b) => (b.unrealizedPercent ?? 0) - (a.unrealizedPercent ?? 0));
  const byClass = (o?.allocation ?? []).map((c) => {
    const as = held.filter((a) => a.assetClass === c.assetClass);
    const cost = as.reduce((s, a) => s + Number(a.invested), 0), res = as.reduce((s, a) => s + Number(a.unrealized), 0);
    return { ...c, ret: cost ? (res / cost) * 100 : 0 };
  });
  const cm = Math.max(1, ...byClass.map((c) => Math.abs(c.ret)));

  const kpis: [string, string, string, string][] = o ? [
    ['Resultado total', money(o.result, { sign: true }), 'patrimônio − aportes', Number(o.result) >= 0 ? C.green : p.red],
    ['Proventos 12m', money(o.dividends.last12m), 'dividendos, JCP e rendimentos', p.text],
    ['Aportes no período', money(aporteNoPeriodo), 'vindos da Conta Pessoal', p.text],
    ['Ganho no período', money(ganhoPeriodo, { sign: true }), 'valorização + proventos', ganhoPeriodo >= 0 ? C.green : p.red],
    ['Realizado', money(o.realized, { sign: true }), 'vendas já concluídas', p.text],
    ['Não realizado', money(o.unrealized, { sign: true }), 'marcação a mercado', p.text],
    ['Dividend yield', o.dividends.yield === null ? '—' : pct(o.dividends.yield, 2), 'últimos 12 meses', p.text],
    ['Yield on cost', o.dividends.yieldOnCost === null ? '—' : pct(o.dividends.yieldOnCost, 2), 'sobre o custo', p.text],
  ] : [];

  return (
    <Screen eyebrow="Conta investimentos" title="Dashboard">
      <Seg value={per} onChange={setPer} items={[['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses']]} />
      {error ? <Notice kind="err">{error}</Notice> : null}
      {o && (
        <>
          <Card style={{ gap: 12 }}>
            <Label>Rentabilidade em 12 meses</Label>
            <T s={34} w="700">{o.return12m === null ? '—' : pct(o.return12m, 2, true)}</T>
            <T s={11} c={p.mute}>{o.methodology}</T>
          </Card>

          <Grid cols={2} gap={10}>
            {kpis.map(([l, v, s, c]) => <View key={l} style={{ borderRadius: 20, backgroundColor: p.card, padding: 14, gap: 6 }}><Label>{l}</Label><T s={16} w="800" c={c}>{v}</T><T s={10} c={p.mute}>{s}</T></View>)}
          </Grid>

          <Card style={{ gap: 12 }}>
            <Label>Patrimônio × aportado</Label>
            {series.some((s) => s.value > 0) ? (
              <>
                <Lines height={150} series={[{ values: series.map((s) => s.value), color: p.accent, area: true }, { values: series.map((s) => s.contributed), color: p.mute, dashed: true }]} />
                <Row style={{ justifyContent: 'space-between' }}>{[series[0], series[Math.floor(series.length / 2)], series[series.length - 1]].map((s, i) => <T key={i} s={10} c={p.mute}>{label(s!.month)}</T>)}</Row>
                <Row style={{ gap: 14 }}>{[[p.accent, 'Patrimônio'], [p.mute, 'Aportado']].map(([c, l]) => <Row key={l} style={{ gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><T s={11} c={p.sub}>{l}</T></Row>)}</Row>
              </>
            ) : <T s={12} c={p.sub}>Registre operações para ver a evolução.</T>}
          </Card>

          <Card style={{ gap: 12 }}>
            <Label>Proventos recebidos</Label><T s={24} w="800">{money(provSum)}</T>
            <Bars height={110} items={divs.map((x) => ({ label: label(x.month), values: [x.amount], colors: [C.cyan] }))} />
          </Card>

          <Card style={{ gap: 10 }}>
            <Label>De onde veio o retorno</Label>
            <View style={{ height: 12, flexDirection: 'row', borderRadius: 999, overflow: 'hidden', gap: 2 }}><View style={{ flex: Math.max(Number(o.unrealized) + Number(o.realized), 0.001), backgroundColor: C.blue }} /><View style={{ flex: Math.max(Number(o.dividends.last12m), 0.001), backgroundColor: C.cyan }} /></View>
            <Row style={{ justifyContent: 'space-between' }}><T s={13} c={p.sub}>Valorização (realizada + não realizada)</T><T s={13} w="800">{money(Number(o.unrealized) + Number(o.realized))}</T></Row>
            <Row style={{ justifyContent: 'space-between' }}><T s={13} c={p.sub}>Proventos 12m</T><T s={13} w="800">{money(o.dividends.last12m)}</T></Row>
          </Card>

          {byClass.length > 0 && (
            <Card style={{ gap: 10 }}>
              <Label>Resultado por classe (sobre o custo)</Label>
              {byClass.map((c) => <Row key={c.assetClass}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_BY_CLASS[c.assetClass] }} /><T s={12} c={p.sub} style={{ width: 78 }}>{c.label}</T><View style={{ flex: 1 }}><Bar f={Math.abs(c.ret) / cm} color={c.ret >= 0 ? COLOR_BY_CLASS[c.assetClass]! : p.red} /></View><T s={12} w="800" style={{ width: 56, textAlign: 'right' }}>{pct(c.ret, 1, true)}</T></Row>)}
            </Card>
          )}

          {ordered.length > 1 && (
            <Row style={{ alignItems: 'stretch' }}>
              {[['Maiores altas', ordered.slice(0, 3).filter((a) => (a.unrealizedPercent ?? 0) > 0), C.green], ['Maiores quedas', ordered.slice(-3).reverse().filter((a) => (a.unrealizedPercent ?? 0) < 0), p.red]].map(([t, l, c]) => (
                <Card key={String(t)} style={{ flex: 1, gap: 8 }}>
                  <Label>{String(t)}</Label>
                  {(l as typeof ordered).length === 0 && <T s={12} c={p.mute}>—</T>}
                  {(l as typeof ordered).map((a) => <Row key={a.id} style={{ justifyContent: 'space-between' }}><T s={13} w="700">{a.ticker}</T><T s={13} w="800" c={String(c)}>{pct(a.unrealizedPercent ?? 0, 1, true)}</T></Row>)}
                </Card>
              ))}
            </Row>
          )}
          <T s={11} c={p.mute}>Valores de mercado dependem das cotações que você informou. Volatilidade e índice Sharpe exigem histórico diário de cotas e não são calculados.</T>
        </>
      )}
    </Screen>
  );
}
