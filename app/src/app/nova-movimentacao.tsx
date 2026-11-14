import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { cardApi, financeApi, money, newKey, parseMoney, planningApi, today, walletBadge, type Category, type CreditCard, type Frequency, type Wallet } from '@/api/finance';
import { Btn, Card, Chips, Icon, I, Label, Notice, Row, Screen, Seg, Sigla, T, Toggle, useP } from '@/ui/kit';
import { errorMessage } from '@/state/session';

type Tipo = 'despesa' | 'receita' | 'transferencia';

const ICONS: Record<string, string> = { house: I.house, food: I.food, car: I.car, play: I.play, heart: I.heart, school: I.school, bag: I.bag, dots: I.dots, job: I.job, code: I.code, up: I.up };

const REPETICOES: ['NONE' | Frequency, string][] = [['NONE', 'Não repetir'], ['WEEKLY', 'Semanal'], ['MONTHLY', 'Mensal'], ['ANNUAL', 'Anual']];
function ScrollChips({ value, onChange }: { value: 'NONE' | Frequency; onChange: (v: 'NONE' | Frequency) => void }) {
  return <Chips value={value} onChange={onChange} items={REPETICOES} />;
}

export default function NovaMovimentacao() {
  const p = useP();
  const { cartao } = useLocalSearchParams<{ cartao?: string }>();
  const [tipo, setTipo] = useState<Tipo>('despesa');
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [cardId, setCardId] = useState<string | undefined>(cartao);
  const [parcelas, setParcelas] = useState(1);
  const [repetir, setRepetir] = useState<'NONE' | Frequency>('NONE');
  const [valor, setValor] = useState('');
  const [desc, setDesc] = useState('');
  const [cats, setCats] = useState<Category[] | null>(null);
  const [wallets, setWallets] = useState<Wallet[] | null>(null);
  const [cat, setCat] = useState<string | undefined>();
  const [walletId, setWalletId] = useState<string | undefined>();
  const [toWalletId, setToWalletId] = useState<string | undefined>();
  const [data, setData] = useState(today());
  const [efetivado, setEfetivado] = useState(true);
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const attempt = useRef<{ sig: string; key: string } | null>(null);

  useEffect(() => {
    Promise.all([financeApi.categories(), financeApi.wallets(), cardApi.list()])
      .then(([c, w, k]) => { setCards(k.cards.filter((x) => x.status === 'ACTIVE')); setCats(c); setWallets(w.wallets); setWalletId(w.wallets[0]?.id); setToWalletId(w.wallets[1]?.id); })
      .catch((e) => setErro(errorMessage(e)));
  }, []);

  const tx = tipo === 'receita' ? 'INCOME' : 'EXPENSE';
  const pais = (cats ?? []).filter((c) => c.type === tx && !c.parentId);
  const subs = (cats ?? []).filter((c) => c.parentId === cat);
  const paiSel = pais.find((c) => c.id === cat || subs.some((s) => s.id === cat));
  const input = { height: 52, borderRadius: 16, backgroundColor: p.card, color: p.text, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: p.line } as const;

  const mudarTipo = (t: Tipo) => { setTipo(t); setCat(undefined); setErro(''); if (t !== 'despesa') setCardId(undefined); };
  const noCartao = tipo === 'despesa' && Boolean(cardId);

  const salvar = async () => {
    const amount = parseMoney(valor);
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return setErro('Informe um valor maior que zero.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro('Use a data no formato AAAA-MM-DD.');
    if (tipo === 'transferencia') {
      if (!walletId || !toWalletId) return setErro('Escolha a conta de origem e a de destino.');
      if (walletId === toWalletId) return setErro('Origem e destino precisam ser diferentes.');
    } else {
      if (!desc.trim()) return setErro('Informe a descrição.');
      if (!noCartao && efetivado && !walletId) return setErro('Escolha a conta para registrar como efetivado.');
    }
    setErro('');
    setSalvando(true);
    // Mesma tentativa (mesmo conteúdo) reaproveita a chave de idempotência: reenviar após falha de rede não duplica.
    const sig = JSON.stringify({ tipo, amount, desc, cat, walletId, toWalletId, data, efetivado, obs, cardId, parcelas, repetir });
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newKey() };
    try {
      if (tipo === 'transferencia') {
        await financeApi.createTransfer({ fromWalletId: walletId!, toWalletId: toWalletId!, amount, date: data, notes: obs.trim() || undefined }, attempt.current.key);
      } else if (noCartao) {
        // Compra no cartão: vai para a fatura, não debita a conta e a despesa é reconhecida pela competência de cada parcela.
        await cardApi.createPurchase({ cardId: cardId!, description: desc.trim(), amount, installments: parcelas, categoryId: cat, purchaseDate: data, notes: obs.trim() || undefined }, attempt.current.key);
      } else if (repetir !== 'NONE') {
        // Repetir = criar uma recorrência; a 1ª ocorrência já nasce efetivada se for o caso. As próximas ficam previstas.
        await planningApi.createRule({ type: tx, description: desc.trim(), amount, frequency: repetir, startDate: data, ...(cat ? { categoryId: cat } : {}), ...(walletId ? { walletId } : {}), settleFirst: efetivado, notes: obs.trim() || undefined }, attempt.current.key);
      } else {
        await financeApi.createTransaction({
          type: tx, description: desc.trim(), amount, categoryId: cat, walletId, settled: efetivado,
          ...(efetivado ? { paidDate: data, competenceDate: data } : { dueDate: data, competenceDate: data }), notes: obs.trim() || undefined,
        }, attempt.current.key);
      }
      router.back();
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setSalvando(false);
    }
  };

  const contas = (sel: string | undefined, set: (id: string) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {wallets?.map((w) => {
        const b = walletBadge(w);
        return (
          <Pressable key={w.id} accessibilityState={{ selected: sel === w.id }} onPress={() => set(w.id)}
            style={{ minWidth: '47%', flexGrow: 1, flexBasis: '47%', borderRadius: 18, borderWidth: 1.5, borderColor: sel === w.id ? p.text : 'transparent', backgroundColor: p.card, padding: 12, gap: 8 }}>
            <Sigla t={b.text} bg={b.bg} size={36} />
            <View><T s={13} w="700" lines={1}>{w.name}</T><T s={12} c={p.mute}>{money(w.balance)}</T></View>
          </Pressable>
        );
      })}
    </View>
  );

  if (!cats || !wallets) return <Screen title="Nova movimentação" back>{erro ? <Notice kind="err">{erro}</Notice> : <ActivityIndicator color={p.accent} />}</Screen>;

  if (wallets.length === 0) {
    return (
      <Screen title="Nova movimentação" back>
        <Card style={{ gap: 10 }}>
          <T s={15} w="700">Cadastre uma conta primeiro</T>
          <T s={13} c={p.sub}>Para registrar movimentações você precisa de ao menos uma conta (banco, carteira digital ou dinheiro).</T>
          <Btn onPress={() => router.replace('/nova-conta')}>Cadastrar conta</Btn>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Nova movimentação" back>
      <Seg value={tipo} onChange={mudarTipo} items={[['despesa', 'Despesa'], ['receita', 'Receita'], ['transferencia', 'Transferência']]} />

      <View style={{ gap: 8 }}>
        <Label>Valor</Label>
        <Row style={{ gap: 8 }}>
          <T s={28} w="700" c={p.mute}>R$</T>
          <TextInput accessibilityLabel="Valor" value={valor} onChangeText={setValor} placeholder="0,00" placeholderTextColor={p.mute} keyboardType="decimal-pad" style={{ flex: 1, color: p.text, fontSize: 44, fontWeight: '700' }} />
        </Row>
      </View>

      {tipo !== 'transferencia' && (
        <View style={{ gap: 8 }}>
          <Label>Descrição</Label>
          <TextInput accessibilityLabel="Descrição" value={desc} onChangeText={setDesc} placeholder="Ex.: Supermercado" placeholderTextColor={p.mute} style={input} />
        </View>
      )}

      {tipo !== 'transferencia' && (
        <View style={{ gap: 8 }}>
          <Label>Categoria</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {pais.map((c) => (
              <Pressable key={c.id} accessibilityState={{ selected: paiSel?.id === c.id }} onPress={() => setCat(c.id)}
                style={{ minWidth: '30%', flexGrow: 1, flexBasis: '30%', minHeight: 78, borderRadius: 18, borderWidth: 1.5, borderColor: paiSel?.id === c.id ? p.text : p.card, backgroundColor: paiSel?.id === c.id ? p.card2 : p.card, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon d={ICONS[c.icon ?? 'dots'] ?? I.dots} color={c.color ?? p.sub} /><T s={12} w="600">{c.name}</T>
              </Pressable>
            ))}
          </View>
          {paiSel && (cats ?? []).some((s) => s.parentId === paiSel.id) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(cats ?? []).filter((s) => s.parentId === paiSel.id).map((s) => (
                <Pressable key={s.id} accessibilityState={{ selected: cat === s.id }} onPress={() => setCat(cat === s.id ? paiSel.id : s.id)} style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: cat === s.id ? p.text : p.card2 }}>
                  <T s={12} w="700" c={cat === s.id ? p.bg : p.sub}>{s.name}</T>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Label>{tipo === 'despesa' ? 'Pagar com' : tipo === 'receita' ? 'Receber em' : 'De'}</Label>
        {contas(walletId, (id) => { setWalletId(id); setCardId(undefined); })}
        {tipo === 'despesa' && cards.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {cards.map((k) => (
              <Pressable key={k.id} accessibilityState={{ selected: cardId === k.id }} onPress={() => setCardId(cardId === k.id ? undefined : k.id)}
                style={{ minWidth: '47%', flexGrow: 1, flexBasis: '47%', borderRadius: 18, borderWidth: 1.5, borderColor: cardId === k.id ? p.text : 'transparent', backgroundColor: p.card, padding: 12, gap: 8 }}>
                <Sigla t="cartão" bg={k.color ?? '#3A3D44'} size={36} />
                <View><T s={13} w="700" lines={1}>{k.name}{k.last4 ? ' •• ' + k.last4 : ''}</T><T s={12} c={p.mute}>Disp. {money(k.summary?.available ?? 0)}</T></View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {noCartao && (
        <View style={{ gap: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}><Label>Parcelas</Label><T s={12} c={p.mute}>vai para a fatura do cartão</T></Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[1, 2, 3, 4, 5, 6, 10, 12].map((k) => (
              <Pressable key={k} accessibilityState={{ selected: parcelas === k }} onPress={() => setParcelas(k)} style={{ minWidth: 72, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: parcelas === k ? p.text : p.card2 }}>
                <T s={13} w="700" c={parcelas === k ? p.bg : p.text}>{k === 1 ? 'À vista' : k + 'x'}</T>
              </Pressable>
            ))}
          </View>
          {parcelas > 1 && Number(parseMoney(valor)) > 0 && <T s={12} c={p.mute}>{parcelas}x de aproximadamente {money(Number(parseMoney(valor)) / parcelas)}</T>}
        </View>
      )}
      {tipo === 'transferencia' && <View style={{ gap: 8 }}><Label>Para</Label>{contas(toWalletId, setToWalletId)}</View>}

      <View style={{ gap: 8 }}>
        <Label>{noCartao ? 'Data da compra' : tipo === 'transferencia' || efetivado ? 'Data' : 'Vencimento'}</Label>
        <TextInput accessibilityLabel="Data" value={data} onChangeText={setData} placeholder="AAAA-MM-DD" placeholderTextColor={p.mute} style={input} />
      </View>

      {tipo !== 'transferencia' && !noCartao && (
        <View style={{ gap: 8 }}>
          <Label>Repetir</Label>
          <ScrollChips value={repetir} onChange={setRepetir} />
        </View>
      )}

      {tipo !== 'transferencia' && !noCartao && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
          <View style={{ flex: 1 }}>
            <T s={14} w="600">{efetivado ? (tipo === 'receita' ? 'Recebido (efetivado)' : 'Pago (efetivado)') : 'Previsto'}</T>
            <T s={11} c={p.mute}>{efetivado ? 'Movimenta o saldo agora' : 'Só entra no saldo quando você confirmar'}</T>
          </View>
          <Toggle label="Marcar como efetivado" value={efetivado} onChange={setEfetivado} />
        </Card>
      )}

      <View style={{ gap: 8 }}>
        <Label>Observação</Label>
        <TextInput accessibilityLabel="Observação" value={obs} onChangeText={setObs} multiline placeholder="Opcional" placeholderTextColor={p.mute} style={[input, { height: 80, paddingTop: 14, textAlignVertical: 'top' }]} />
      </View>

      {erro ? <Notice kind="err">{erro}</Notice> : null}
      <Btn onPress={salvando ? undefined : salvar}>{salvando ? 'Salvando...' : 'Salvar movimentação'}</Btn>
    </Screen>
  );
}
