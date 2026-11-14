import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { financeApi, money, parseMoney, plannerApi } from '@/api/finance';
import { Bar, Btn, Card, Chips, Field, Grid, I, Icon, Label, Notice, Ring, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { Bars } from '@/ui/charts';
import { C, pct } from '@/ui/theme';
import { errorMessage } from '@/state/session';
import { useLoad } from '@/state/useLoad';

const DIA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function Planejamento() {
  const p = useP();
  const [aba, setAba] = useState<'orc' | 'meta'>('orc');
  const [novo, setNovo] = useState(false);
  const [cat, setCat] = useState('');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const sp = useLoad(plannerApi.spendable);
  const b = useLoad(() => plannerApi.budgets());
  const goals = useLoad(plannerApi.goals);
  const cats = useLoad(() => financeApi.categories('EXPENSE'));
  const free = (cats.data ?? []).filter((c) => !c.parentId && !c.archived && !b.data?.items.some((i) => i.categoryId === c.id));

  const salvar = async () => {
    if (!cat || !Number(parseMoney(valor))) return setErro('Escolha a categoria e informe o limite mensal.');
    try { await plannerApi.setBudget(cat, parseMoney(valor)); setNovo(false); setCat(''); setValor(''); setErro(''); await Promise.all([b.reload(), sp.reload()]); } catch (e) { setErro(errorMessage(e)); }
  };
  const remover = async (id: string) => { try { await plannerApi.removeBudget(id); await Promise.all([b.reload(), sp.reload()]); } catch (e) { setErro(errorMessage(e)); } };
  const s = sp.data;

  return (
    <Screen eyebrow="Conta pessoal" title="Planejamento" back>
      {b.error ? <Notice kind="err">{b.error}</Notice> : null}
      {!s && !sp.error && <ActivityIndicator color={p.accent} />}
      {s && (
        <Card style={{ gap: 12 }}>
          <Label>Hoje você pode gastar</Label>
          {s.hasBudget ? (
            <>
              <T s={36} w="700">{money(s.availableToday)}</T>
              <T s={12} c={p.sub} style={{ lineHeight: 18 }}>{money(Math.max(0, Number(s.free)))} livres nos orçamentos (já descontadas as contas previstas) ÷ {s.daysLeft} dia(s) até o fim do mês. Gastou menos hoje? A sobra vai para amanhã.</T>
              <Bars height={80} max={Math.max(Number(s.dailyLimit) * 2, ...s.week.map((d) => Number(d.spent)), 100)} items={s.week.map((d) => ({ label: DIA[new Date(`${d.date}T12:00:00Z`).getUTCDay()]!, values: [Math.max(Number(d.spent), 6)], colors: [Number(d.spent) > Number(s.dailyLimit) ? C.red : C.green] }))} />
              <T s={11} c={p.mute}>Gasto diário dos últimos 7 dias · vermelho = passou do limite do dia ({money(s.dailyLimit)})</T>
            </>
          ) : <T s={13} c={p.sub}>Defina orçamentos para as suas categorias e o app calcula quanto dá para gastar por dia.</T>}
        </Card>
      )}

      <Seg value={aba} onChange={setAba} items={[['orc', 'Orçamentos'], ['meta', 'Metas']]} />

      {aba === 'orc' ? (
        <>
          {b.data && b.data.items.length > 0 && (
            <Card style={{ gap: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}><Label>Orçamento total do mês</Label><T s={20} w="800">{pct(b.data.total.percent, 0)}</T></Row>
              <T s={15} w="800">{money(b.data.total.spent)} <T s={13} c={p.mute}>de {money(b.data.total.limit)}</T></T>
              <Bar f={Math.min(1, b.data.total.percent / 100)} color={b.data.total.percent >= 100 ? C.red : b.data.total.percent >= 80 ? C.yellow : C.green} h={10} />
              {Number(b.data.plannedUntilEnd) > 0 && <T s={12} c={p.sub}>Previsto até o fim do mês: + {money(b.data.plannedUntilEnd)} em contas já agendadas</T>}
            </Card>
          )}
          {b.data?.items.map((i) => {
            const over = i.status === 'over', warn = i.status === 'warn';
            return (
              <Card key={i.categoryId} style={{ gap: 10 }}>
                <Row>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i.color }} />
                  <T s={15} w="700" style={{ flex: 1 }}>{i.name}</T>
                  {(over || warn) && <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: over ? p.errBg : p.warnBg }}><T s={10} w="800" c={over ? p.red : C.yellow}>{over ? 'ESTOUROU' : 'ATENÇÃO'}</T></View>}
                  <T s={15} w="800">{pct(i.percent, 0)}</T>
                </Row>
                <Bar f={Math.min(1, i.percent / 100)} color={over ? C.red : warn ? C.yellow : i.color} h={10} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <T s={12} c={p.mute}>{money(i.spent)} de {money(i.limit)}</T>
                  <T s={12} w="700" c={over ? p.red : p.sub}>{over ? `passou ${money(Math.abs(Number(i.remaining)))}` : `restam ${money(i.remaining)}`}</T>
                </Row>
                <Pressable onPress={() => remover(i.categoryId)} accessibilityLabel={`Remover orçamento de ${i.name}`} style={{ minHeight: 36, justifyContent: 'center' }}><T s={11} w="700" c={p.mute}>Remover orçamento</T></Pressable>
              </Card>
            );
          })}
          {novo ? (
            <Card style={{ gap: 12 }}>
              <Label>Novo orçamento mensal</Label>
              {free.length === 0 ? <T s={12} c={p.sub}>Todas as categorias principais já têm orçamento.</T> : <Chips value={cat} onChange={setCat} items={free.map((c) => [c.id, c.name] as [string, string])} />}
              <Field label="Limite por mês (R$)" value={valor} onChange={setValor} keyboard="decimal-pad" hint="Subcategorias somam na categoria principal." />
              {erro ? <Notice kind="err">{erro}</Notice> : null}
              <Btn onPress={salvar}>Salvar orçamento</Btn>
            </Card>
          ) : (
            <Pressable onPress={() => setNovo(true)} style={{ height: 52, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.dash, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}><Icon d={I.plus} size={18} /><T s={14} w="700">Novo orçamento</T></Pressable>
          )}
          <T s={11} c={p.mute}>{b.data?.note} Avisos aos 80% e 100% chegam como notificação.</T>
        </>
      ) : (
        <>
          {goals.error ? <Notice kind="err">{goals.error}</Notice> : null}
          {goals.data?.length === 0 && <Card><T s={13} c={p.sub}>Nenhuma meta ainda. Crie uma reserva de emergência, uma viagem ou uma meta de renda passiva.</T></Card>}
          <Grid cols={2} gap={12}>
            {(goals.data ?? []).map((g) => (
              <Pressable key={g.id} onPress={() => router.push({ pathname: '/meta', params: { id: g.id } })} style={{ borderRadius: 24, backgroundColor: p.card, padding: 16, gap: 8 }}>
                <Ring f={Math.min(1, g.percent / 100)} color={g.color ?? C.green}><T s={13} w="800">{pct(g.percent, 0)}</T></Ring>
                <T s={14} w="700">{g.name}</T>
                <T s={12} c={p.sub}>{money(g.saved)} de {money(g.target)}{g.kind === 'FREEDOM' ? '/mês' : ''}</T>
                <T s={11} c={g.status === 'REACHED' ? C.green : p.mute}>{g.status === 'REACHED' ? 'Meta alcançada' : g.kind === 'FREEDOM' ? 'renda passiva atual' : g.monthlyNeeded ? `${money(g.monthlyNeeded)}/mês até ${g.targetDate?.split('-').reverse().join('/')}` : 'sem prazo'}</T>
              </Pressable>
            ))}
          </Grid>
          <Pressable onPress={() => router.push('/nova-meta')} style={{ height: 52, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.dash, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <Icon d={I.plus} size={18} /><T s={14} w="700">Nova meta</T>
          </Pressable>
          <T s={11} c={p.mute}>Metas guardam uma reserva simbólica: o dinheiro continua nas suas carteiras e não é contado duas vezes.</T>
        </>
      )}
    </Screen>
  );
}
