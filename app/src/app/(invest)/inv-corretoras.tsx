import { useState } from 'react';
import { Pressable } from 'react-native';
import { investApi, money } from '@/api/finance';
import { Badge, Btn, Card, Field, I, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';
import { useLoad } from '@/state/useLoad';

export default function InvCorretoras() {
  const p = useP();
  const { data: lista, error, reload } = useLoad(investApi.brokerages);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); setErro(''); await reload(); } catch (e) { setErro(errorMessage(e)); } };
  return (
    <Screen eyebrow="Conta investimentos" title="Corretoras e bancos" back>
      {error || erro ? <Notice kind="err">{error || erro}</Notice> : null}
      {lista?.length === 0 && <Card><T s={13} c={p.sub}>Nenhuma instituição ainda. Adicione a primeira abaixo.</T></Card>}
      {lista?.map((b) => (
        <Card key={b.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Badge d={I.bank} color={C.blue} size={42} bg={p.card2} />
          <Row style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}><T s={15} w="700">{b.name}</T><T s={12} c={p.mute}>caixa {money(b.cash)}</T></Row>
          <T s={14} w="800">{money(b.total)}</T>
          <Pressable accessibilityLabel={`Remover ${b.name}`} onPress={() => run(() => investApi.removeBrokerage(b.id))} style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}><T s={12} w="700" c={p.red}>Remover</T></Pressable>
        </Card>
      ))}
      <Card style={{ gap: 12 }}>
        <Label>Adicionar instituição</Label>
        <Field label="Nome" value={nome} onChange={setNome} placeholder="Ex.: XP, BTG, Rico" />
        <Btn onPress={() => { if (nome.trim()) run(async () => { await investApi.createBrokerage({ name: nome.trim() }); setNome(''); }); }}>Adicionar</Btn>
        <T s={11} c={p.mute}>A sincronização automática com corretoras ainda não existe; os valores vêm das operações e cotações que você registra. Instituições com histórico são arquivadas, não apagadas.</T>
      </Card>
    </Screen>
  );
}
