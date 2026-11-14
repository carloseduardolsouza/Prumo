import { useState } from 'react';
import { View } from 'react-native';
import { investApi, money } from '@/api/finance';
import { Card, Chips, Field, Label, Row, Screen, Seg, T, Toggle, useP } from '@/ui/kit';
import { Lines } from '@/ui/charts';
import { C } from '@/ui/theme';
import { useLoad } from '@/state/useLoad';

const mil = (n: number) => (n >= 1e6 ? 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi' : 'R$ ' + Math.round(n / 1000).toLocaleString('pt-BR') + ' mil');
const n = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0;

export default function InvSimulador() {
  const p = useP();
  const { data: o } = useLoad(investApi.overview);
  const { data: assets } = useLoad(investApi.assets);
  const [ap, setAp] = useState('2500');
  const [tx, setTx] = useState('0.1');
  const [meta, setMeta] = useState('5000');
  const [dy, setDy] = useState('6');
  const [reinv, setReinv] = useState(true);
  const [acao, setAcao] = useState('');
  const [dpaTxt, setDpaTxt] = useState('');
  const [mediaTxt, setMediaTxt] = useState('');

  // Simulação nominal mês a mês até o patrimônio que gera a renda desejada (limite de 50 anos).
  const inicio = Number(o?.patrimony ?? 0), aporte = Number(ap), taxa = n(dy) / 100 || 0.06;
  const alvo = (n(meta) * 12) / taxa;
  const anual = reinv ? Number(tx) : Math.max(Number(tx) - taxa, 0.01), r = Math.pow(1 + anual, 1 / 12) - 1;
  let P = inicio, m = 0;
  const serie = [P];
  while (P < alvo && m < 600) { P = P * (1 + r) + aporte; m++; if (m % 12 === 0) serie.push(P); }
  serie.push(P);
  const anos = m / 12, ano = new Date().getFullYear() + Math.floor((new Date().getMonth() + m) / 12);

  const held = (assets ?? []).filter((x) => Number(x.quantity) > 0);
  const sel = held.find((x) => x.id === acao) ?? held[0];
  const preco = Number(sel?.price ?? 0);
  const dpaAuto = sel ? Number(sel.dividends) / Number(sel.quantity) : 0;
  const dpa = dpaTxt ? n(dpaTxt) : dpaAuto, media = mediaTxt ? n(mediaTxt) : dpa;
  const bazin = dpa / 0.06, barsi = media / 0.06, esc = Math.max(bazin, preco, 1) * 1.1;
  const pick = <V extends string>(items: V[], v: V, set: (x: V) => void, f: (x: V) => string) => <Seg value={v} onChange={set} items={items.map((i) => [i, f(i)] as [V, string])} />;
  const brl = (x: number) => money(x);

  return (
    <Screen eyebrow="Conta investimentos" title="Simuladores" back>
      <Card style={{ gap: 12 }}>
        <Label>Simulador de renda passiva</Label>
        <T s={12} c={p.sub}>Aporte mensal</T>
        {pick(['1000', '2500', '5000', '8000'], ap, setAp, (v) => 'R$ ' + Number(v) / 1000 + ' mil')}
        <T s={12} c={p.sub}>Rentabilidade anual esperada</T>
        {pick(['0.08', '0.1', '0.12', '0.14'], tx, setTx, (v) => Math.round(Number(v) * 100) + '%')}
        <Row>
          <View style={{ flex: 1 }}><Field label="Renda desejada por mês (R$)" value={meta} onChange={setMeta} keyboard="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Dividend yield (% a.a.)" value={dy} onChange={setDy} keyboard="decimal-pad" /></View>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}><T s={14} w="600">Reinvestir proventos</T><Toggle label="Reinvestir proventos" value={reinv} onChange={setReinv} /></Row>
        <View style={{ height: 1, backgroundColor: p.line }} />
        <T s={13} c={p.sub}>Você chega a <T s={13} w="800">{brl(n(meta))}/mês</T> de renda passiva em</T>
        <T s={34} w="800" c={p.accent}>{inicio >= alvo ? 'agora' : m >= 600 ? '50+ anos' : anos.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' anos'}</T>
        <T s={12} c={p.mute}>{inicio >= alvo ? 'Seu patrimônio atual já gera essa renda no yield informado.' : m >= 600 ? 'Aumente o aporte ou a rentabilidade' : `por volta de ${ano} · ${m} aportes mensais`}</T>
        <Row>{[['Patrimônio necessário', mil(alvo)], ['Total aportado', mil(aporte * m)]].map(([l, v]) => <View key={l} style={{ flex: 1, gap: 4 }}><Label>{l}</Label><T s={15} w="800">{v}</T></View>)}</Row>
        {serie.length > 1 && <Lines height={130} series={[{ values: serie, color: p.accent, area: true }]} refLine={{ value: alvo, color: C.yellow }} />}
        <T s={11} c={C.yellow}>Linha tracejada: patrimônio necessário</T>
        <T s={11} c={p.mute}>Parte do seu patrimônio atual ({brl(inicio)}). Sem reinvestir, o crescimento usa só a valorização. Valores nominais, sem inflação. Simulação educativa.</T>
      </Card>

      <Card style={{ gap: 12 }}>
        <Label>Calculadora de preço-teto</Label>
        <T s={13} c={p.sub}>Quanto pagar por um ativo para receber 6% ao ano em proventos.</T>
        {held.length === 0 ? <T s={12} c={p.mute}>Você ainda não tem ativos com posição.</T> : (
          <>
            <Chips value={sel?.id ?? ''} onChange={(v) => { setAcao(v); setDpaTxt(''); setMediaTxt(''); }} items={held.map((x) => [x.id, x.ticker] as [string, string])} />
            <Row>
              <View style={{ flex: 1 }}><Field label="Provento por cota, 12m (R$)" value={dpaTxt} onChange={setDpaTxt} keyboard="decimal-pad" placeholder={dpaAuto.toFixed(2).replace('.', ',')} /></View>
              <View style={{ flex: 1 }}><Field label="Média de 5 anos (R$)" value={mediaTxt} onChange={setMediaTxt} keyboard="decimal-pad" placeholder={dpa.toFixed(2).replace('.', ',')} /></View>
            </Row>
            <Row>
              <View style={{ flex: 1, gap: 4 }}><Label>Bazin · 12 meses</Label><T s={20} w="800">{brl(bazin)}</T><T s={11} c={p.mute}>DPA {brl(dpa)} ÷ 6%</T></View>
              <View style={{ flex: 1, gap: 4 }}><Label>Barsi · média</Label><T s={20} w="800">{brl(barsi)}</T><T s={11} c={p.mute}>média {brl(media)} ÷ 6%</T></View>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}><T s={13} c={p.sub}>Cotação atual</T><T s={14} w="800">{brl(preco)}</T></Row>
            {barsi > 0 && (
              <>
                <View style={{ height: 10, borderRadius: 999, backgroundColor: p.track }}>
                  <View style={{ width: `${Math.min(100, (preco / esc) * 100)}%`, height: '100%', borderRadius: 999, backgroundColor: preco <= barsi ? C.green : C.orange }} />
                  <View style={{ position: 'absolute', left: `${Math.min(100, (barsi / esc) * 100)}%`, top: -3, width: 2, height: 16, backgroundColor: p.text }} />
                </View>
                <Row style={{ justifyContent: 'space-between' }}><T s={13} c={p.sub}>Margem até o teto (Barsi)</T><T s={14} w="800" c={preco <= barsi ? C.green : C.orange}>{preco <= barsi ? `${Math.round((1 - preco / barsi) * 100)}% abaixo do teto` : `${Math.round((preco / barsi - 1) * 100)}% acima do teto`}</T></Row>
              </>
            )}
          </>
        )}
        <T s={11} c={p.mute}>O provento sugerido é o total que você registrou dividido pela quantidade atual; ajuste se o período for diferente. Cálculo educativo, não é recomendação de compra.</T>
      </Card>
    </Screen>
  );
}
