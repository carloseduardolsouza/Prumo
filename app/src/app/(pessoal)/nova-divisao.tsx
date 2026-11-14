import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { financeApi, money, newKey, parseMoney, planningApi, type Category, type Wallet } from '@/api/finance';
import { Btn, Card, Chips, Field, Icon, I, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

// Divide uma despesa já paga em partes iguais: só a sua parte conta como despesa; o resto fica "a receber".
export default function NovaDivisao() {
  const p = useP();
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [nomes, setNomes] = useState<string[]>(['']);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string | undefined>();
  const [cats, setCats] = useState<Category[]>([]);
  const [cat, setCat] = useState<string | undefined>();
  const [erro, setErro] = useState('');
  const key = useRef(newKey());

  useEffect(() => {
    Promise.all([financeApi.wallets(), financeApi.categories('EXPENSE')]).then(([w, c]) => { setWallets(w.wallets); setWalletId(w.wallets[0]?.id); setCats(c.filter((x) => !x.parentId)); }).catch((e) => setErro(errorMessage(e)));
  }, []);

  const total = Number(parseMoney(valor)) || 0;
  const pessoas = nomes.filter((n) => n.trim()).length;
  const parte = pessoas ? total / (pessoas + 1) : 0;

  const criar = async () => {
    const amount = parseMoney(valor);
    if (!desc.trim()) return setErro('Informe a descrição.');
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return setErro('Informe o valor total.');
    if (pessoas === 0) return setErro('Adicione ao menos uma pessoa.');
    if (!walletId) return setErro('Escolha a conta de onde saiu o pagamento.');
    try {
      await planningApi.createSplit({ description: desc.trim(), totalAmount: amount, walletId, ...(cat ? { categoryId: cat } : {}), participants: nomes.filter((n) => n.trim()).map((name) => ({ name: name.trim() })) }, key.current);
      router.back();
    } catch (e) { setErro(errorMessage(e)); }
  };

  return (
    <Screen eyebrow="Recorrentes" title="Nova divisão" back>
      <Field label="Descrição" value={desc} onChange={setDesc} placeholder="Ex.: Churrasco de sábado" />
      <Field label="Valor total pago (R$)" value={valor} onChange={setValor} keyboard="decimal-pad" />
      <View style={{ gap: 10 }}>
        <Label>Dividir com</Label>
        {nomes.map((n, i) => (
          <Row key={i}>
            <View style={{ flex: 1 }}><Field label={`Pessoa ${i + 1}`} value={n} onChange={(v) => setNomes(nomes.map((x, j) => (j === i ? v : x)))} placeholder="Nome" /></View>
            {nomes.length > 1 && <Pressable accessibilityLabel="Remover pessoa" onPress={() => setNomes(nomes.filter((_, j) => j !== i))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 22 }}><T s={18} c={p.red}>×</T></Pressable>}
          </Row>
        ))}
        {nomes.length < 20 && <Pressable onPress={() => setNomes([...nomes, ''])} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon d={I.plus} size={16} color={p.link} /><T s={13} w="700" c={p.link}>Adicionar pessoa</T></Pressable>}
      </View>
      <View style={{ gap: 10 }}><Label>Pago com</Label><Chips value={walletId ?? ''} onChange={setWalletId} items={wallets.map((w) => [w.id, `${w.name} · ${money(w.balance)}`] as [string, string])} /></View>
      <View style={{ gap: 10 }}><Label>Categoria (da sua parte)</Label><Chips value={cat ?? ''} onChange={(v) => setCat(v || undefined)} items={[['', 'Sem categoria'], ...cats.map((c) => [c.id, c.name] as [string, string])]} /></View>
      <Card style={{ gap: 8 }}>
        <Label>Partes iguais</Label>
        <Row style={{ justifyContent: 'space-between' }}><T s={13} c={p.sub}>Sua parte (só ela conta como despesa)</T><T s={14} w="800">{money(parte)}</T></Row>
        <Row style={{ justifyContent: 'space-between' }}><T s={13} c={p.sub}>A receber de {pessoas || 0} {pessoas === 1 ? 'pessoa' : 'pessoas'}</T><T s={14} w="800" c={C.green}>{money(total - parte)}</T></Row>
      </Card>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      <Btn onPress={criar}>Criar divisão</Btn>
    </Screen>
  );
}
