import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { dayHeading, financeApi, iso, money, monthLabel, monthRange, planningApi, shortDate, today as hoje, type CalendarEvent, type Projection } from '@/api/finance';
import { Card, I, Icon, Label, MonthNav, Notice, Pill, Row, Screen, T, useP } from '@/ui/kit';
import { Lines } from '@/ui/charts';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const KIND_COLOR: Record<CalendarEvent['kind'], string> = { income: C.green, expense: C.yellow, invoice: '#A55BE8', transfer: C.cyan, financing: C.red, consortium: C.red, investment: C.cyan };
const LEGENDA: [string, string][] = [[C.green, 'Receita'], [C.yellow, 'Conta'], ['#A55BE8', 'Fatura'], [C.red, 'Dívida'], [C.cyan, 'Investimento/transf.']];
const SINAL = (e: CalendarEvent) => (e.kind === 'income' ? '+ ' : e.kind === 'transfer' || e.kind === 'investment' ? '' : '− ');

export default function Calendario() {
  const p = useP();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [dia, setDia] = useState(hoje());
  const [cal, setCal] = useState<Awaited<ReturnType<typeof planningApi.calendar>> | null>(null);
  const [proj, setProj] = useState<Projection | null>(null);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    try {
      const { from, to } = monthRange(ym.y, ym.m);
      const [c, pr] = await Promise.all([planningApi.calendar(from, to), planningApi.projection(90)]);
      setCal(c); setProj(pr); setErro('');
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, [ym]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mover = (d: number) => { const n = new Date(ym.y, ym.m + d, 1); setYm({ y: n.getFullYear(), m: n.getMonth() }); setDia(iso(n)); };
  const primeiro = new Date(ym.y, ym.m, 1).getDay();
  const nDias = new Date(ym.y, ym.m + 1, 0).getDate();
  const celulas = Array.from({ length: Math.ceil((primeiro + nDias) / 7) * 7 }, (_, i) => i - primeiro + 1);
  const dataDe = (n: number) => iso(new Date(ym.y, ym.m, n));
  const eventos = (cal?.events ?? []).filter((e) => e.date === dia);
  const saldos = (proj?.days ?? []).map((d) => Number(d.balance));

  return (
    <Screen eyebrow="Conta pessoal" title="Calendário" back>
      <Card style={{ gap: 10 }}>
        <MonthNav label={monthLabel(ym.y, ym.m)} onPrev={() => mover(-1)} onNext={() => mover(1)} />
        <Row style={{ gap: 0 }}>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, i) => <T key={i} s={11} w="700" c={p.mute} style={{ flex: 1, textAlign: 'center' }}>{w}</T>)}</Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {celulas.map((n, i) => {
            const real = n >= 1 && n <= nDias;
            const d = real ? dataDe(n) : '';
            const on = real && d === dia;
            const kinds = real ? cal?.days[d]?.kinds.slice(0, 3) ?? [] : [];
            return (
              <Pressable key={i} disabled={!real} accessibilityLabel={real ? `${n} de ${monthLabel(ym.y, ym.m).split(' ')[0]!.toLowerCase()}${cal?.days[d] ? `, ${cal.days[d]!.count} eventos` : ''}` : undefined} accessibilityState={{ selected: on }} onPress={() => setDia(d)}
                style={{ width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 14, backgroundColor: on ? p.text : 'transparent', borderWidth: d === hoje() && !on ? 1.5 : 0, borderColor: p.text, opacity: real ? 1 : 0 }}>
                <T s={14} w="700" c={on ? p.bg : real && d < hoje() ? p.mute : p.text}>{real ? n : ''}</T>
                <Row style={{ gap: 3, height: 5 }}>{kinds.map((k) => <View key={k} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: KIND_COLOR[k] }} />)}</Row>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{LEGENDA.map(([c, l]) => <Row key={l} style={{ gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><T s={11} c={p.sub}>{l}</T></Row>)}</View>
      </Card>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      {!cal && !erro && <ActivityIndicator color={p.accent} />}

      <View style={{ gap: 6 }}>
        <T s={20} w="700">{dayHeading(dia)}{dia === hoje() ? ' · hoje' : ''}</T>
        <T s={12} c={p.mute}>{eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'}</T>
        {cal && eventos.length === 0 && <Card><T s={13} c={p.mute} style={{ textAlign: 'center' }}>Nenhum evento neste dia</T></Card>}
        {eventos.map((e) => (
          <Pressable key={`${e.kind}-${e.id}`} onPress={() => e.href && router.push(e.href as never)}>
            <Row style={{ paddingVertical: 8 }}>
              <View style={{ width: 4, height: 40, borderRadius: 2, backgroundColor: KIND_COLOR[e.kind] }} />
              <View style={{ flex: 1, gap: 2 }}><T s={15} w="600">{e.title}</T><T s={12} c={p.mute}>{e.info}</T></View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <T s={15} w="700" c={e.kind === 'income' ? C.green : p.text}>{e.amount ? `${SINAL(e)}${money(e.amount)}` : '—'}</T>
                <Pill color={e.status === 'overdue' ? p.red : p.sub} dashed={e.status !== 'settled'}>{e.status === 'settled' ? 'Efetivado' : e.status === 'overdue' ? 'Atrasado' : e.status === 'partial' ? 'Parcial' : 'Previsto'}</Pill>
              </View>
            </Row>
          </Pressable>
        ))}
      </View>

      {proj && saldos.length > 1 && (
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}><Label>Projeção de saldo · 90 dias</Label><T s={11} c={p.mute}>estimativa</T></Row>
          <View><T s={24} w="800" c={Number(proj.endBalance) < 0 ? p.red : p.text}>{money(proj.endBalance)}</T><T s={12} c={p.mute}>previsto em {shortDate(proj.days.at(-1)!.date)}</T></View>
          <Lines height={140} series={[{ values: saldos, color: p.text }]} refLine={Math.min(...saldos) < 0 ? { value: 0, color: C.red } : undefined} />
          {Math.min(...saldos) < 0 && <T s={11} c="#FF8A8E">Linha tracejada: saldo zero</T>}
          <Row style={{ justifyContent: 'space-between' }}>{[0, 30, 60, saldos.length - 1].map((i) => <T key={i} s={10} c={p.mute}>{shortDate(proj.days[Math.min(i, proj.days.length - 1)]!.date)}</T>)}</Row>
          <T s={11} c={p.mute}>{proj.assumptions}</T>
        </Card>
      )}

      {proj?.firstNegative && (
        <Card style={{ borderWidth: 1, borderColor: p.red, backgroundColor: p.errBg }}>
          <T s={14} w="800" c={p.red}>Saldo pode ficar negativo em {shortDate(proj.firstNegative.date)}</T>
          <T s={13} c={p.sub} style={{ lineHeight: 19 }}>Projeção: {money(proj.firstNegative.balance)}. {proj.negativeDays} {proj.negativeDays === 1 ? 'dia' : 'dias'} no negativo nos próximos 90. Antecipe uma receita, reduza gastos ou mude a data de um pagamento.</T>
        </Card>
      )}
      <Pressable onPress={() => router.push('/recorrentes')} style={{ minHeight: 44, justifyContent: 'center' }}><Row style={{ gap: 6 }}><Icon d={I.repeat} size={16} color={p.link} /><T s={13} w="700" c={p.link}>Contas fixas e assinaturas</T></Row></Pressable>
    </Screen>
  );
}
