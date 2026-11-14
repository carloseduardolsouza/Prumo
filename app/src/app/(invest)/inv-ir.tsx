import { useState } from 'react';
import { View } from 'react-native';
import { investApi, money, shortDate } from '@/api/finance';
import { Card, Grid, Icon, I, Label, Notice, Pill, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { Bars } from '@/ui/charts';
import { C } from '@/ui/theme';
import { useLoad } from '@/state/useLoad';

const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const GRUPO: Record<string, string> = { STOCK: 'Ações', FII: 'FIIs', ETF: 'ETFs e BDRs', CRYPTO: 'Cripto' };

export default function InvIR() {
  const p = useP();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const { data: t, error } = useLoad(() => investApi.tax(Number(year)), [year]);
  const darfs = (t?.months ?? []).filter((m) => Number(m.tax) > 0);
  const stocks = Array.from({ length: 12 }, (_, i) => (t?.months ?? []).filter((m) => m.group === 'STOCK' && m.month === `${year}-${String(i + 1).padStart(2, '0')}`).reduce((s, m) => s + Number(m.sold), 0));

  return (
    <Screen eyebrow="Conta investimentos" title="Imposto de Renda" back>
      <Seg value={year} onChange={setYear} items={[String(thisYear - 1), String(thisYear)].map((y) => [y, y] as [string, string])} />
      {error ? <Notice kind="err">{error}</Notice> : null}
      {t && (
        <>
          {darfs.length > 0 && (
            <Card style={{ backgroundColor: p.warnBg, gap: 8 }}>
              <Row><Icon d={I.warn} color={C.yellow} /><T s={15} w="800" c={C.yellow}>DARF estimado · {money(t.totalTax)}</T></Row>
              {darfs.map((m) => <T key={m.month + m.group} s={13} c={p.sub}>{MES[Number(m.month.slice(5)) - 1]}/{m.month.slice(2, 4)} · {GRUPO[m.group]}: {money(m.tax)} · código {m.darfCode} · vence {m.darfDueDate ? shortDate(m.darfDueDate) : ''}</T>)}
              <T s={11} c={p.mute}>O app não gera nem paga o DARF: emita no Sicalc da Receita com estes valores.</T>
            </Card>
          )}

          <Card style={{ gap: 12 }}>
            <Label>Resumo fiscal {t.year}</Label>
            <Grid cols={2} gap={14}>
              {[['Imposto estimado', money(t.totalTax)], ['Dividendos e rendimentos', money(t.income.dividends)], ['JCP (trib. exclusiva)', money(t.income.jcp)], ['Outros proventos', money(t.income.other)]].map(([l, val]) => <View key={l} style={{ gap: 4 }}><Label>{l}</Label><T s={17} w="800">{val}</T></View>)}
            </Grid>
          </Card>

          <Card style={{ gap: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}><Label>Vendas de ações no mês</Label><T s={11} c={p.mute}>isenção até R$ 20 mil</T></Row>
            <Bars height={130} max={Math.max(30000, ...stocks)} refLine={{ value: 20000, color: C.yellow }} items={stocks.map((x, i) => ({ label: MES[i]!, values: [Math.max(x, 300)], colors: [x > 20000 ? C.orange : x ? C.cyan : p.track] }))} />
            <Row style={{ gap: 12 }}>{[[C.cyan, 'Isento'], [C.orange, 'Tributado (15%)'], [C.yellow, 'R$ 20 mil']].map(([c, l]) => <Row key={l} style={{ gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><T s={11} c={p.sub}>{l}</T></Row>)}</Row>
          </Card>

          <View style={{ gap: 8 }}>
            <T s={20} w="700">Apuração mensal</T>
            {t.months.length === 0 && <Card><T s={13} c={p.sub}>Nenhuma venda de ações, FIIs, ETFs ou cripto em {t.year}.</T></Card>}
            {t.months.map((m) => (
              <Card key={m.month + m.group} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: p.card2, alignItems: 'center', justifyContent: 'center' }}><T s={12} w="800">{MES[Number(m.month.slice(5)) - 1]!.toUpperCase()}</T></View>
                <View style={{ flex: 1, gap: 2 }}><T s={14} w="700">{GRUPO[m.group]} · vendas {money(m.sold)}</T><T s={11} c={p.mute}>{Number(m.gain) >= 0 ? 'Lucro' : 'Prejuízo'} {money(Math.abs(Number(m.gain)))}{m.exempt ? ' · isento' : ` · alíquota ${m.rate}%`}{Number(m.lossCarried) > 0 ? ` · prejuízo a compensar ${money(m.lossCarried)}` : ''}</T></View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}><T s={14} w="800">{money(m.tax)}</T><Pill color={m.exempt ? '#8A9099' : Number(m.tax) > 0 ? C.yellow : C.green} bg={m.exempt ? p.card2 : Number(m.tax) > 0 ? p.warnBg : p.okBg}>{m.exempt ? 'ISENTO' : Number(m.tax) > 0 ? 'A PAGAR' : 'SEM IMPOSTO'}</Pill></View>
              </Card>
            ))}
          </View>

          <Card style={{ gap: 12 }}>
            <Label>Bens e direitos · posição em 31/12/{t.year}</Label>
            {t.holdings.length === 0 && <T s={12} c={p.sub}>Sem posições nessa data.</T>}
            {t.holdings.map((h) => <Row key={h.ticker}><View style={{ flex: 1 }}><T s={14} w="700">{h.ticker}</T><T s={11} c={p.mute}>{Number(h.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 8 })} · custo de aquisição</T></View><T s={14} w="800">{money(h.cost)}</T></Row>)}
            <T s={11} c={p.mute}>{t.note}</T>
          </Card>
        </>
      )}
    </Screen>
  );
}
