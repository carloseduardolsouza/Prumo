import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { COLOR_BY_CLASS, investApi, money, parseMoney } from '@/api/finance';
import { Badge, Btn, Card, Chips, Field, I, Label, Notice, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { Bars } from '@/ui/charts';
import { C, pct } from '@/ui/theme';
import { errorMessage } from '@/state/session';
import { useLoad } from '@/state/useLoad';

export default function InvRadar() {
  const p = useP();
  const { data: alerts, reload } = useLoad(investApi.alerts);
  const { data: assets, error } = useLoad(investApi.assets);
  const [ativo, setAtivo] = useState('');
  const [dir, setDir] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [preco, setPreco] = useState('');
  const [erro, setErro] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const held = (assets ?? []).filter((x) => !x.archived);
  const selected = ativo || held[0]?.id || '';
  const A = held.find((x) => x.id === (a || held[0]?.id)), B = held.find((x) => x.id === (b || held[1]?.id));

  const criar = async () => {
    if (!selected || !Number(parseMoney(preco))) return setErro('Escolha o ativo e informe o preço-alvo.');
    try { await investApi.addAlert({ investmentId: selected, direction: dir, price: parseMoney(preco) }); setPreco(''); setErro(''); await reload(); } catch (e) { setErro(errorMessage(e)); }
  };
  const num = (x?: string | number | null) => Number(x ?? 0);
  // d > 0 favorece A, d < 0 favorece B, 0 sem destaque
  const linhas: [string, string, string, number][] = A && B ? [
    ['Valor', money(A.value), money(B.value), 0], ['Preço médio', money(A.averageCost), money(B.averageCost), 0], ['Preço atual', money(A.price), money(B.price), 0],
    ['Resultado', pct(A.unrealizedPercent ?? 0, 1, true), pct(B.unrealizedPercent ?? 0, 1, true), (A.unrealizedPercent ?? 0) - (B.unrealizedPercent ?? 0)],
    ['Proventos', money(A.dividends), money(B.dividends), num(A.dividends) - num(B.dividends)], ['% da carteira', pct(A.weightPercent), pct(B.weightPercent), 0],
  ] : [];

  return (
    <Screen eyebrow="Conta investimentos" title="Radar e alertas" back>
      {error ? <Notice kind="err">{error}</Notice> : null}
      <Card style={{ gap: 12 }}>
        <Label>Novo alerta de preço</Label>
        {held.length === 0 ? <T s={12} c={p.sub}>Cadastre um ativo para criar alertas.</T> : (
          <>
            <Chips value={selected} onChange={setAtivo} items={held.map((x) => [x.id, x.ticker] as [string, string])} />
            <Seg value={dir} onChange={setDir} items={[['ABOVE', 'Subir até'], ['BELOW', 'Cair até']]} />
            <Field label="Preço-alvo (R$)" value={preco} onChange={setPreco} keyboard="decimal-pad" hint="O alerta dispara quando você atualizar a cotação e ela cruzar o alvo." />
            {erro ? <Notice kind="err">{erro}</Notice> : null}
            <Btn onPress={criar}>Criar alerta</Btn>
          </>
        )}
      </Card>

      <Card style={{ gap: 8 }}>
        <Label>Alertas</Label>
        {alerts?.length === 0 && <T s={12} c={p.sub}>Nenhum alerta criado.</T>}
        {alerts?.map((x) => (
          <Row key={x.id} style={{ minHeight: 56 }}>
            <Badge d={x.direction === 'ABOVE' ? I.up : I.sell} color={x.triggered ? C.green : C.yellow} size={40} bg={p.card2} />
            <View style={{ flex: 1 }}><T s={14} w="700">{x.ticker}</T><T s={12} c={p.mute}>{x.direction === 'ABOVE' ? 'Preço acima de' : 'Preço abaixo de'} {money(x.price)}{x.triggered ? ' · atingido' : ''}</T></View>
            <Pressable accessibilityLabel={`Remover alerta ${x.ticker}`} onPress={async () => { await investApi.removeAlert(x.id).catch(() => undefined); reload(); }} style={{ minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' }}><T s={12} w="700" c={p.red}>Remover</T></Pressable>
          </Row>
        ))}
        <T s={11} c={p.mute}>Os avisos de proventos chegam como notificação quando a data se aproxima.</T>
      </Card>

      {held.length >= 2 && A && B && (
        <Card style={{ gap: 12 }}>
          <Label>Comparador de ativos da carteira</Label>
          <Chips value={A.id} onChange={setA} items={held.map((x) => [x.id, x.ticker] as [string, string])} />
          <Chips value={B.id} onChange={setB} items={held.map((x) => [x.id, x.ticker] as [string, string])} />
          <Row style={{ justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}><T s={18} w="800" c={COLOR_BY_CLASS[A.assetClass]}>{A.ticker}</T><T s={11} c={p.mute}>{A.classLabel}</T></View><T s={12} w="800" c={p.mute}>VS</T>
            <View style={{ alignItems: 'center' }}><T s={18} w="800" c={C.yellow}>{B.ticker}</T><T s={11} c={p.mute}>{B.classLabel}</T></View>
          </Row>
          {linhas.map(([l, x, y, d]) => (
            <Row key={l} style={{ justifyContent: 'space-between' }}>
              <T s={13} w={d > 0 ? '800' : '600'} c={d > 0 ? C.green : p.text} style={{ flex: 1 }}>{x}</T>
              <T s={10} w="700" c={p.mute} caps style={{ flex: 1.2, textAlign: 'center' }}>{l}</T>
              <T s={13} w={d < 0 ? '800' : '600'} c={d < 0 ? C.green : p.text} style={{ flex: 1, textAlign: 'right' }}>{y}</T>
            </Row>
          ))}
          <Bars height={80} items={[{ label: 'Proventos', values: [num(A.dividends), num(B.dividends)], colors: [p.accent, C.yellow] }, { label: 'Resultado', values: [Math.max(0, num(A.unrealized)), Math.max(0, num(B.unrealized))], colors: [p.accent, C.yellow] }]} />
          <T s={11} c={p.mute}>Compara só o que você registrou (custo, cotações manuais e proventos). Indicadores de mercado, como P/L e P/VP, exigem um provedor de dados e ficam para uma versão futura.</T>
        </Card>
      )}
    </Screen>
  );
}
