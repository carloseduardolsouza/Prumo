import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { INVOICE_LABEL, cardApi, financeApi, invoiceLabel, money, parseMoney, shortDate, today, type CreditCard, type Invoice, type InvoiceDetail, type Wallet } from '@/api/finance';
import { Btn, Card, Chips, Field, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { Bars } from '@/ui/charts';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const MES3 = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export default function Fatura() {
  const p = useP();
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const [card, setCard] = useState<CreditCard | null>(null);
  const [lista, setLista] = useState<Invoice[]>([]);
  const [sel, setSel] = useState<string | undefined>();
  const [det, setDet] = useState<InvoiceDetail | null>(null);
  const [futuras, setFuturas] = useState<{ label: string; v: number }[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string | undefined>();
  const [modo, setModo] = useState<'total' | 'minimo' | 'outro'>('total');
  const [outro, setOutro] = useState('');
  const [encargos, setEncargos] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, invs, w, f] = await Promise.all([cardApi.get(cardId), cardApi.invoices(cardId, -3, 3), financeApi.wallets(), cardApi.future(cardId)]);
      setCard(c); setLista(invs); setWallets(w.wallets); setWalletId((x) => x ?? w.wallets[0]?.id);
      setFuturas(f.months.slice(0, 6).map((m) => ({ label: MES3[m.refMonth - 1]!, v: Number(m.amount) })));
      setSel((s) => s ?? invs.find((i) => i.current)?.id ?? invs[0]?.id);
    } catch (e) {
      setMsg({ ok: false, t: errorMessage(e) });
    }
  }, [cardId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Faturas ainda sem registro (id vazio) não têm detalhe: mostramos o resumo do ciclo.
  const invAtual = lista.find((i) => i.id === sel) ?? lista.find((i) => i.current);
  useEffect(() => {
    if (!invAtual?.id) return setDet(null);
    cardApi.invoice(invAtual.id).then(setDet).catch((e) => setMsg({ ok: false, t: errorMessage(e) }));
  }, [invAtual?.id, lista]);

  const valorPagar = !invAtual ? '0' : modo === 'total' ? invAtual.remaining : modo === 'minimo' ? invAtual.minimumPayment ?? invAtual.remaining : parseMoney(outro);

  const pagar = async () => {
    if (!invAtual?.id || !walletId) return setMsg({ ok: false, t: 'Escolha a conta de pagamento.' });
    if (!/^\d+(\.\d{1,2})?$/.test(valorPagar) || Number(valorPagar) <= 0) return setMsg({ ok: false, t: 'Informe o valor do pagamento.' });
    try {
      const fees = parseMoney(encargos);
      await cardApi.pay(invAtual.id, { walletId, amount: valorPagar, date: today(), ...(fees && Number(fees) > 0 ? { fees } : {}) });
      setOutro(''); setEncargos(''); setModo('total');
      setMsg({ ok: true, t: 'Pagamento registrado. O saldo da conta e da fatura foram atualizados.' });
      await load();
    } catch (e) {
      setMsg({ ok: false, t: errorMessage(e) });
    }
  };
  const cancelarPagamento = async (id: string) => {
    try { await cardApi.cancelPayment(id); setMsg({ ok: true, t: 'Pagamento cancelado e estornado.' }); await load(); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); }
  };

  if (!card) return <Screen title="Fatura" back>{msg ? <Notice kind="err">{msg.t}</Notice> : <ActivityIndicator color={p.accent} />}</Screen>;

  const pagavel = invAtual && Number(invAtual.remaining) > 0 && invAtual.id;
  return (
    <Screen eyebrow={`${card.name}${card.last4 ? ` · •••• ${card.last4}` : ''}`} title="Fatura" back>
      <Chips value={invAtual?.id || `${invAtual?.refYear}-${invAtual?.refMonth}`} onChange={(id) => setSel(id)}
        items={lista.map((i) => [i.id || `${i.refYear}-${i.refMonth}`, `${invoiceLabel(i)} · ${INVOICE_LABEL[i.status]}`] as [string, string])} />

      {invAtual && (
        <Card style={{ gap: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}><Label>Fatura {INVOICE_LABEL[invAtual.status]}</Label><T s={12} c={p.mute}>vence {shortDate(invAtual.dueDate)}</T></Row>
          <T s={34} w="700">{money(invAtual.total)}</T>
          {Number(invAtual.paid) > 0 && <T s={13} c={C.green}>Pago {money(invAtual.paid)} · falta {money(invAtual.remaining)}</T>}
          <Row>{[['Fechamento', shortDate(invAtual.closingDate)], ['Melhor dia', shortDate(new Date(new Date(`${invAtual.closingDate}T00:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10))], ['Mínimo', invAtual.minimumPayment ? money(invAtual.minimumPayment) : '—']].map(([l, v]) => <View key={l} style={{ flex: 1, gap: 4 }}><Label>{l}</Label><T s={13} w="800">{v}</T></View>)}</Row>
        </Card>
      )}

      {pagavel && (
        <Card style={{ gap: 12 }}>
          <Label>Pagar fatura</Label>
          {([['total', 'Valor total', 'Quita a fatura', invAtual!.remaining], ['minimo', 'Pagamento mínimo', 'O restante pode gerar juros no banco', invAtual!.minimumPayment], ['outro', 'Outro valor', 'Saldo restante fica em aberto', null]] as const)
            .filter(([k, , , v]) => k === 'outro' || v)
            .map(([k, l, info, v]) => (
              <Pressable key={k} accessibilityState={{ selected: modo === k }} onPress={() => setModo(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: modo === k ? p.text : p.line }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: p.sub, alignItems: 'center', justifyContent: 'center' }}>{modo === k && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.text }} />}</View>
                <View style={{ flex: 1 }}><T s={14} w="700">{l}</T><T s={11} c={p.mute}>{info}</T></View>
                <T s={14} w="800">{v ? money(v) : 'Definir'}</T>
              </Pressable>
            ))}
          {modo === 'outro' && <Field label="Valor (R$)" value={outro} onChange={setOutro} keyboard="decimal-pad" />}
          <View style={{ gap: 8 }}><Label>Pagar com</Label><Chips value={walletId ?? ''} onChange={setWalletId} items={wallets.map((w) => [w.id, `${w.name} · ${money(w.balance)}`] as [string, string])} /></View>
          <Field label="Juros e encargos pagos junto (opcional)" value={encargos} onChange={setEncargos} keyboard="decimal-pad" hint="Entram como despesa à parte; a compra não é contada duas vezes." />
          <Btn onPress={pagar}>Registrar pagamento</Btn>
          <T s={11} c={p.mute}>O pagamento só baixa a fatura e o saldo da conta. As compras já contaram como despesa quando foram feitas.</T>
        </Card>
      )}
      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}

      {det && det.payments.filter((x) => !x.canceled).length > 0 && (
        <View style={{ gap: 4 }}>
          <T s={20} w="700">Pagamentos</T>
          {det.payments.filter((x) => !x.canceled).map((pg) => (
            <Row key={pg.id} style={{ paddingVertical: 8 }}>
              <View style={{ flex: 1 }}><T s={14} w="600">{money(pg.amount)}</T><T s={12} c={p.mute}>{shortDate(pg.date)}</T></View>
              <Pressable onPress={() => cancelarPagamento(pg.id)} style={{ minHeight: 44, justifyContent: 'center' }}><T s={12} w="700" c={p.red}>Cancelar</T></Pressable>
            </Row>
          ))}
        </View>
      )}

      <View style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <T s={20} w="700">Compras do ciclo</T>
          <Pressable onPress={() => router.push({ pathname: '/nova-movimentacao', params: { cartao: cardId } })} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="700" c={p.link}>Nova compra</T></Pressable>
        </Row>
        {(!det || det.purchases.length === 0) && <T s={13} c={p.mute}>Nenhuma compra nesta fatura.</T>}
        {det?.purchases.map((c) => (
          <Pressable key={c.installmentId} onPress={() => router.push({ pathname: '/compra', params: { id: c.purchaseId } })}>
            <Row style={{ paddingVertical: 8 }}>
              <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: p.card, alignItems: 'center', justifyContent: 'center' }}>
                <T s={15} w="800">{c.date.slice(8, 10)}</T><T s={9} w="700" c={p.mute}>{MES3[Number(c.date.slice(5, 7)) - 1]}</T>
              </View>
              <View style={{ flex: 1 }}><T s={15} w="600" lines={1}>{c.description}</T><T s={12} c={p.mute}>{c.establishment ?? (c.refund ? 'Estorno' : 'Compra')}</T></View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <T s={15} w="700" c={Number(c.amount) < 0 ? C.green : p.text}>{Number(c.amount) < 0 ? '+ ' : ''}{money(Math.abs(Number(c.amount)))}</T>
                {c.total > 1 && <T s={11} w="700" c={p.link}>{c.number}/{c.total}</T>}
              </View>
            </Row>
          </Pressable>
        ))}
      </View>

      {futuras.length > 0 && (
        <Card style={{ gap: 14 }}>
          <Label>Parcelas futuras</Label>
          <T s={24} w="800">{money(futuras.reduce((s, f) => s + f.v, 0))}</T>
          <Bars height={90} items={futuras.map((f) => ({ label: f.label, values: [f.v], colors: ['#A55BE8'] }))} />
          <T s={11} c={p.mute}>Já comprometem o limite do cartão (política {card.limitPolicy === 'CONSERVATIVE' ? 'conservadora' : 'só faturas'}).</T>
        </Card>
      )}
    </Screen>
  );
}
