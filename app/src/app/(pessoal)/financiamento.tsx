import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { debtApi, financeApi, money, parseMoney, shortDate, type ExtraSimulation, type FinInstallment, type Financing, type Wallet } from '@/api/finance';
import { Bar, Btn, Card, Chips, Field, Label, Notice, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

export default function FinanciamentoScreen() {
  const p = useP();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [f, setF] = useState<Financing | null>(null);
  const [sched, setSched] = useState<FinInstallment[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string | undefined>();
  const [todas, setTodas] = useState(false);
  const [valor, setValor] = useState('5000');
  const [modo, setModo] = useState<'REDUCE_TERM' | 'REDUCE_INSTALLMENT'>('REDUCE_TERM');
  const [sim, setSim] = useState<ExtraSimulation | null>(null);
  const [oficial, setOficial] = useState('');
  const [multa, setMulta] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const apply = (r: { financing: Financing; schedule: FinInstallment[] }) => { setF(r.financing); setSched(r.schedule); };
  const load = useCallback(async () => {
    try {
      const [r, w] = await Promise.all([debtApi.financing(id), financeApi.wallets()]);
      apply(r); setWallets(w.wallets); setWalletId((x) => x ?? w.wallets[0]?.id);
    } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const run = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); } };

  if (!f) return <Screen title="Contrato" back>{msg ? <Notice kind="err">{msg.t}</Notice> : <ActivityIndicator color={p.accent} />}</Screen>;
  const s = f.summary;
  const ativo = f.status === 'ACTIVE';
  const pend = sched.filter((i) => i.status === 'pending');
  const visiveis = todas ? sched : sched.filter((i) => i.status !== 'paid' || i.number >= (s.paidCount - 1)).slice(0, 14);

  const simular = () => run(async () => {
    const amount = parseMoney(valor);
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) return setMsg({ ok: false, t: 'Informe o valor da amortização.' });
    setSim((await debtApi.extra(id, { amount, mode: modo, simulate: true })).simulation ?? null); setMsg(null);
  });
  const aplicar = () => run(async () => {
    if (!walletId) return setMsg({ ok: false, t: 'Escolha a conta.' });
    await debtApi.extra(id, { amount: parseMoney(valor), mode: modo, walletId, simulate: false });
    setSim(null); setMsg({ ok: true, t: 'Amortização aplicada. O cronograma foi recalculado.' }); await load();
  });

  return (
    <Screen eyebrow={[f.creditor, f.system].filter(Boolean).join(' · ')} title={f.name} back>
      <Card style={{ gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}><Label>Saldo devedor estimado</Label><T s={10} w="800" c={ativo ? C.green : p.mute}>{ativo ? 'ATIVO' : 'QUITADO'}</T></Row>
        <T s={30} w="700">{money(s.estimatedBalance)}</T>
        <T s={11} c={p.mute}>{s.estimateNote}</T>
        {s.officialBalance && <T s={12} c={p.sub}>Saldo informado pelo credor: <T s={12} w="800">{money(s.officialBalance)}</T> (diferença {money(s.divergence ?? 0)})</T>}
        <Row style={{ justifyContent: 'space-between' }}><T s={12} c={p.sub}>{s.paidCount} de {s.totalCount} parcelas pagas</T><T s={12} w="800">{s.totalCount ? Math.round((s.paidCount / s.totalCount) * 100) : 0}%</T></Row>
        <Bar f={s.totalCount ? s.paidCount / s.totalCount : 0} color={C.red} h={10} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
          {[['Parcela', s.nextDue ? money(s.nextDue.total) : '—'], ['Amortizado', money(s.principalAmortized)], ['Juros pagos', money(s.interestPaid)], ['Encargos', money(Number(s.feesPaid) + Number(s.lateFeesPaid))], ['Próxima', s.nextDue ? shortDate(s.nextDue.dueDate) : '—'], ['Quitação', s.estimatedPayoffDate ? shortDate(s.estimatedPayoffDate) : '—']].map(([l, v]) => <View key={l} style={{ width: '33.3%', gap: 4 }}><Label>{l}</Label><T s={13} w="800">{v}</T></View>)}
        </View>
      </Card>

      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}

      {ativo && s.nextDue && (
        <Card style={{ gap: 12 }}>
          <T s={15} w="700">Pagar parcela {s.nextDue.number}</T>
          <T s={13} c={p.sub}>{money(s.nextDue.total)} · vence {shortDate(s.nextDue.dueDate)}{s.nextDue.overdue ? ' (atrasada)' : ''}</T>
          <View style={{ gap: 8 }}><Label>Pagar com</Label><Chips value={walletId ?? ''} onChange={setWalletId} items={wallets.map((w) => [w.id, w.name] as [string, string])} /></View>
          {s.nextDue.overdue && <Field label="Multa e juros de atraso (opcional)" value={multa} onChange={setMulta} keyboard="decimal-pad" hint="Entram como despesa à parte." />}
          <Btn onPress={() => run(async () => { if (!walletId) return; apply(await debtApi.payInstallment(id, s.nextDue!.number, { walletId, ...(multa ? { lateFee: parseMoney(multa) } : {}) })); setMulta(''); setMsg({ ok: true, t: 'Parcela paga.' }); })}>Registrar pagamento</Btn>
        </Card>
      )}

      {ativo && f.scheduleSource === 'CALCULATED' && pend.length > 1 && (
        <Card style={{ gap: 12 }}>
          <Label>Simular amortização extra</Label>
          <Seg value={modo} onChange={(m) => { setModo(m); setSim(null); }} items={[['REDUCE_TERM', 'Manter parcela'], ['REDUCE_INSTALLMENT', 'Manter prazo']]} />
          <Chips value={valor} onChange={(v) => { setValor(v); setSim(null); }} items={['2000', '5000', '10000', '15000'].map((v) => [v, `R$ ${Number(v) / 1000} mil`] as [string, string])} />
          <Btn kind="ghost" onPress={simular}>Simular</Btn>
          {sim && (
            <View style={{ gap: 10 }}>
              <Row><View style={{ flex: 1 }}><Label>Economia de juros</Label><T s={18} w="800" c={C.green}>{money(sim.interestSaved, {})}</T></View><View style={{ flex: 1 }}><Label>{modo === 'REDUCE_TERM' ? 'Termina antes' : 'Nova parcela'}</Label><T s={18} w="800">{modo === 'REDUCE_TERM' ? `${sim.monthsSaved} meses` : money(sim.newPayment)}</T></View></Row>
              <T s={11} c={p.mute}>Simulação estimada pelo cronograma com a taxa do contrato.</T>
              <Btn onPress={aplicar}>Aplicar amortização</Btn>
            </View>
          )}
        </Card>
      )}

      <View style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}><T s={20} w="700">Cronograma</T><Pressable onPress={() => setTodas(!todas)} style={{ minHeight: 44, justifyContent: 'center' }}><T s={12} w="700" c={p.link}>{todas ? 'Ver menos' : 'Ver todas'}</T></Pressable></Row>
        {visiveis.map((i) => (
          <Row key={i.number} style={{ paddingVertical: 6, opacity: i.status === 'canceled_payoff' ? 0.5 : 1 }}>
            <T s={12} w="800" style={{ width: 44 }}>{i.number}/{i.of}</T>
            <View style={{ flex: 1 }}><T s={13} w="600">{shortDate(i.dueDate)}</T><T s={11} c={p.mute}>principal {money(i.principal)} · juros {money(i.interest)}</T></View>
            <View style={{ alignItems: 'flex-end' }}>
              <T s={13} w="700" c={i.status === 'paid' ? C.green : p.text}>{money(i.total)}</T>
              {i.status === 'paid' ? <Pressable onPress={() => run(async () => apply(await debtApi.cancelInstallment(id, i.number)))} style={{ minHeight: 30, justifyContent: 'center' }}><T s={10} w="700" c={p.mute}>paga · desfazer</T></Pressable> : <T s={10} c={p.mute}>{i.status === 'canceled_payoff' ? 'quitada' : 'pendente'}</T>}
            </View>
          </Row>
        ))}
      </View>

      <Card style={{ gap: 10 }}>
        <T s={15} w="700">Saldo oficial do credor</T>
        <Field label="Informe o saldo do extrato do credor (R$)" value={oficial} onChange={setOficial} keyboard="decimal-pad" />
        <Btn kind="ghost" onPress={() => run(async () => { const r = await debtApi.officialBalance(id, parseMoney(oficial)); setF(r.financing); setOficial(''); setMsg({ ok: true, t: 'Saldo oficial registrado para comparação.' }); await load(); })}>Registrar</Btn>
      </Card>

      {ativo && walletId && (
        <Pressable onPress={() => run(async () => { await debtApi.payoff(id, walletId); setMsg({ ok: true, t: 'Contrato quitado. As parcelas futuras foram canceladas por quitação.' }); await load(); })} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
          <T s={14} w="800" c={p.red}>Quitar contrato ({money(s.estimatedBalance)})</T>
        </Pressable>
      )}
      <Pressable onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><T s={13} w="700" c={p.sub}>Voltar</T></Pressable>
    </Screen>
  );
}
