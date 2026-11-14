import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FREQUENCIES, financeApi, money, newKey, parseMoney, planningApi, today, type Category, type Frequency, type Rule, type Wallet } from '@/api/finance';
import { Btn, Card, Chips, Field, Label, Notice, Row, Screen, Seg, SwitchRow, T, useP } from '@/ui/kit';
import { errorMessage } from '@/state/session';

// Cria uma recorrência ou, com ?id=, edita (valor, categoria, conta, fim) / encerra.
export default function Recorrencia() {
  const p = useP();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = Boolean(id);
  const [rule, setRule] = useState<Rule | null>(null);
  const [tipo, setTipo] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [freq, setFreq] = useState<Frequency>('MONTHLY');
  const [intervalo, setIntervalo] = useState('');
  const [inicio, setInicio] = useState(today());
  const [fim, setFim] = useState('');
  const [assin, setAssin] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [cat, setCat] = useState<string | undefined>();
  const [walletId, setWalletId] = useState<string | undefined>();
  const [escopo, setEscopo] = useState<'future' | 'future_and_open'>('future');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const key = useRef(newKey());

  useEffect(() => {
    (async () => {
      try {
        const [c, w] = await Promise.all([financeApi.categories(), financeApi.wallets()]);
        setCats(c); setWallets(w.wallets);
        if (id) {
          const r = await planningApi.rule(id);
          setRule(r); setTipo(r.type); setDesc(r.description); setValor(r.amount.replace('.', ',')); setFreq(r.frequency); setInicio(r.startDate); setFim(r.endDate ?? ''); setAssin(r.isSubscription); setCat(r.categoryId ?? undefined); setWalletId(r.walletId ?? undefined);
        } else setWalletId(w.wallets[0]?.id);
      } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); } finally { setCarregando(false); }
    })();
  }, [id]);

  const run = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); } };
  const pais = cats.filter((c) => c.type === tipo && !c.parentId);

  const salvar = () => run(async () => {
    const amount = parseMoney(valor);
    if (!desc.trim()) return setMsg({ ok: false, t: 'Informe a descrição.' });
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return setMsg({ ok: false, t: 'Informe um valor maior que zero.' });
    if (editando) {
      setRule(await planningApi.updateRule(id!, { description: desc.trim(), amount, categoryId: cat ?? null, walletId: walletId ?? null, isSubscription: assin, endDate: fim || null, scope: escopo }));
      return setMsg({ ok: true, t: 'Recorrência atualizada. As próximas ocorrências foram regeradas.' });
    }
    if (freq === 'CUSTOM' && !Number(intervalo)) return setMsg({ ok: false, t: 'Informe de quantos em quantos dias.' });
    await planningApi.createRule({ type: tipo, description: desc.trim(), amount, frequency: freq, ...(freq === 'CUSTOM' ? { intervalDays: Number(intervalo) } : {}), startDate: inicio, ...(fim ? { endDate: fim } : {}), isSubscription: assin, ...(cat ? { categoryId: cat } : {}), ...(walletId ? { walletId } : {}) }, key.current);
    router.back();
  });

  const encerrar = () => run(async () => { await planningApi.stopRule(id!); router.back(); });

  if (carregando) return <Screen title="Recorrência" back><ActivityIndicator color={p.accent} /></Screen>;

  return (
    <Screen eyebrow="Recorrentes" title={editando ? 'Editar recorrência' : 'Nova recorrência'} back>
      {!editando && <Seg value={tipo} onChange={(t) => { setTipo(t); setCat(undefined); }} items={[['EXPENSE', 'Despesa'], ['INCOME', 'Receita']]} />}
      <Field label="Descrição" value={desc} onChange={setDesc} placeholder="Ex.: Internet, Streaming, Salário" />
      <Field label="Valor (R$)" value={valor} onChange={setValor} keyboard="decimal-pad" />
      {!editando && (
        <>
          <View style={{ gap: 10 }}><Label>Frequência</Label><Chips value={freq} onChange={setFreq} items={FREQUENCIES} /></View>
          {freq === 'CUSTOM' && <Field label="A cada quantos dias" value={intervalo} onChange={setIntervalo} keyboard="decimal-pad" />}
          <Field label="Primeira ocorrência" value={inicio} onChange={setInicio} placeholder="AAAA-MM-DD" hint="Meses sem esse dia usam o último dia do mês." />
        </>
      )}
      <Field label="Termina em (opcional)" value={fim} onChange={setFim} placeholder="AAAA-MM-DD" />
      {tipo === 'EXPENSE' && <Card><SwitchRow title="É uma assinatura" sub="Acompanha aumentos de preço" value={assin} onChange={setAssin} /></Card>}
      <View style={{ gap: 10 }}>
        <Label>Categoria</Label>
        <Chips value={cat ?? ''} onChange={(v) => setCat(v || undefined)} items={[['', 'Sem categoria'], ...pais.map((c) => [c.id, c.name] as [string, string])]} />
      </View>
      <View style={{ gap: 10 }}><Label>Conta</Label><Chips value={walletId ?? ''} onChange={setWalletId} items={wallets.map((w) => [w.id, `${w.name} · ${money(w.balance)}`] as [string, string])} /></View>
      {editando && (
        <View style={{ gap: 10 }}>
          <Label>Aplicar a</Label>
          <Chips value={escopo} onChange={setEscopo} items={[['future', 'Só as próximas'], ['future_and_open', 'Próximas e vencidas em aberto']]} />
          <T s={11} c={p.mute}>Ocorrências já pagas nunca são alteradas.</T>
        </View>
      )}
      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}
      <Btn onPress={salvar}>{editando ? 'Salvar alterações' : 'Criar recorrência'}</Btn>
      {editando && rule && <Pressable onPress={encerrar} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}><T s={14} w="800" c={p.red}>Encerrar recorrência</T></Pressable>}
    </Screen>
  );
}
