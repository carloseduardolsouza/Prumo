import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { financeApi, investApi, money, parseMoney, plannerApi } from '@/api/finance';
import { Badge, Bar, Btn, Card, Chips, Field, I, Label, Notice, Ring, Row, Screen, T, Toggle, useP } from '@/ui/kit';
import { Lines } from '@/ui/charts';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';
import { useLoad } from '@/state/useLoad';

export default function Patrimonio() {
  const p = useP();
  const nw = useLoad(plannerApi.netWorth);
  const rules = useLoad(plannerApi.autoInvest);
  const wl = useLoad(financeApi.wallets);
  const brk = useLoad(investApi.brokerages);
  const [novo, setNovo] = useState(false);
  const [wallet, setWallet] = useState('');
  const [inst, setInst] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState('5');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const n = nw.data;
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ ok: true, t: ok }); await Promise.all([rules.reload(), nw.reload()]); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); } };

  const criar = () => {
    const w = wallet || wl.data?.wallets[0]?.id, b = inst || brk.data?.[0]?.id;
    if (!w || !b || !Number(parseMoney(valor))) return setMsg({ ok: false, t: 'Escolha a carteira, a instituição e o valor.' });
    run(async () => { await plannerApi.createAutoInvest({ walletId: w, brokerageId: b, amount: parseMoney(valor), dayOfMonth: Number(dia) || 5 }); setNovo(false); setValor(''); }, 'Regra criada.');
  };
  const parts = n ? [[C.blue, 'Conta Pessoal · saldo', n.parts.personal, '/inicio'], [C.cyan, 'Conta Investimentos', n.parts.investments, '/inv-inicio'], [C.red, 'Financiamentos e empréstimos', n.parts.financings, '/dividas'], [C.orange, 'Faturas de cartão em aberto', n.parts.cardInvoices, '/carteira']] as [string, string, string, string][] : [];
  const pos = n ? Number(n.parts.personal) + Number(n.parts.investments) : 0, neg = n ? Math.abs(Number(n.parts.financings)) + Math.abs(Number(n.parts.cardInvoices)) : 0;

  return (
    <Screen eyebrow="Pessoal + investimentos" title="Visão integrada" back>
      <T s={13} c={p.sub}>As contas continuam separadas. Esta tela só soma os números para mostrar o todo.</T>
      {nw.error ? <Notice kind="err">{nw.error}</Notice> : null}
      {!n && !nw.error && <ActivityIndicator color={p.accent} />}
      {n && (
        <>
          <Card style={{ gap: 12 }}>
            <Label>Patrimônio líquido total</Label>
            <T s={34} w="700">{money(n.total)}</T>
            <T s={13} w="700" c={Number(n.change12m) >= 0 ? C.green : p.red}>{Number(n.change12m) >= 0 ? '▲' : '▼'} {money(Math.abs(Number(n.change12m)))} em 12 meses</T>
            {n.series.some((s) => s.personal + s.investments !== 0) && <Lines height={90} series={[{ values: n.series.map((s) => s.personal + s.investments), color: p.accent, area: true }]} />}
            {pos + neg > 0 && <View style={{ height: 12, flexDirection: 'row', borderRadius: 999, overflow: 'hidden', gap: 2 }}>
              {Number(n.parts.personal) > 0 && <View style={{ flex: Number(n.parts.personal), backgroundColor: C.blue }} />}{Number(n.parts.investments) > 0 && <View style={{ flex: Number(n.parts.investments), backgroundColor: C.cyan }} />}{neg > 0 && <View style={{ flex: neg, backgroundColor: C.red }} />}
            </View>}
            {parts.map(([c, l, v, h]) => (
              <Pressable key={l} onPress={() => router.push(h as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><T s={13} c={p.sub} style={{ flex: 1 }}>{l}</T><T s={13} w="800">{money(v)}</T>
              </Pressable>
            ))}
            {Number(n.consortiumObligations) > 0 && <T s={11} c={p.mute}>Consórcios: {money(n.consortiumObligations)} ainda a pagar, fora desta soma (a carta só vale após a contemplação).</T>}
            <T s={11} c={p.mute}>{n.note}</T>
          </Card>

          <Card style={{ gap: 14 }}>
            <Label>Meta de liberdade financeira</Label>
            <Row style={{ gap: 16 }}>
              <Ring f={Math.min(1, (n.freedom.coveragePercent ?? 0) / 100)} color={C.cyan} size={104} stroke={12}><T s={16} w="800">{n.freedom.coveragePercent === null ? '—' : `${n.freedom.coveragePercent}%`}</T></Ring>
              <View style={{ flex: 1, gap: 4 }}><T s={14} w="700">{n.freedom.coveragePercent === null ? 'Sem despesas registradas para comparar' : `Seus proventos já pagam ${n.freedom.coveragePercent}% das despesas do mês`}</T><T s={11} c={p.mute}>{money(n.freedom.passiveMonthly)} de proventos ÷ {money(n.freedom.averageExpense)} de despesa média</T></View>
            </Row>
            {n.freedom.coverage.map((c) => <Row key={c.name}><T s={12} c={p.sub} style={{ width: 110 }} lines={1}>{c.name}</T><View style={{ flex: 1 }}><Bar f={c.covered} color={c.covered >= 1 ? C.cyan : '#2C8F84'} /></View><T s={12} w="800" style={{ width: 40, textAlign: 'right' }}>{Math.round(c.covered * 100)}%</T></Row>)}
            {n.freedom.coverage.length === 0 && <T s={12} c={p.mute}>Cadastre despesas recorrentes para ver quais já são cobertas pelos proventos.</T>}
          </Card>
        </>
      )}

      <View style={{ gap: 10 }}>
        <T s={20} w="700">Aporte automático</T>
        {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}
        {rules.data?.length === 0 && !novo && <Card><T s={13} c={p.sub}>Crie uma regra mensal: no dia escolhido o app lembra você de transferir da conta pessoal para a instituição.</T></Card>}
        {rules.data?.map((r) => (
          <Card key={r.id} style={{ gap: 10 }}>
            <Row>
              <Badge d={I.repeat} color={C.cyan} size={42} bg={p.card2} />
              <View style={{ flex: 1, gap: 3 }}><T s={14} w="700">{money(r.amount)} todo dia {r.dayOfMonth}</T><T s={12} c={p.sub}>{r.wallet} → {r.brokerage}</T><T s={11} w="700" c={!r.active ? p.mute : r.due ? C.yellow : C.cyan}>{!r.active ? 'Desligada' : r.due ? 'Aguardando sua confirmação este mês' : r.lastRunMonth ? `Confirmado em ${r.lastRunMonth.split('-').reverse().join('/')}` : 'Ativa'}</T></View>
              <Toggle label={`Regra ${r.brokerage}`} value={r.active} onChange={(v) => run(() => plannerApi.toggleAutoInvest(r.id, v), v ? 'Regra ligada.' : 'Regra desligada.')} />
            </Row>
            {r.due && <Btn onPress={() => run(() => plannerApi.confirmAutoInvest(r.id), 'Aporte registrado: saiu da conta pessoal e entrou nos investimentos.')}>Confirmar aporte de {money(r.amount)}</Btn>}
            <Pressable onPress={() => run(() => plannerApi.removeAutoInvest(r.id), 'Regra removida.')} style={{ minHeight: 36, justifyContent: 'center' }}><T s={11} w="700" c={p.mute}>Remover regra</T></Pressable>
          </Card>
        ))}
        {novo ? (
          <Card style={{ gap: 12 }}>
            <Label>Nova regra mensal</Label>
            <Chips value={wallet || wl.data?.wallets[0]?.id || ''} onChange={setWallet} items={(wl.data?.wallets ?? []).map((w) => [w.id, w.name] as [string, string])} />
            {brk.data?.length === 0 ? <T s={12} c={p.sub}>Cadastre uma instituição em Investimentos › Corretoras e bancos.</T> : <Chips value={inst || brk.data?.[0]?.id || ''} onChange={setInst} items={(brk.data ?? []).map((b) => [b.id, b.name] as [string, string])} />}
            <Row><View style={{ flex: 1 }}><Field label="Valor (R$)" value={valor} onChange={setValor} keyboard="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Dia do mês (1–28)" value={dia} onChange={setDia} keyboard="decimal-pad" /></View></Row>
            <Btn onPress={criar}>Criar regra</Btn>
          </Card>
        ) : <Btn kind="ghost" onPress={() => setNovo(true)}>Nova regra de aporte</Btn>}
        <T s={11} c={p.mute}>O app registra a transferência entre as contas só quando você confirma. Nada é movimentado no banco sem sua ação.</T>
      </View>
    </Screen>
  );
}
