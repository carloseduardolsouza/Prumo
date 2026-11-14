import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { INVOICE_LABEL, cardApi, financeApi, money, shortDate, walletBadge, walletTypeLabel, type CreditCard, type WalletList } from '@/api/finance';
import { Btn, Card, Icon, I, Label, Notice, Ring, Row, Screen, Sigla, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const CARD_COLORS = ['#820AD1', '#FF7A00', '#1A1A1A', '#4C7DF0', '#2E9E62'];
const cardColor = (c: CreditCard, i: number) => c.color ?? CARD_COLORS[i % CARD_COLORS.length]!;
const statusColor: Record<string, string> = { open: C.green, closed: C.yellow, partial: C.yellow, paid: C.green, overdue: C.red };

export default function Carteira() {
  const p = useP();
  const [data, setData] = useState<WalletList | null>(null);
  const [arquivadas, setArquivadas] = useState<WalletList | null>(null);
  const [cards, setCards] = useState<CreditCard[] | null>(null);
  const [totalLivre, setTotalLivre] = useState('0');
  const [sel, setSel] = useState<string | undefined>();
  const [verArquivadas, setVerArquivadas] = useState(false);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([financeApi.wallets('active'), financeApi.wallets('archived'), cardApi.list()]);
      setData(a); setArquivadas(b); setCards(c.cards); setTotalLivre(c.totals.availableLimit);
      setSel((s) => (c.cards.some((x) => x.id === s) ? s : c.cards[0]?.id));
      setErro('');
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const card = cards?.find((c) => c.id === sel);
  const sum = card?.summary;
  const inv = sum?.currentInvoice;

  const linha = (w: WalletList['wallets'][number]) => {
    const b = walletBadge(w);
    return (
      <Pressable key={w.id} onPress={() => router.push({ pathname: '/nova-conta', params: { id: w.id } })}>
        <Row style={{ paddingVertical: 8, opacity: w.archived ? 0.6 : 1 }}>
          <Sigla t={b.text} bg={b.bg} size={46} />
          <View style={{ flex: 1 }}><T s={15} w="600">{w.name}</T><T s={12} c={p.mute}>{walletTypeLabel(w.type)}{w.archived ? ' · arquivada' : ''}</T></View>
          <T s={15} w="700" c={w.negative ? p.red : p.text}>{money(w.balance)}</T>
        </Row>
      </Pressable>
    );
  };

  return (
    <Screen
      eyebrow="Conta pessoal" title="Carteira"
      right={<Pressable accessibilityLabel="Adicionar conta ou cartão" onPress={() => router.push('/nova-conta')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon d={I.plus} size={24} sw={1.8} /></Pressable>}>
      <Row>
        <View style={{ flex: 1, gap: 6 }}><Label>Saldo em contas</Label>{data ? <T s={20} w="800">{money(data.summary.totalBalance)}</T> : <ActivityIndicator color={p.accent} />}</View>
        <View style={{ flex: 1, gap: 6 }}><Label>Limite disponível</Label><T s={20} w="800">{money(totalLivre)}</T></View>
      </Row>
      {erro ? <Notice kind="err">{erro}</Notice> : null}

      <View style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}><T s={20} w="700">Cartões de crédito</T><T s={11} c={p.mute}>Toque para ver detalhes</T></Row>
        {cards && cards.length === 0 && (
          <Card style={{ gap: 8 }}>
            <T s={13} c={p.sub}>Cadastre seus cartões para acompanhar limite, faturas e parcelas.</T>
            <Btn onPress={() => router.push('/novo-cartao')}>Adicionar cartão</Btn>
          </Card>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={296} decelerationRate="fast" style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
          {cards?.map((k, i) => (
            <Pressable key={k.id} accessibilityLabel={`Selecionar cartão ${k.name}`} accessibilityState={{ selected: sel === k.id }} onPress={() => setSel(k.id)}
              style={{ width: 284, height: 176, borderRadius: 24, backgroundColor: cardColor(k, i), padding: 20, justifyContent: 'space-between', borderWidth: 2, borderColor: sel === k.id ? p.text : 'transparent', opacity: sel === k.id ? 1 : 0.8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: k.name.length > 8 ? 20 : 28 }} numberOfLines={1}>{k.name}</Text>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', opacity: 0.85 }}>{k.status === 'ACTIVE' ? (k.brand ?? '').toUpperCase() : k.status === 'BLOCKED' ? 'BLOQUEADO' : k.status}</Text>
              </Row>
              <View style={{ width: 38, height: 28, borderRadius: 6, backgroundColor: '#D9C27A' }} />
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 }}>•••• •••• •••• {k.last4 ?? '····'}</Text>
                <Text style={{ color: '#fff', fontSize: 10, opacity: 0.8 }}>{(k.holder ?? '').toUpperCase()}</Text>
              </Row>
            </Pressable>
          ))}
          {cards && cards.length > 0 && (
            <Pressable onPress={() => router.push('/novo-cartao')} style={{ width: 120, height: 176, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.dash, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon d={I.plus} /><T s={12} w="700">Novo cartão</T>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {card && sum && inv && (
        <Card style={{ gap: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}><Label>Fatura atual · {card.name}</Label><T s={10} w="800" c={statusColor[inv.status]}>{INVOICE_LABEL[inv.status].toUpperCase()}</T></Row>
          <View style={{ gap: 4 }}><T s={30} w="700">{money(inv.total)}</T><T s={12} c={p.mute}>Fecha {shortDate(inv.closingDate)} · vence {shortDate(inv.dueDate)}</T></View>
          <View style={{ height: 12, flexDirection: 'row', borderRadius: 999, overflow: 'hidden', backgroundColor: p.track, gap: 2 }}>
            <View style={{ flex: Math.max(Number(inv.total), 0.0001), backgroundColor: cardColor(card, cards!.indexOf(card)) }} />
            <View style={{ flex: Math.max(Number(sum.futureInstallments), 0.0001), backgroundColor: '#5E6068' }} />
            <View style={{ flex: Math.max(Number(sum.available), 0.0001), backgroundColor: p.track }} />
          </View>
          <Row style={{ gap: 14 }}>
            {[[cardColor(card, cards!.indexOf(card)), 'Fatura'], ['#5E6068', 'Parcelas futuras'], [p.track, 'Disponível']].map(([cor, l]) => (
              <Row key={l} style={{ gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor }} /><T s={11} c={p.sub}>{l}</T></Row>
            ))}
          </Row>
          <Row>{[['Limite', sum.limit], ['Comprometido', sum.committed], ['Livre', sum.available]].map(([l, v]) => <View key={l} style={{ flex: 1, gap: 4 }}><Label>{l}</Label><T s={13} w="800">{money(v)}</T></View>)}</Row>
          <Row>
            <Btn style={{ flex: 1 }} onPress={() => router.push({ pathname: '/fatura', params: { cardId: card.id } })}>Ver fatura</Btn>
            <Btn kind="ghost" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/novo-cartao', params: { id: card.id } })}>Gerenciar</Btn>
          </Row>
        </Card>
      )}

      {cards && cards.filter((c) => c.status === 'ACTIVE').length > 0 && (
        <View style={{ gap: 12 }}>
          <T s={20} w="700">Limites dos cartões</T>
          <Row style={{ alignItems: 'flex-start' }}>
            {cards.filter((c) => c.status === 'ACTIVE').map((k, i) => (
              <View key={k.id} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Ring f={(k.summary?.usedPercent ?? 0) / 100} color={cardColor(k, i)}><T s={13} w="800">{Math.round(k.summary?.usedPercent ?? 0)}%</T></Ring>
                <T s={12} w="700">{k.name}</T><T s={11} c={p.mute}>{money(k.summary?.available ?? 0, {})} livres</T>
              </View>
            ))}
          </Row>
          <T s={11} c={p.mute}>Limite estimado pelo app com base nas compras e parcelas registradas. O oficial é o informado pelo banco.</T>
        </View>
      )}

      <View style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T s={20} w="700">Contas e dinheiro</T>
          <Pressable onPress={() => router.push('/nova-movimentacao')} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="700" c={p.link}>Transferir</T></Pressable>
        </Row>
        {data && data.wallets.length === 0 && <T s={13} c={p.mute}>Você ainda não cadastrou nenhuma conta.</T>}
        {data?.wallets.map(linha)}
        <Pressable onPress={() => router.push('/nova-conta')} style={{ height: 52, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.dash, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
          <Icon d={I.plus} size={18} /><T s={14} w="700">Adicionar conta</T>
        </Pressable>
      </View>

      {arquivadas && arquivadas.wallets.length > 0 && (
        <View style={{ gap: 4 }}>
          <Pressable onPress={() => setVerArquivadas(!verArquivadas)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T s={13} w="700" c={p.link}>{verArquivadas ? 'Ocultar' : 'Ver'} contas arquivadas ({arquivadas.wallets.length})</T>
          </Pressable>
          {verArquivadas && arquivadas.wallets.map(linha)}
        </View>
      )}

      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon d={I.link} color={C.cyan} />
        <View style={{ flex: 1, gap: 3 }}><T s={14} w="700">Conectar bancos (Open Finance)</T><T s={12} c={p.mute}>Em breve. Por enquanto, importe o extrato em CSV/OFX pela tela Extrato.</T></View>
      </Card>
    </Screen>
  );
}
