import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { debtApi, financeApi, money, parseMoney, shortDate, type ConsortiumDetail, type Wallet } from '@/api/finance';
import { Bar, Btn, Card, Chips, Field, Label, Notice, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const EVENTOS: [string, string][] = [['BID', 'Lance'], ['CONTEMPLATION', 'Contemplação'], ['RELEASE', 'Liberação da carta'], ['USE', 'Uso da carta']];

export default function ConsorcioScreen() {
  const p = useP();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<ConsortiumDetail | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string | undefined>();
  const [aba, setAba] = useState<'parcelas' | 'carta' | 'eventos'>('parcelas');
  const [alvo, setAlvo] = useState<'LETTER' | 'INSTALLMENT'>('LETTER');
  const [modo, setModo] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [valor, setValor] = useState('');
  const [evento, setEvento] = useState('BID');
  const [evValor, setEvValor] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, w] = await Promise.all([debtApi.consortium(id), financeApi.wallets()]);
      setD(r); setWallets(w.wallets); setWalletId((x) => x ?? w.wallets[0]?.id);
    } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const run = async (fn: () => Promise<ConsortiumDetail>, ok: string) => {
    try { setD(await fn()); setMsg({ ok: true, t: ok }); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); }
  };

  if (!d) return <Screen title="Consórcio" back>{msg ? <Notice kind="err">{msg.t}</Notice> : <ActivityIndicator color={p.accent} />}</Screen>;
  const c = d.consortium, s = c.summary;
  const next = s.nextDue;

  return (
    <Screen eyebrow={[c.administrator, c.groupNumber ? `Grupo ${c.groupNumber}` : null].filter(Boolean).join(' · ')} title={c.name} back>
      <Card style={{ gap: 12 }}>
        <Label>Carta atual</Label>
        <T s={30} w="700">{money(s.currentLetter)}</T>
        {s.letterGrowthPercent !== 0 && <T s={12} c={C.green}>{s.letterGrowthPercent > 0 ? '+' : ''}{s.letterGrowthPercent}% desde a contratação</T>}
        <Bar f={s.paidOverLetterPercent / 100} color={C.blue} h={10} />
        <Row><View style={{ flex: 1 }}><Label>Total pago</Label><T s={14} w="800">{money(s.totalPaid)}</T></View><View style={{ flex: 1 }}><Label>A pagar</Label><T s={14} w="800">{money(s.remainingObligations)}</T></View><View style={{ flex: 1 }}><Label>Parcelas</Label><T s={14} w="800">{s.paidCount}/{s.totalCount}</T></View></Row>
        <T s={11} c={p.mute}>{s.note}</T>
      </Card>

      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}

      {c.status !== 'CLOSED' && next && (
        <Card style={{ gap: 12 }}>
          <T s={15} w="700">Pagar parcela {next.number}</T>
          <T s={13} c={p.sub}>{money(next.amount)} · vence {shortDate(next.dueDate)}</T>
          <View style={{ gap: 8 }}><Label>Pagar com</Label><Chips value={walletId ?? ''} onChange={setWalletId} items={wallets.map((w) => [w.id, w.name] as [string, string])} /></View>
          <Btn onPress={() => walletId && run(() => debtApi.payConsortium(id, { walletId, numbers: [next.number] }), 'Parcela paga.')}>Registrar pagamento</Btn>
        </Card>
      )}

      <Seg value={aba} onChange={setAba} items={[['parcelas', 'Parcelas'], ['carta', 'Reajustes'], ['eventos', 'Eventos']]} />

      {aba === 'parcelas' && d.schedule.map((i) => (
        <Row key={i.number} style={{ paddingVertical: 6 }}>
          <T s={12} w="800" style={{ width: 44 }}>{i.number}</T>
          <View style={{ flex: 1 }}><T s={13} w="600">{shortDate(i.dueDate)}</T></View>
          <View style={{ alignItems: 'flex-end' }}><T s={13} w="700" c={i.status === 'paid' ? C.green : p.text}>{money(i.amount)}</T><T s={10} c={p.mute}>{i.status === 'paid' ? 'paga' : 'pendente'}</T></View>
        </Row>
      ))}

      {aba === 'carta' && (
        <>
          <Card style={{ gap: 12 }}>
            <Label>Registrar reajuste</Label>
            <Chips value={alvo} onChange={setAlvo} items={[['LETTER', 'Carta'], ['INSTALLMENT', 'Parcela']]} />
            <Chips value={modo} onChange={setModo} items={[['PERCENT', 'Percentual (%)'], ['AMOUNT', 'Valor (R$)']]} />
            <Field label={modo === 'PERCENT' ? 'Percentual (negativo reduz)' : 'Valor somado (R$)'} value={valor} onChange={setValor} keyboard="decimal-pad" />
            <Btn onPress={() => run(() => debtApi.adjustConsortium(id, { target: alvo, mode: modo, value: parseMoney(valor) }).then((r) => { setValor(''); return r; }), 'Reajuste registrado.')}>Aplicar reajuste</Btn>
          </Card>
          {d.adjustments.map((a) => (
            <Row key={a.id} style={{ paddingVertical: 6 }}>
              <View style={{ flex: 1 }}><T s={13} w="600">{a.target === 'LETTER' ? 'Carta' : 'Parcela'} · {shortDate(a.effectiveDate)}</T><T s={11} c={p.mute}>{a.source === 'ADMINISTRATOR' ? 'administradora' : 'informado por você'}</T></View>
              <T s={12} w="700">{money(a.previous)} → {money(a.next)}</T>
            </Row>
          ))}
        </>
      )}

      {aba === 'eventos' && (
        <>
          <Card style={{ gap: 12 }}>
            <Label>Registrar evento</Label>
            <Chips value={evento} onChange={setEvento} items={EVENTOS} />
            <Field label="Valor (opcional)" value={evValor} onChange={setEvValor} keyboard="decimal-pad" />
            <T s={11} c={p.mute}>Eventos não movimentam suas contas. Só o pagamento das parcelas altera saldo.</T>
            <Btn onPress={() => run(() => debtApi.consortiumEvent(id, { kind: evento as 'BID', ...(evValor ? { amount: parseMoney(evValor) } : {}) }).then((r) => { setEvValor(''); return r; }), 'Evento registrado.')}>Registrar</Btn>
          </Card>
          {d.events.map((e) => (
            <Row key={e.id} style={{ paddingVertical: 6 }}>
              <View style={{ flex: 1 }}><T s={13} w="600">{EVENTOS.find(([k]) => k === e.kind)?.[1] ?? e.kind}</T><T s={11} c={p.mute}>{shortDate(e.date)}</T></View>
              {e.amount && <T s={13} w="700">{money(e.amount)}</T>}
            </Row>
          ))}
        </>
      )}
    </Screen>
  );
}
