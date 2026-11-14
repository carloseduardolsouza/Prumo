import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { shareCsv } from '@/state/exportCsv';
import { investApi, money, monthLabel, monthRange, dayHeading, type InvOperation } from '@/api/finance';
import { Badge, Card, Chips, Grid, I, Label, MonthNav, Notice, Pill, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';
import { useLoad } from '@/state/useLoad';

const TP: Record<InvOperation['kind'], { tag: string; cor: string; icon: string }> = {
  CONTRIBUTION: { tag: 'APORTE', cor: C.blue, icon: I.arrowUp }, BUY: { tag: 'COMPRA', cor: C.violet, icon: I.bag }, SELL: { tag: 'VENDA', cor: C.violet, icon: I.sell },
  DIVIDEND: { tag: 'PROVENTO', cor: C.cyan, icon: I.coin }, FEE: { tag: 'TAXA / IR', cor: '#E5484D', icon: I.receipt },
};
const FILTROS: [string, string][] = [['tudo', 'Tudo'], ['CONTRIBUTION', 'Aportes'], ['negoc', 'Compras e vendas'], ['DIVIDEND', 'Proventos'], ['FEE', 'Taxas e IR']];

export default function InvExtrato() {
  const p = useP();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [t, setT] = useState('tudo');
  const [erro, setErro] = useState('');
  const range = monthRange(ym.y, ym.m);
  const { data: ops, error, reload } = useLoad(() => investApi.operations({ ...range, limit: 500 }), [ym.y, ym.m]);
  const { data: o } = useLoad(investApi.overview);
  const step = (d: number) => { const x = new Date(ym.y, ym.m + d, 1); setYm({ y: x.getFullYear(), m: x.getMonth() }); };

  const shown = (ops ?? []).filter((x) => t === 'tudo' || x.kind === t || (t === 'negoc' && (x.kind === 'BUY' || x.kind === 'SELL')));
  const sum = (k: InvOperation['kind'][]) => (ops ?? []).filter((x) => k.includes(x.kind) && !x.scheduled).reduce((s, x) => s + Number(x.amount), 0);
  const grupos = shown.reduce<{ dia: string; itens: InvOperation[] }[]>((acc, r) => { const g = acc.find((x) => x.dia === r.date); g ? g.itens.push(r) : acc.push({ dia: r.date, itens: [r] }); return acc; }, []);

  const cancelar = (x: InvOperation) => Alert.alert('Cancelar operação?', x.kind === 'CONTRIBUTION' ? 'O valor volta para a carteira de origem.' : 'A posição e o custo médio serão recalculados.', [
    { text: 'Manter', style: 'cancel' },
    { text: 'Cancelar operação', style: 'destructive', onPress: async () => { try { await investApi.removeOperation(x.id); setErro(''); reload(); } catch (e) { setErro(errorMessage(e)); } } },
  ]);

  const desc = (x: InvOperation) => x.kind === 'BUY' || x.kind === 'SELL' ? `${x.ticker ?? ''} · ${x.kind === 'BUY' ? 'Compra' : 'Venda'}` : x.kind === 'DIVIDEND' ? `${x.ticker ?? ''} · ${x.dividendKind ?? 'Provento'}` : x.kind === 'CONTRIBUTION' ? `Aporte · ${x.brokerage}` : `Taxa · ${x.brokerage}`;
  const info = (x: InvOperation) => x.quantity && x.unitPrice ? `${Number(x.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 8 })} × ${money(x.unitPrice)}${Number(x.fees) ? ` + taxas ${money(x.fees)}` : ''}` : x.scheduled ? 'Agendado' : (x.note ?? x.brokerage ?? '');
  const out = (x: InvOperation) => x.kind === 'BUY' || x.kind === 'FEE';

  return (
    <Screen eyebrow="Conta investimentos" title="Extrato">
      {o && (
        <Card style={{ gap: 12 }}>
          <Label>Total aportado</Label><T s={30} w="700">{money(o.contributed)}</T><T s={12} c={p.mute}>Soma dos aportes registrados desde o início</T>
          <Row>{[['Patrimônio', money(o.patrimony)], ['Proventos 12m', money(o.dividends.last12m)], ['Caixa', money(o.cash)]].map(([l, v]) => <View key={l} style={{ flex: 1, gap: 4 }}><Label>{l}</Label><T s={13} w="800">{v}</T></View>)}</Row>
        </Card>
      )}
      <MonthNav label={monthLabel(ym.y, ym.m)} onPrev={() => step(-1)} onNext={() => step(1)} />
      {error || erro ? <Notice kind="err">{error || erro}</Notice> : null}
      <Grid cols={3} gap={10}>
        {[['Aportes', sum(['CONTRIBUTION']), C.blue], ['Proventos', sum(['DIVIDEND']), C.cyan], ['Compras', sum(['BUY']), C.violet], ['Vendas', sum(['SELL']), C.violet], ['Taxas', sum(['FEE']), '#E5484D']].map(([l, v, c]) => (
          <View key={String(l)} style={{ borderRadius: 18, backgroundColor: p.card, padding: 12, gap: 6 }}>
            <Row style={{ gap: 6 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: String(c) }} /><Label>{String(l)}</Label></Row>
            <T s={12} w="800" c={l === 'Proventos' ? C.green : p.text}>{money(Number(v))}</T>
          </View>
        ))}
      </Grid>
      <Chips value={t} onChange={setT} items={FILTROS} />
      {ops && grupos.length === 0 && <Card><T s={13} c={p.sub}>Nenhuma operação neste período.</T></Card>}
      {grupos.map((g) => (
        <View key={g.dia} style={{ gap: 2 }}>
          <Label style={{ paddingBottom: 6 }}>{dayHeading(g.dia)}</Label>
          {g.itens.map((x) => (
            <Pressable key={x.id} onLongPress={() => cancelar(x)} accessibilityHint="Pressione e segure para cancelar a operação" style={{ minHeight: 56 }}>
              <Row style={{ paddingVertical: 10 }}>
                <Badge d={TP[x.kind].icon} color={TP[x.kind].cor} />
                <View style={{ flex: 1, gap: 3 }}><T s={15} w="600">{desc(x)}</T><T s={12} c={p.mute}>{info(x)}</T></View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}><T s={15} w="700" c={x.kind === 'DIVIDEND' ? C.green : p.text}>{out(x) ? '− ' : '+ '}{money(x.amount)}</T><Pill color={TP[x.kind].cor}>{TP[x.kind].tag}</Pill></View>
              </Row>
            </Pressable>
          ))}
        </View>
      ))}
      <Pressable onPress={() => shareCsv('investments', range).catch(() => undefined)} accessibilityLabel="Exportar o mês em CSV" style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><T s={12} w="700" c={p.link}>Exportar mês em CSV</T></Pressable>
      {shown.length > 0 && <T s={11} c={p.mute}>Segure uma operação para cancelá-la.</T>}
    </Screen>
  );
}
