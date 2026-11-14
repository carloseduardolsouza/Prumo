import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { authApi } from '@/api/auth';
import { financeApi, plannerApi, type Spendable, money, moneyKind, monthLabel, monthRange, shortDate, today, walletBadge, type StatementItem, type WalletList } from '@/api/finance';
import { messageApi } from '@/api/message';
import { Badge, Card, Icon, I, Label, Notice, Row, Screen, Sigla, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { firstName, initials } from '@/state/format';
import { errorMessage, useSession } from '@/state/session';

const atalhos: [string, string, string, string][] = [
  [I.cal, C.blue, 'Calendário', '/calendario'],
  [I.target, C.green, 'Orçamentos e metas', '/planejamento'],
  [I.bank, C.red, 'Dívidas e consórcio', '/dividas'],
  [I.repeat, C.yellow, 'Recorrentes', '/recorrentes'],
  [I.pulse, C.violet, 'Saúde financeira', '/saude'],
  [I.up, C.cyan, 'Patrimônio total', '/patrimonio'],
];

const ICON: Record<string, [string, string]> = { income: [I.job, C.green], expense: [I.bag, C.yellow], transfer: [I.swap, '#9DB8F7'] };

export default function Inicio() {
  const p = useP();
  const { user, prefs } = useSession();
  const [hide, setHide] = useState(prefs?.hideValuesOnOpen ?? false);
  const [reenviado, setReenviado] = useState(false);
  const [unread, setUnread] = useState(0);
  const [busca, setBusca] = useState('');
  const [wallets, setWallets] = useState<WalletList | null>(null);
  const [mes, setMes] = useState<{ income: string; expense: string } | null>(null);
  const [recentes, setRecentes] = useState<StatementItem[]>([]);
  const [proximos, setProximos] = useState<StatementItem[]>([]);
  const [erro, setErro] = useState('');
  const [gasto, setGasto] = useState<Spendable | null>(null);

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const m = monthRange(now.getFullYear(), now.getMonth());
      const fim = new Date(now.getTime() + 30 * 86_400_000);
      const [w, st, prox, n, sp] = await Promise.all([
        financeApi.wallets(),
        financeApi.statement({ ...m, status: 'settled', limit: 200 }),
        financeApi.statement({ from: today(), to: `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`, status: 'planned', limit: 50 }),
        messageApi.unreadCount().catch(() => 0),
        plannerApi.spendable().catch(() => null),
      ]);
      setGasto(sp);
      setWallets(w);
      setMes(st.summary);
      setRecentes(st.items.slice(0, 4));
      setProximos(prox.items.filter((i) => i.status !== 'settled').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4));
      setUnread(n);
      setErro('');
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const v = (s: string) => money(s, { hide });
  const now = new Date();

  return (
    <Screen>
      <Row>
        <Pressable accessibilityLabel="Abrir perfil" onPress={() => router.push('/perfil')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.card2, alignItems: 'center', justifyContent: 'center' }}>
          <T s={14} w="800">{initials(user?.name ?? '')}</T>
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, borderRadius: 16, backgroundColor: p.card, paddingHorizontal: 14 }}>
          <Icon d={I.search} color={p.mute} size={18} />
          <TextInput accessibilityLabel="Buscar" value={busca} onChangeText={setBusca} onSubmitEditing={() => router.push({ pathname: '/extrato', params: { q: busca } })} returnKeyType="search" placeholder="Buscar movimentação" placeholderTextColor={p.mute} style={{ flex: 1, color: p.text, fontSize: 14 }} />
        </View>
        <Pressable accessibilityLabel={unread ? `Notificações, ${unread} novas` : 'Notificações'} onPress={() => router.push('/notificacoes')} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: p.card, alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={I.bell} />
          {unread > 0 && <View style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red }} />}
        </Pressable>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ gap: 4 }}><Label>Conta pessoal</Label><T s={28} w="700">Olá, {firstName(user?.name ?? '')}</T></View>
        <Pressable accessibilityLabel="Adicionar movimentação" onPress={() => router.push('/nova-movimentacao')} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: p.text, alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={I.plus} color={p.bg} size={24} sw={2.2} />
        </Pressable>
      </Row>

      {user && !user.emailVerified && (
        <Card style={{ backgroundColor: p.warnBg, gap: 6 }}>
          <T s={13} w="800" c={C.yellow}>Confirme seu e-mail</T>
          <T s={12} c={p.sub}>Enviamos um link para {user.email}.</T>
          <Pressable onPress={() => authApi.resendVerification().then(() => setReenviado(true)).catch(() => undefined)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T s={13} w="700" c={p.link}>{reenviado ? 'Link reenviado' : 'Reenviar link'}</T>
          </Pressable>
        </Card>
      )}
      {erro ? <Notice kind="err">{erro}</Notice> : null}

      <Card style={{ padding: 22, gap: 14 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 8 }}>
            <Label>Saldo disponível</Label>
            {wallets ? <T s={34} w="700">{v(wallets.summary.totalBalance)}</T> : <ActivityIndicator color={p.accent} />}
          </View>
          <Pressable accessibilityLabel="Ocultar valores" onPress={() => setHide(!hide)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon d={I.eye} color={p.mute} />
          </Pressable>
        </Row>
        {wallets && (
          <Row style={{ justifyContent: 'space-between' }}>
            <T s={12} c={p.mute}>{wallets.summary.activeCount} {wallets.summary.activeCount === 1 ? 'conta' : 'contas'} · atualizado agora</T>
            <Row style={{ gap: 6 }}>{wallets.wallets.slice(0, 4).map((w) => { const b = walletBadge(w); return <Sigla key={w.id} t={b.text} bg={b.bg} size={26} />; })}</Row>
          </Row>
        )}
        {wallets && wallets.wallets.length === 0 && (
          <Pressable onPress={() => router.push('/nova-conta')} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="700" c={p.link}>Cadastre sua primeira conta</T></Pressable>
        )}
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {atalhos.map(([d, c, t, href]) => (
          <Pressable key={t} onPress={() => router.push(href as never)} style={{ width: '31.4%', minHeight: 84, borderRadius: 20, backgroundColor: p.card, padding: 12, gap: 8 }}>
            <Icon d={d} color={c} size={20} />
            <T s={12} w="700">{t}</T>
          </Pressable>
        ))}
      </View>

      <Row style={{ alignItems: 'stretch' }}>
        {[['Receitas', mes?.income, 'Entradas em ' + monthLabel(now.getFullYear(), now.getMonth()).split(' ')[0]!.toLowerCase()], ['Despesas', mes?.expense, 'Gastos em ' + monthLabel(now.getFullYear(), now.getMonth()).split(' ')[0]!.toLowerCase()]].map(([l, val, sub]) => (
          <Pressable key={l} onPress={() => router.push('/extrato')} style={{ flex: 1, borderRadius: 24, backgroundColor: p.card, padding: 16, gap: 14 }}>
            <Label>{l}</Label>
            <View style={{ gap: 3 }}><T s={17} w="800">{val === undefined ? '—' : v(val)}</T><T s={12} c={p.mute}>{sub}</T></View>
          </Pressable>
        ))}
      </Row>

      {gasto?.hasBudget && (
        <Pressable onPress={() => router.push('/planejamento')} style={{ borderRadius: 24, backgroundColor: p.card, padding: 16, gap: 6 }}>
          <Label>Hoje você pode gastar</Label>
          <T s={26} w="800">{v(gasto.availableToday)}</T>
          <T s={12} c={p.mute}>limite diário {v(gasto.dailyLimit)} · {gasto.daysLeft} dia(s) até o fim do mês</T>
        </Pressable>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}><T s={20} w="700">Próximos vencimentos</T><T s={11} c={p.mute}>Previstos</T></Row>
        {proximos.length === 0 && <T s={13} c={p.mute}>Nada previsto para os próximos 30 dias.</T>}
        {proximos.map((i) => (
          <Pressable key={i.id} onPress={() => router.push({ pathname: '/movimentacao', params: { id: i.id } })}>
            <Row>
              <View style={{ width: 4, height: 34, borderRadius: 2, backgroundColor: i.kind === 'income' ? C.green : C.yellow }} />
              <View style={{ flex: 1 }}><T s={14} w="600">{i.description}</T><T s={12} c={p.mute}>{shortDate(i.date)}</T></View>
              <T s={14} w="700" c={i.kind === 'income' ? C.green : p.text}>{moneyKind(i.kind, i.plannedAmount, hide)}</T>
            </Row>
          </Pressable>
        ))}
      </Card>

      <View style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <T s={20} w="700">Últimas movimentações</T>
          <Pressable onPress={() => router.push('/extrato')} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="700" c={p.link}>Ver todas</T></Pressable>
        </Row>
        {recentes.length === 0 && wallets && <T s={13} c={p.mute}>Nenhuma movimentação efetivada neste mês.</T>}
        {recentes.map((m) => {
          const [d, c] = ICON[m.kind]!;
          return (
            <Pressable key={m.id} onPress={() => m.kind !== 'transfer' && router.push({ pathname: '/movimentacao', params: { id: m.id } })}>
              <Row style={{ paddingVertical: 8 }}>
                <Badge d={d} color={c} />
                <View style={{ flex: 1, gap: 3 }}><T s={15} w="600">{m.description}</T><T s={12} c={p.mute}>{m.categoryName ?? (m.kind === 'transfer' ? 'Transferência' : 'Sem categoria')} · {m.walletName ?? '—'}</T></View>
                <T s={15} w="700" c={m.kind === 'income' ? C.green : m.kind === 'transfer' ? '#9DB8F7' : p.text}>{moneyKind(m.kind, m.amount, hide)}</T>
              </Row>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
