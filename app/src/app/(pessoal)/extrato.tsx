import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { shareCsv } from '@/state/exportCsv';
import { dayHeading, financeApi, money, moneyKind, monthLabel, monthRange, type Statement, type StatementItem, type StatementType } from '@/api/finance';
import { Badge, Chips, Icon, I, Label, MonthNav, Notice, Pill, Row, Screen, Stat, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const ICON: Record<StatementItem['kind'], [string, string]> = { income: [I.job, C.green], expense: [I.bag, C.yellow], transfer: [I.swap, '#9DB8F7'] };

export default function Extrato() {
  const p = useP();
  const params = useLocalSearchParams<{ q?: string }>();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [tipo, setTipo] = useState<StatementType>('todas');
  const [q, setQ] = useState(params.q ?? '');
  const [data, setData] = useState<Statement | null>(null);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await financeApi.statement({ ...monthRange(ym.y, ym.m), type: tipo, q: q.trim() || undefined }));
      setErro('');
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, [ym, tipo, q]);

  // Recarrega ao voltar para a tela (depois de criar/cancelar lançamentos) e ao mudar filtros, com debounce na busca.
  useFocusEffect(useCallback(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]));
  useEffect(() => { if (params.q !== undefined) setQ(params.q); }, [params.q]);

  const mover = (d: number) => setYm(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });

  const grupos = (data?.items ?? []).reduce<{ date: string; itens: StatementItem[] }[]>((acc, i) => {
    const g = acc.find((x) => x.date === i.date);
    g ? g.itens.push(i) : acc.push({ date: i.date, itens: [i] });
    return acc;
  }, []);

  return (
    <Screen
      eyebrow="Conta pessoal" title="Movimentações"
      right={<Pressable accessibilityLabel="Adicionar movimentação" onPress={() => router.push('/nova-movimentacao')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon d={I.plus} size={24} sw={1.8} /></Pressable>}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 16, backgroundColor: p.card, paddingHorizontal: 16 }}>
        <Icon d={I.search} color={p.mute} size={18} />
        <TextInput accessibilityLabel="Buscar movimentação" value={q} onChangeText={setQ} placeholder="Buscar movimentação" placeholderTextColor={p.mute} style={{ flex: 1, color: p.text, fontSize: 14 }} />
      </View>
      <MonthNav label={monthLabel(ym.y, ym.m)} onPrev={() => mover(-1)} onNext={() => mover(1)} />
      <Pressable onPress={() => shareCsv('transactions', monthRange(ym.y, ym.m)).catch(() => undefined)} accessibilityLabel="Exportar o mês em CSV" style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><T s={12} w="700" c={p.link}>Exportar mês em CSV</T></Pressable>
      <Pressable onPress={() => router.push('/importar')} style={{ height: 48, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.dash, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
        <Icon d={I.upload} color={p.link} size={16} sw={2} /><T s={12} w="700">Importar CSV/OFX</T>
      </Pressable>
      <Chips value={tipo} onChange={setTipo} items={[['todas', 'Todas'], ['receita', 'Receitas'], ['despesa', 'Despesas'], ['transferencia', 'Transferências']]} />
      {data && (
        <Row>
          <Stat label="Entradas" value={money(data.summary.income)} color={C.green} />
          <Stat label="Saídas" value={money(data.summary.expense)} />
          <Stat label="Saldo" value={money(data.summary.result)} />
        </Row>
      )}
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      {!data && !erro && <ActivityIndicator color={p.accent} />}
      {data && grupos.length === 0 && <T s={13} c={p.mute} style={{ textAlign: 'center' }}>Nenhuma movimentação neste período.</T>}
      {grupos.map((g) => (
        <View key={g.date} style={{ gap: 2 }}>
          <Row style={{ justifyContent: 'space-between', paddingBottom: 6 }}>
            <Label>{dayHeading(g.date)}</Label><T s={12} c={p.mute}>{g.itens.length} {g.itens.length > 1 ? 'lançamentos' : 'lançamento'}</T>
          </Row>
          {g.itens.map((m) => {
            const [d, c] = ICON[m.kind];
            return (
              <Pressable key={m.id} onPress={() => (m.via === 'card' ? router.push({ pathname: '/compra', params: { id: m.purchaseId! } }) : router.push({ pathname: '/movimentacao', params: { id: m.id, kind: m.kind } }))}>
                <Row style={{ paddingVertical: 10, gap: 14 }}>
                  <Badge d={d} color={c} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T s={15} w="600">{m.description}</T>
                    <T s={12} c={p.mute}>{m.kind === 'transfer' ? 'Transferência entre contas' : `${m.categoryName ?? 'Sem categoria'}${m.walletName ? ` · ${m.walletName}` : ''}${m.via === 'card' ? ' · cartão' : ''}`}</T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 5 }}>
                    <T s={15} w="700" c={m.kind === 'income' ? C.green : m.kind === 'transfer' ? '#9DB8F7' : p.text}>{moneyKind(m.kind, m.status === 'planned' ? m.plannedAmount : m.amount)}</T>
                    <Pill color={p.sub} dashed={m.status !== 'settled'}>{m.status === 'settled' ? 'Efetivado' : m.status === 'partial' ? 'Parcial' : 'Previsto'}</Pill>
                  </View>
                </Row>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
