import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ASSET_CLASSES, COLOR_BY_CLASS, investApi, money, parseMoney, shortDate, type AssetClass } from '@/api/finance';
import { Bar, Btn, Card, Chips, Donut, Field, I, Icon, Label, Notice, Row, Screen, Sigla, T, useP } from '@/ui/kit';
import { Bars } from '@/ui/charts';
import { C, pct } from '@/ui/theme';
import { errorMessage } from '@/state/session';
import { useLoad } from '@/state/useLoad';

const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function InvCarteira() {
  const p = useP();
  const [cls, setCls] = useState<string>('todos');
  const [aporte, setAporte] = useState('');
  const [metas, setMetas] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState('');
  const { data: o, error } = useLoad(investApi.overview);
  const { data: assets } = useLoad(investApi.assets);
  const { data: brk } = useLoad(investApi.brokerages);
  const reb = useLoad(() => investApi.rebalance(Number(parseMoney(aporte)) || 0), [aporte]);

  const lista = (assets ?? []).filter((a) => (cls === 'todos' || a.assetClass === cls) && (Number(a.quantity) > 0 || Number(a.value) > 0));
  const total = Number(o?.patrimony ?? 0);

  const salvarMetas = async () => {
    try {
      const targets = (o?.allocation ?? []).concat(ASSET_CLASSES.filter(([k]) => !(o?.allocation ?? []).some((c) => c.assetClass === k)).map(([k, l]) => ({ assetClass: k, label: l, value: '0', percent: 0, target: null })))
        .map((c) => ({ assetClass: c.assetClass as AssetClass, percent: Number((metas[c.assetClass] ?? String(c.target ?? 0)).replace(',', '.')) || 0 }));
      await investApi.setTargets(targets);
      setEditando(false); setMsg('Metas salvas.'); reb.reload();
    } catch (e) { setMsg(errorMessage(e)); }
  };

  return (
    <Screen
      eyebrow="Conta investimentos" title="Carteira"
      right={<Pressable onPress={() => router.push('/inv-novo-ativo')} style={{ height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: p.accent, flexDirection: 'row', gap: 6, alignItems: 'center' }}><Icon d={I.plus} color={p.onAccent} size={16} sw={2.4} /><T s={13} w="800" c={p.onAccent}>Operação</T></Pressable>}>
      {error ? <Notice kind="err">{error}</Notice> : null}
      {!o && !error && <ActivityIndicator color={p.accent} />}
      {msg ? <Notice kind={msg.startsWith('Metas') ? 'ok' : 'err'}>{msg}</Notice> : null}

      {o && (
        <Card style={{ gap: 14 }}>
          <Label>Total do patrimônio investido</Label>
          <T s={32} w="700">{money(o.patrimony)}</T>
          <Row>{[['Aportado', money(o.contributed), p.text], ['Resultado', money(o.result, { sign: true }), Number(o.result) >= 0 ? C.green : p.red], ['Rentab.', o.resultPercent === null ? '—' : pct(o.resultPercent, 2, true), Number(o.result) >= 0 ? C.green : p.red]].map(([l, val, c]) => <View key={l} style={{ flex: 1, gap: 4 }}><Label>{l}</Label><T s={13} w="800" c={c}>{val}</T></View>)}</Row>
          {o.allocation.some((c) => c.percent > 0) && (
            <Row style={{ gap: 16 }}>
              <Donut size={130} stroke={16} gap={14} parts={o.allocation.filter((c) => c.percent > 0).map((c) => ({ f: c.percent / 100, color: COLOR_BY_CLASS[c.assetClass]! }))}><View style={{ alignItems: 'center' }}><T s={24} w="800">{(assets ?? []).filter((a) => Number(a.quantity) > 0).length}</T><T s={10} c={p.mute}>ativos</T></View></Donut>
              <View style={{ flex: 1, gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}><Label>Classe</Label><Label>Atual / meta</Label></Row>
                {o.allocation.map((c) => <Row key={c.assetClass} style={{ gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_BY_CLASS[c.assetClass] }} /><T s={12} c={p.sub} style={{ flex: 1 }}>{c.label}</T><T s={12} w="800">{pct(c.percent)}</T><T s={11} c={p.mute}>{c.target === null ? '—' : `${c.target}%`}</T></Row>)}
              </View>
            </Row>
          )}
          <T s={11} c={p.mute}>{o.methodology}</T>
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Rebalanceamento guiado</Label>
          <Pressable onPress={() => setEditando(!editando)} style={{ minHeight: 32, justifyContent: 'center' }}><T s={12} w="800" c={p.accent}>{editando ? 'Cancelar' : 'Definir metas'}</T></Pressable>
        </Row>
        {editando ? (
          <>
            {ASSET_CLASSES.slice(0, 6).map(([k, l]) => (
              <Field key={k} label={`${l} (%)`} keyboard="decimal-pad" value={metas[k] ?? String(o?.allocation.find((c) => c.assetClass === k)?.target ?? '')} onChange={(v) => setMetas({ ...metas, [k]: v })} />
            ))}
            <Btn onPress={salvarMetas}>Salvar metas</Btn>
          </>
        ) : (
          <>
            <Field label="Próximo aporte (R$)" value={aporte} onChange={setAporte} keyboard="decimal-pad" hint="Mostra onde colocar para chegar mais perto da meta, sem vender nada." />
            {reb.data && !reb.data.hasTargets && <T s={12} c={p.sub}>Defina a meta de cada classe para ver a sugestão.</T>}
            {reb.data?.hasTargets && reb.data.classes.map((c) => (
              <Row key={c.assetClass}><View style={{ flex: 1 }}><T s={14} w="700">{c.label}</T><T s={11} c={p.mute}>{pct(c.percent)} → {c.target}% · {Number(c.differenceToTarget) > 0 ? `faltam ${money(c.differenceToTarget)}` : 'acima da meta'}</T></View><T s={15} w="800" c={Number(c.suggestedContribution) > 0 ? p.accent : p.mute}>{money(c.suggestedContribution)}</T></Row>
            ))}
            {reb.data && <T s={11} c={p.mute}>{reb.data.note}</T>}
          </>
        )}
      </Card>

      {brk && brk.length > 0 && (
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}><Label>Por instituição</Label><Pressable onPress={() => router.push('/inv-corretoras')}><T s={12} w="700" c={p.accent}>Gerenciar</T></Pressable></Row>
          {brk.map((b) => (
            <View key={b.id} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}><T s={13} w="600">{b.name}</T><T s={13} w="800">{money(b.total)}</T></Row>
              <Bar f={total ? Number(b.total) / total : 0} color={p.accent} />
              <T s={11} c={p.mute}>ativos {money(b.assetsValue)} · caixa {money(b.cash)}</T>
            </View>
          ))}
        </Card>
      )}

      <View style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}><T s={20} w="700">Meus ativos</T><T s={12} c={p.mute}>{lista.length} {lista.length === 1 ? 'ativo' : 'ativos'}</T></Row>
        <Chips value={cls} onChange={setCls} items={[['todos', 'Todos'], ...ASSET_CLASSES.filter(([k]) => (assets ?? []).some((a) => a.assetClass === k)) as [string, string][]]} />
        {assets && lista.length === 0 && <Card><T s={13} c={p.sub}>Nenhum ativo em carteira. Registre uma compra para começar.</T></Card>}
        {lista.map((a) => {
          const up = Number(a.unrealized) >= 0;
          return (
            <Card key={a.id} style={{ gap: 12 }}>
              <Row>
                <Sigla t={a.ticker.slice(0, 4)} bg={COLOR_BY_CLASS[a.assetClass]!} fg={p.bg} size={42} />
                <View style={{ flex: 1 }}><T s={15} w="700" lines={1}>{a.ticker}</T><T s={11} c={p.mute} lines={1}>{a.name} · {a.classLabel}</T></View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <T s={15} w="800">{money(a.value)}</T>
                  {a.unrealizedPercent !== null && <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: up ? p.okBg : p.errBg }}><T s={11} w="800" c={up ? C.green : p.red}>{up ? '▲ ' : '▼ '}{pct(Math.abs(a.unrealizedPercent))}</T></View>}
                </View>
              </Row>
              <Row>{[['QTD', Number(a.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 8 })], ['PM', money(a.averageCost)], ['PREÇO', money(a.price)], ['% cart.', pct(a.weightPercent)]].map(([l, val]) => <View key={l} style={{ flex: 1, gap: 3 }}><Label>{l}</Label><T s={12} w="700">{val}</T></View>)}</Row>
            </Card>
          );
        })}
      </View>

      {o && (
        <Card style={{ gap: 12 }}>
          <Label>Proventos</Label>
          <T s={26} w="800">{money(o.dividends.last12m)}</T>
          <T s={12} c={p.mute}>últimos 12 meses · média {money(o.dividends.monthlyAverage)}/mês</T>
          <Bars height={90} items={o.dividends.monthly.map((m, i) => ({ label: MES[Number(m.month.slice(5, 7)) - 1]!, values: [m.amount], colors: [i === o.dividends.monthly.length - 1 ? p.accent : '#2C5852'] }))} />
          {o.dividends.upcoming.length > 0 && <Row style={{ borderTopWidth: 1, borderTopColor: p.line, paddingTop: 10 }}>{['Ativo', 'Pagamento', 'Valor'].map((h) => <Label key={h} style={{ flex: 1 }}>{h}</Label>)}</Row>}
          {o.dividends.upcoming.map((d) => (
            <Row key={d.id}><View style={{ flex: 1 }}><T s={13} w="800">{d.ticker}</T><T s={10} c={p.mute}>{d.kind ?? 'Provento'}</T></View><T s={12} c={p.sub} style={{ flex: 1 }}>{shortDate(d.date)}</T><T s={12} w="800" c={C.green} style={{ flex: 1 }}>{money(d.amount)}</T></Row>
          ))}
          <T s={11} c={p.mute}>Os proventos agendados são os que você registrou com data futura.</T>
        </Card>
      )}
    </Screen>
  );
}
