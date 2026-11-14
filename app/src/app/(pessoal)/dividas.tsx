import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { debtApi, money, shortDate, type Consortium, type DebtSummary, type Financing } from '@/api/finance';
import { Bar, Btn, Card, Icon, I, Label, Notice, Pill, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const KIND: Record<string, string> = { REAL_ESTATE: 'Imóvel', VEHICLE: 'Veículo', PERSONAL: 'Pessoal', PAYROLL: 'Consignado', STUDENT: 'Estudantil', PRIVATE: 'Particular', OTHER: 'Outros', SERVICE: 'Serviço' };

export default function Dividas() {
  const p = useP();
  const [aba, setAba] = useState<'fin' | 'cons'>('fin');
  const [sum, setSum] = useState<DebtSummary | null>(null);
  const [fins, setFins] = useState<Financing[] | null>(null);
  const [cons, setCons] = useState<Consortium[] | null>(null);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, f, c] = await Promise.all([debtApi.summary(), debtApi.financings(), debtApi.consortiums()]);
      setSum(s); setFins(f); setCons(c); setErro('');
    } catch (e) { setErro(errorMessage(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen eyebrow="Conta pessoal" title="Dívidas e consórcios" back>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      {!sum && !erro && <ActivityIndicator color={p.accent} />}
      {sum && (
        <Card style={{ gap: 14 }}>
          <Label>Saldo devedor estimado</Label>
          <T s={32} w="700">{money(sum.estimatedBalance)}</T>
          <Row>{[['Parcelas 30d', money(sum.monthlyPayments)], ['Da renda', sum.incomeCommittedPercent === null ? '—' : `${sum.incomeCommittedPercent}%`], ['Juros pagos', money(sum.interestPaid)]].map(([l, v]) => <View key={l} style={{ flex: 1, gap: 4 }}><Label>{l}</Label><T s={13} w="800">{v}</T></View>)}</Row>
          {sum.overdueCount > 0 && <T s={12} w="700" c={p.red}>{sum.overdueCount} {sum.overdueCount === 1 ? 'parcela atrasada' : 'parcelas atrasadas'}</T>}
          <T s={11} c={p.mute}>Estimativa do app. O saldo oficial é o informado pelo credor.</T>
        </Card>
      )}

      <Seg value={aba} onChange={setAba} items={[['fin', 'Financiamentos'], ['cons', 'Consórcios']]} />

      {aba === 'fin' ? (
        <>
          {fins?.length === 0 && <Card style={{ gap: 6 }}><T s={14} w="700">Nenhum financiamento ou empréstimo</T><T s={12} c={p.sub}>Cadastre o contrato para ter cronograma, saldo estimado e simulação de amortização.</T></Card>}
          {fins?.map((f) => (
            <Pressable key={f.id} onPress={() => router.push({ pathname: '/financiamento', params: { id: f.id } })}>
              <Card style={{ gap: 12 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 3 }}><T s={17} w="700">{f.name}</T><T s={12} c={p.mute}>{[f.creditor, KIND[f.kind], f.system, `${f.monthlyRatePercent}% a.m.`].filter(Boolean).join(' · ')}</T></View>
                  <Pill color={f.status === 'PAID_OFF' ? C.green : f.summary.nextDue?.overdue ? C.red : C.green} bg={f.status === 'PAID_OFF' ? p.okBg : f.summary.nextDue?.overdue ? p.errBg : p.okBg}>{f.status === 'PAID_OFF' ? 'QUITADO' : f.summary.nextDue?.overdue ? 'ATRASADO' : 'EM DIA'}</Pill>
                </Row>
                <Row style={{ justifyContent: 'space-between' }}><T s={12} c={p.sub}>{f.summary.paidCount} de {f.summary.totalCount} parcelas pagas</T><T s={12} w="800">{f.summary.totalCount ? Math.round((f.summary.paidCount / f.summary.totalCount) * 100) : 0}%</T></Row>
                <Bar f={f.summary.totalCount ? f.summary.paidCount / f.summary.totalCount : 0} color={C.red} h={10} />
                <Row><View style={{ flex: 1 }}><Label>Saldo estimado</Label><T s={14} w="800">{money(f.summary.estimatedBalance)}</T></View><View style={{ flex: 1 }}><Label>Próxima</Label><T s={14} w="800">{f.summary.nextDue ? `${shortDate(f.summary.nextDue.dueDate)} · ${money(f.summary.nextDue.total)}` : '—'}</T></View></Row>
              </Card>
            </Pressable>
          ))}
          <Btn kind="ghost" onPress={() => router.push('/novo-financiamento')}>Novo financiamento ou empréstimo</Btn>
        </>
      ) : (
        <>
          {cons?.length === 0 && <Card style={{ gap: 6 }}><T s={14} w="700">Nenhum consórcio</T><T s={12} c={p.sub}>Cadastre a cota para acompanhar contribuições, reajustes da carta e contemplação.</T></Card>}
          {cons?.map((c) => (
            <Pressable key={c.id} onPress={() => router.push({ pathname: '/consorcio', params: { id: c.id } })}>
              <Card style={{ gap: 12 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 3 }}><T s={17} w="700">{c.name}</T><T s={12} c={p.mute}>{[c.administrator, c.groupNumber ? `Grupo ${c.groupNumber}` : null, c.quota ? `cota ${c.quota}` : null].filter(Boolean).join(' · ')}</T></View>
                  <Pill color={c.status === 'CONTEMPLATED' ? C.green : C.yellow} bg={c.status === 'CONTEMPLATED' ? p.okBg : p.warnBg}>{c.status === 'CONTEMPLATED' ? 'CONTEMPLADO' : 'NÃO CONTEMPLADO'}</Pill>
                </Row>
                <Row>
                  <View style={{ flex: 1, gap: 4 }}><Label>Carta atual</Label><T s={17} w="800">{money(c.summary.currentLetter, {})}</T>{c.summary.letterGrowthPercent !== 0 && <T s={11} c={C.green}>{c.summary.letterGrowthPercent > 0 ? '+' : ''}{c.summary.letterGrowthPercent}% desde a contratação</T>}</View>
                  <View style={{ flex: 1, gap: 4 }}><Label>Total pago</Label><T s={17} w="800">{money(c.summary.totalPaid)}</T><T s={11} c={p.mute}>{c.summary.paidCount} de {c.summary.totalCount} parcelas</T></View>
                </Row>
                <Bar f={c.summary.paidOverLetterPercent / 100} color={C.blue} h={10} />
                <Row><View style={{ flex: 1 }}><Label>Parcela</Label><T s={13} w="800">{money(c.installmentAmount)}</T></View><View style={{ flex: 1 }}><Label>A pagar</Label><T s={13} w="800">{money(c.summary.remainingObligations)}</T></View></Row>
                {c.nextAssemblyDate && <Row style={{ gap: 6 }}><Icon d={I.cal} size={14} color={p.mute} /><T s={12} c={p.sub}>Próxima assembleia · {shortDate(c.nextAssemblyDate)}</T></Row>}
              </Card>
            </Pressable>
          ))}
          <Btn kind="ghost" onPress={() => router.push('/novo-consorcio')}>Novo consórcio</Btn>
          <T s={11} c={p.mute}>A valorização da carta não é dinheiro disponível nem lucro. Ela só vale depois da contemplação e conforme o contrato.</T>
        </>
      )}
    </Screen>
  );
}
