import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { COLOR_BY_CLASS, investApi, money, shortDate } from '@/api/finance';
import { Bar, Card, Grid, I, Icon, Label, Notice, Row, Screen, Sigla, T, useP } from '@/ui/kit';
import { Lines } from '@/ui/charts';
import { C, pct } from '@/ui/theme';
import { initials } from '@/state/format';
import { useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';

const atalhos: [string, string, string, string][] = [
  [I.cal, C.green, 'Simuladores', '/inv-simulador'], [I.bell, C.cyan, 'Radar e alertas', '/inv-radar'], [I.doc, C.yellow, 'Imposto de Renda', '/inv-ir'],
  [I.repeat, C.blue, 'Rebalancear', '/inv-carteira'], [I.up, C.violet, 'Patrimônio total', '/patrimonio'],
];
const PERFIL = { CONSERVATIVE: 'conservador', MODERATE: 'moderado', BOLD: 'arrojado' } as const;

export default function InvInicio() {
  const p = useP();
  const { user } = useSession();
  const [hide, setHide] = useState(false);
  const { data: o, error } = useLoad(investApi.overview);
  const { data: prof } = useLoad(investApi.profile);
  const v = (s: string) => money(s, { hide });
  const tile = (l: string, val: string, sub: string, href?: string) => (
    <Pressable key={l} onPress={() => href && router.push(href as never)} style={{ borderRadius: 22, backgroundColor: p.card, padding: 14, gap: 10 }}>
      <Label>{l}</Label><View style={{ gap: 3 }}><T s={17} w="800">{val}</T><T s={11} c={p.mute}>{sub}</T></View>
    </Pressable>
  );
  const empty = o && Number(o.patrimony) === 0;

  return (
    <Screen>
      <Row>
        <Pressable accessibilityLabel="Abrir perfil de investidor" onPress={() => router.push('/inv-perfil')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.card2, alignItems: 'center', justifyContent: 'center' }}><T s={14} w="800">{initials(user?.name ?? '')}</T></Pressable>
        <View style={{ flex: 1 }}><Label>Conta investimentos</Label><T s={12} c={p.sub}>{prof?.profile ? `Perfil ${PERFIL[prof.profile]}` : 'Perfil não definido'}</T></View>
        <Pressable accessibilityLabel="Ocultar valores" onPress={() => setHide(!hide)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon d={I.eye} color={p.mute} /></Pressable>
        <Pressable accessibilityLabel="Alertas de preço e proventos" onPress={() => router.push('/inv-radar')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon d={I.bell} /></Pressable>
      </Row>
      {error ? <Notice kind="err">{error}</Notice> : null}
      {!o && !error && <ActivityIndicator color={p.accent} />}

      {o && (
        <>
          <Card style={{ padding: 22, gap: 12 }}>
            <Label>Patrimônio investido</Label>
            <T s={34} w="700">{v(o.patrimony)}</T>
            <Row style={{ gap: 8 }}><T s={13} w="800" c={Number(o.result) >= 0 ? C.green : p.red}>{Number(o.result) >= 0 ? '▲' : '▼'} {v(o.result)}</T>{o.resultPercent !== null && <T s={12} c={p.mute}>desde o início · {pct(o.resultPercent, 2, true)}</T>}</Row>
            {o.series.some((s) => s.value > 0) && <Lines height={70} series={[{ values: o.series.map((s) => s.value), color: p.accent, area: true }, { values: o.series.map((s) => s.contributed), color: p.mute, dashed: true }]} />}
            <Row>{[['Aportado', v(o.contributed)], ['Rent. 12m', o.return12m === null ? '—' : pct(o.return12m, 1, true)], ['Em caixa', v(o.cash)]].map(([l, val]) => <View key={l} style={{ flex: 1, gap: 4 }}><Label>{l}</Label><T s={13} w="800">{val}</T></View>)}</Row>
          </Card>

          {empty && <Card style={{ gap: 8 }}><T s={15} w="700">Comece pelo primeiro aporte</T><T s={12} c={p.sub}>Cadastre uma corretora e registre um aporte ou compra. O aporte sai da Conta Pessoal sem virar despesa.</T><Pressable onPress={() => router.push('/inv-novo-ativo')} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="800" c={p.accent}>Registrar operação</T></Pressable></Card>}

          <Grid cols={3} gap={10}>
            {atalhos.map(([d, c, t, h]) => (
              <Pressable key={t} onPress={() => router.push(h as never)} style={{ minHeight: 80, borderRadius: 20, backgroundColor: p.card, padding: 12, gap: 8 }}><Icon d={d} color={c} /><T s={12} w="700">{t}</T></Pressable>
            ))}
          </Grid>

          <Grid cols={2} gap={10}>
            {tile('Proventos a receber', v(o.dividends.upcomingTotal), `${o.dividends.upcoming.length} agendado(s)`, '/inv-carteira')}
            {tile('Proventos 12m', v(o.dividends.last12m), `média ${money(o.dividends.monthlyAverage, { hide })}/mês`, '/inv-extrato')}
            {tile('Dividend yield', o.dividends.yield === null ? '—' : pct(o.dividends.yield, 2), o.dividends.yieldOnCost === null ? 'sem posição' : `Yield on cost ${pct(o.dividends.yieldOnCost, 2)}`)}
            {tile('Aportes do mês', v(o.contributedMonth), 'vindos da Conta Pessoal', '/inv-extrato')}
          </Grid>

          {o.allocation.length > 0 && (
            <Card style={{ gap: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}><Label>Alocação por classe</Label><Pressable onPress={() => router.push('/inv-carteira')}><T s={12} w="700" c={p.accent}>Ver carteira</T></Pressable></Row>
              <View style={{ height: 14, flexDirection: 'row', borderRadius: 999, overflow: 'hidden', gap: 2 }}>{o.allocation.filter((c) => c.percent > 0).map((c) => <View key={c.assetClass} style={{ flex: c.percent, backgroundColor: COLOR_BY_CLASS[c.assetClass] }} />)}</View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {o.allocation.map((c) => <Row key={c.assetClass} style={{ gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_BY_CLASS[c.assetClass] }} /><T s={12} c={p.sub}>{c.label}</T><T s={12} w="800">{pct(c.percent)}</T></Row>)}
              </View>
            </Card>
          )}

          {o.passiveGoal && (
            <Card style={{ gap: 8 }}>
              <Label>Meta · renda passiva</Label>
              <Row style={{ justifyContent: 'space-between' }}><T s={24} w="800">{pct(o.passiveGoal.percent)}</T><T s={12} c={p.sub}>{money(o.dividends.monthlyAverage)} de {money(o.passiveGoal.target)} por mês</T></Row>
              <Bar f={Math.min(1, o.passiveGoal.percent / 100)} color={p.accent} h={10} />
            </Card>
          )}

          {o.dividends.upcoming.length > 0 && (
            <View style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}><T s={20} w="700">Próximos proventos</T><Pressable onPress={() => router.push('/inv-carteira')} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="700" c={p.accent}>Agenda</T></Pressable></Row>
              {o.dividends.upcoming.slice(0, 5).map((d) => (
                <Row key={d.id} style={{ paddingVertical: 8 }}>
                  <Sigla t={d.ticker.slice(0, 4)} bg={C.cyan} fg={p.bg} size={42} />
                  <View style={{ flex: 1 }}><T s={15} w="700">{d.ticker}</T><T s={12} c={p.mute}>{d.kind ?? 'Provento'} · paga {shortDate(d.date)}</T></View>
                  <T s={15} w="700" c={C.green}>{v(d.amount)}</T>
                </Row>
              ))}
            </View>
          )}

          {o.highlights.length > 0 && (
            <View style={{ gap: 10 }}>
              <T s={20} w="700">Variação das cotações</T>
              <Grid cols={2} gap={10}>
                {o.highlights.map((h) => (
                  <View key={h.ticker} style={{ borderRadius: 18, backgroundColor: p.card, padding: 14, gap: 6 }}>
                    <T s={14} w="800">{h.ticker}</T><T s={12} c={p.sub}>{money(h.price)}</T>
                    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: h.change >= 0 ? p.okBg : p.errBg }}><T s={11} w="800" c={h.change >= 0 ? C.green : p.red}>{h.change >= 0 ? '▲' : '▼'} {pct(Math.abs(h.change))}</T></View>
                  </View>
                ))}
              </Grid>
              <T s={11} c={p.mute}>Variação entre as duas últimas cotações que você informou.</T>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
