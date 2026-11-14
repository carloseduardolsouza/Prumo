import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { iso, money, parseMoney, plannerApi } from '@/api/finance';
import { Bar, Btn, Card, Field, Label, Notice, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const cores = [C.green, C.blue, C.yellow, C.violet, C.red, C.cyan];
const num = (v: string) => Number(parseMoney(v)) || 0;

export default function NovaMeta() {
  const p = useP();
  const [tipo, setTipo] = useState<'SAVING' | 'FREEDOM'>('SAVING');
  const [nome, setNome] = useState('');
  const [alvo, setAlvo] = useState('');
  const [atual, setAtual] = useState('');
  const [meses, setMeses] = useState('12');
  const [cor, setCor] = useState(cores[0]!);
  const [erro, setErro] = useState('');
  const busy = useRef(false);
  const m = Math.max(1, Math.round(num(meses)));
  const mensal = Math.max(0, num(alvo) - num(atual)) / m;

  const criar = async () => {
    if (busy.current) return;
    if (!nome.trim() || num(alvo) <= 0) return setErro('Informe o nome e o valor da meta.');
    const prazo = new Date(); prazo.setMonth(prazo.getMonth() + m);
    busy.current = true;
    try {
      await plannerApi.createGoal({ name: nome.trim(), kind: tipo, targetAmount: parseMoney(alvo), color: cor, ...(tipo === 'SAVING' ? { targetDate: iso(prazo), ...(num(atual) > 0 ? { initialAmount: parseMoney(atual) } : {}) } : {}) });
      router.back();
    } catch (e) { setErro(errorMessage(e)); busy.current = false; }
  };

  return (
    <Screen eyebrow="Planejamento" title="Nova meta" back>
      <Seg value={tipo} onChange={setTipo} items={[['SAVING', 'Poupança'], ['FREEDOM', 'Renda passiva']]} />
      <Field label="Nome da meta" value={nome} onChange={setNome} placeholder={tipo === 'SAVING' ? 'Ex.: Reserva de emergência' : 'Ex.: Liberdade financeira'} />
      <Field label={tipo === 'SAVING' ? 'Valor desejado (R$)' : 'Renda mensal desejada (R$)'} value={alvo} onChange={setAlvo} keyboard="decimal-pad" />
      {tipo === 'SAVING' && (
        <>
          <Row>
            <View style={{ flex: 1 }}><Field label="Já acumulado (R$)" value={atual} onChange={setAtual} keyboard="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Prazo (meses)" value={meses} onChange={setMeses} keyboard="decimal-pad" /></View>
          </Row>
        </>
      )}
      <Row style={{ gap: 10 }}>{cores.map((c) => <Pressable key={c} accessibilityLabel={`Cor ${c}`} onPress={() => setCor(c)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, borderWidth: 3, borderColor: cor === c ? p.text : 'transparent' }} />)}</Row>
      <Card style={{ gap: 8 }}>
        <Label>Plano sugerido</Label>
        {tipo === 'SAVING' ? (
          <>
            <T s={22} w="800">{money(mensal)} <T s={13} c={p.mute}>por mês</T></T>
            <Bar f={num(alvo) ? Math.min(1, num(atual) / num(alvo)) : 0} color={cor} h={10} />
          </>
        ) : <T s={13} c={p.sub}>O progresso vem dos proventos dos seus investimentos (média dos últimos 12 meses), sem precisar de aportes na meta.</T>}
      </Card>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      <Btn onPress={criar}>Criar meta</Btn>
    </Screen>
  );
}
