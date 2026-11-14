import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { cardApi, money, parseMoney, shortDate, type Purchase } from '@/api/finance';
import { Btn, Card, Field, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

// Detalhe de uma compra no cartão: parcelas, cancelar (fatura aberta) ou estornar (fatura fechada).
export default function Compra() {
  const p = useP();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setC] = useState<Purchase | null>(null);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => { cardApi.purchase(id).then(setC).catch((e) => setMsg({ ok: false, t: errorMessage(e) })); }, [id]);
  const run = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); } };

  if (!c) return <Screen title="Compra" back>{msg ? <Notice kind="err">{msg.t}</Notice> : <ActivityIndicator color={p.accent} />}</Screen>;
  const negativo = Number(c.totalAmount) < 0;

  return (
    <Screen eyebrow={c.cardName} title={c.description} back>
      <Card style={{ gap: 10 }}>
        <Label>{negativo ? 'Estorno' : 'Valor total'}</Label>
        <T s={32} w="800" c={negativo ? C.green : p.text}>{money(Math.abs(Number(c.totalAmount)))}</T>
        <T s={12} c={p.mute}>Comprado em {shortDate(c.purchaseDate)}{c.installments > 1 ? ` · ${c.installments}x` : ' · à vista'}{c.canceled ? ' · cancelada' : ''}</T>
        {c.reason ? <T s={12} c={p.sub}>Motivo: {c.reason}</T> : null}
      </Card>

      <View style={{ gap: 4 }}>
        <T s={20} w="700">Parcelas</T>
        {c.items.map((i) => (
          <Row key={i.id} style={{ paddingVertical: 8 }}>
            <T s={13} w="800" style={{ width: 44 }}>{i.number}/{i.total}</T>
            <View style={{ flex: 1 }}><T s={13} c={p.sub}>Fatura com vencimento em {shortDate(i.invoiceDueDate)}</T></View>
            <T s={14} w="700">{money(i.amount)}</T>
          </Row>
        ))}
      </View>

      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}

      {!c.canceled && !c.refundOfId && (
        <>
          <Card style={{ gap: 10 }}>
            <T s={15} w="700">Cancelar compra</T>
            <T s={12} c={p.sub}>Só enquanto todas as faturas dela estão abertas; remove as parcelas e libera o limite.</T>
            <Btn kind="ghost" onPress={() => run(async () => { setC(await cardApi.cancelPurchase(id)); setMsg({ ok: true, t: 'Compra cancelada.' }); })}>Cancelar compra</Btn>
          </Card>
          <Card style={{ gap: 10 }}>
            <T s={15} w="700">Registrar estorno</T>
            <T s={12} c={p.sub}>Gera um crédito ligado a esta compra na fatura atual (use quando a fatura já fechou).</T>
            <Field label="Valor do estorno (vazio = total)" value={valor} onChange={setValor} keyboard="decimal-pad" />
            <Field label="Motivo" value={motivo} onChange={setMotivo} placeholder="Ex.: produto devolvido" />
            <Btn kind="ghost" onPress={() => run(async () => { await cardApi.refund(id, motivo.trim(), valor ? parseMoney(valor) : undefined); setMsg({ ok: true, t: 'Estorno registrado na fatura atual.' }); setValor(''); setMotivo(''); })}>Estornar</Btn>
          </Card>
        </>
      )}
      <Pressable onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><T s={13} w="700" c={p.sub}>Voltar</T></Pressable>
    </Screen>
  );
}
