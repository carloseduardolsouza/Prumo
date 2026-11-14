import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { financeApi, money, parseMoney, today, walletBadge, type Transaction, type Wallet } from '@/api/finance';
import { Btn, Card, Chips, Field, Label, Notice, Pill, Row, Screen, Sigla, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const dataBr = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const STATUS = { planned: 'Previsto', partial: 'Parcial', settled: 'Efetivado', canceled: 'Cancelado' } as const;

// Detalhe de um lançamento: efetivar (total ou parcial) e cancelar (estorno). Transferências só cancelam.
export default function Movimentacao() {
  const p = useP();
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const transfer = kind === 'transfer';
  const [t, setT] = useState<Transaction | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string | undefined>();
  const [parcial, setParcial] = useState('');
  const [data, setData] = useState(today());
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const w = await financeApi.wallets();
        setWallets(w.wallets);
        if (!transfer) {
          const tx = await financeApi.transaction(id);
          setT(tx);
          setWalletId(tx.walletId ?? w.wallets[0]?.id);
        }
      } catch (e) {
        setMsg({ ok: false, t: errorMessage(e) });
      }
    })();
  }, [id, transfer]);

  const run = async (fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); }
  };

  const efetivar = () => run(async () => {
    if (!walletId) return setMsg({ ok: false, t: 'Escolha a conta.' });
    const valor = parcial.trim() ? parseMoney(parcial) : undefined;
    setT(await financeApi.settleTransaction(id, { walletId, ...(valor ? { amount: valor } : {}), date: data }));
    setParcial('');
    setMsg({ ok: true, t: 'Registrado. O saldo da conta foi atualizado.' });
  });

  const cancelar = () => run(async () => {
    if (transfer) await financeApi.cancelTransfer(id);
    else await financeApi.cancelTransaction(id);
    router.back();
  });

  if (!transfer && !t) return <Screen title="Lançamento" back>{msg ? <Notice kind="err">{msg.t}</Notice> : <ActivityIndicator color={p.accent} />}</Screen>;

  const aberto = t && (t.status === 'planned' || t.status === 'partial');
  return (
    <Screen eyebrow={transfer ? 'Transferência' : t!.type === 'INCOME' ? 'Receita' : 'Despesa'} title={transfer ? 'Transferência' : t!.description} back>
      {t && (
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}><Label>Valor</Label><Pill color={p.sub} dashed={t.status !== 'settled'}>{STATUS[t.status]}</Pill></Row>
          <T s={32} w="800" c={t.type === 'INCOME' ? C.green : p.text}>{money(t.plannedAmount)}</T>
          {t.status === 'partial' && <T s={13} c={p.sub}>Pago {money(t.paidAmount)} · falta {money(t.remaining)}</T>}
          <Row style={{ gap: 18 }}>
            {[['Categoria', t.categoryName ?? '—'], ['Vencimento', dataBr(t.dueDate)], ['Pagamento', dataBr(t.paidDate)]].map(([l, v]) => <View key={l} style={{ flex: 1, gap: 4 }}><Label>{l}</Label><T s={13} w="700">{v}</T></View>)}
          </Row>
          {t.notes ? <T s={13} c={p.sub}>{t.notes}</T> : null}
        </Card>
      )}

      {aberto && (
        <Card style={{ gap: 12 }}>
          <T s={15} w="700">{t!.type === 'INCOME' ? 'Confirmar recebimento' : 'Confirmar pagamento'}</T>
          <View style={{ gap: 8 }}>
            <Label>Conta</Label>
            <Chips value={walletId ?? ''} onChange={setWalletId} items={wallets.map((w) => [w.id, w.name] as [string, string])} />
          </View>
          <Field label="Valor (vazio = o que falta)" value={parcial} onChange={setParcial} keyboard="decimal-pad" placeholder={money(t!.remaining).replace('R$ ', '')} hint="Informe um valor menor para registrar um pagamento parcial." />
          <Field label="Data" value={data} onChange={setData} placeholder="AAAA-MM-DD" />
          <Btn onPress={efetivar}>{t!.type === 'INCOME' ? 'Marcar como recebido' : 'Marcar como pago'}</Btn>
        </Card>
      )}

      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}

      {(transfer || (t && t.status !== 'canceled')) && (
        <Card style={{ gap: 8 }}>
          <T s={15} w="700">Cancelar</T>
          <T s={12} c={p.sub}>O lançamento não é apagado: o que já movimentou saldo é estornado e o histórico fica preservado.</T>
          {confirmando ? (
            <>
              <Btn onPress={cancelar}>Confirmar cancelamento</Btn>
              <Pressable onPress={() => setConfirmando(false)} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><T s={13} w="700" c={p.sub}>Voltar</T></Pressable>
            </>
          ) : (
            <Pressable onPress={() => setConfirmando(true)} style={{ minHeight: 44, justifyContent: 'center' }}><T s={14} w="800" c={p.red}>{transfer ? 'Cancelar transferência' : 'Cancelar lançamento'}</T></Pressable>
          )}
        </Card>
      )}
    </Screen>
  );
}
