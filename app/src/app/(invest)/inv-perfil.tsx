import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { COLOR_BY_CLASS, investApi, money } from '@/api/finance';
import { Bar, Btn, Card, Chips, I, Icon, Label, LinkRow, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { C, pct } from '@/ui/theme';
import { initials } from '@/state/format';
import { errorMessage, useSession } from '@/state/session';
import { useLoad } from '@/state/useLoad';

const PERGUNTAS: [string, [string, string, string]][] = [
  ['Por quanto tempo pretende manter o dinheiro investido?', ['Menos de 2 anos', 'De 2 a 5 anos', 'Mais de 5 anos']],
  ['Se a carteira cair 20% em um mês, você…', ['Vende para evitar mais perdas', 'Espera se recuperar', 'Aproveita para comprar mais']],
  ['Qual é o seu objetivo principal?', ['Preservar o capital', 'Equilibrar renda e crescimento', 'Maximizar o crescimento']],
  ['Quanto você conhece de renda variável?', ['Pouco ou nada', 'Já invisto há algum tempo', 'Conheço bem os riscos']],
  ['Quanto do patrimônio precisa de liquidez imediata?', ['Quase tudo', 'Uma parte', 'Muito pouco']],
];
const NOME = { CONSERVATIVE: 'Conservador', MODERATE: 'Moderado', BOLD: 'Arrojado' } as const;
const DESC = {
  CONSERVATIVE: 'Prioriza preservar o capital e aceita retorno menor em troca de estabilidade.',
  MODERATE: 'Aceita oscilações moderadas em busca de retorno acima da renda fixa, mantendo boa parte em ativos estáveis.',
  BOLD: 'Aceita oscilações fortes e prazos longos em busca de maior crescimento.',
} as const;
const IDEAL = { CONSERVATIVE: { FIXED_INCOME: 70, FII: 15, STOCK: 10, CRYPTO: 0 }, MODERATE: { FIXED_INCOME: 40, FII: 25, STOCK: 30, CRYPTO: 5 }, BOLD: { FIXED_INCOME: 15, FII: 20, STOCK: 55, CRYPTO: 10 } } as const;
const LABEL: Record<string, string> = { FIXED_INCOME: 'Renda fixa', FII: 'FIIs', STOCK: 'Ações', CRYPTO: 'Cripto' };

export default function InvPerfil() {
  const p = useP();
  const { user } = useSession();
  const { data: prof, reload } = useLoad(investApi.profile);
  const { data: o } = useLoad(investApi.overview);
  const { data: brk } = useLoad(investApi.brokerages);
  const { data: alerts } = useLoad(investApi.alerts);
  const [fazendo, setFazendo] = useState(false);
  const [resp, setResp] = useState<number[]>([]);
  const [erro, setErro] = useState('');

  const enviar = async () => {
    try { await investApi.setProfile(resp); setFazendo(false); setResp([]); setErro(''); await reload(); } catch (e) { setErro(errorMessage(e)); }
  };
  const ideal = prof?.profile ? IDEAL[prof.profile] : null;
  const config: [string, string, string, string, string][] = [
    [I.bank, C.blue, 'Corretoras e bancos', `${brk?.length ?? 0} cadastrada(s)`, '/inv-corretoras'], [I.doc, C.yellow, 'Imposto de Renda', 'Apuração e DARF', '/inv-ir'],
    [I.bell, C.cyan, 'Radar e alertas', `${alerts?.length ?? 0} alerta(s)`, '/inv-radar'], [I.cal, C.green, 'Simuladores e preço-teto', '', '/inv-simulador'],
    [I.up, C.violet, 'Visão integrada', 'Pessoal + investimentos', '/patrimonio'], [I.repeat, '#8A9099', 'Atualização de cotações', 'Manual', '/inv-cotacoes'],
  ];

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: p.card2, alignItems: 'center', justifyContent: 'center' }}><T s={28} w="800">{initials(user?.name ?? '')}</T></View>
        <Label>Conta investimentos</Label><T s={24} w="700">{user?.name}</T>
      </View>

      <Card style={{ gap: 12 }}>
        <Label>Perfil de investidor (suitability)</Label>
        {fazendo ? (
          <>
            {PERGUNTAS.map(([q, opts], i) => (
              <View key={q} style={{ gap: 8 }}>
                <T s={13} w="700">{i + 1}. {q}</T>
                <Chips value={String(resp[i] ?? 0)} onChange={(v) => { const r = [...resp]; r[i] = Number(v); setResp(r); }} items={opts.map((t, k) => [String(k + 1), t] as [string, string])} />
              </View>
            ))}
            {erro ? <Notice kind="err">{erro}</Notice> : null}
            <Btn onPress={enviar} style={{ opacity: PERGUNTAS.every((_, i) => resp[i]) ? 1 : 0.5 }}>Salvar perfil</Btn>
            <Pressable onPress={() => setFazendo(false)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><T s={13} w="700" c={p.mute}>Cancelar</T></Pressable>
          </>
        ) : prof?.profile ? (
          <>
            <T s={26} w="800">{NOME[prof.profile]}</T><T s={12} c={p.mute}>Pontuação {prof.score} de 15 · respondido em {prof.updatedAt?.slice(0, 10).split('-').reverse().join('/')}</T>
            <T s={13} c={p.sub} style={{ lineHeight: 19 }}>{DESC[prof.profile]}</T>
            <Pressable onPress={() => { setFazendo(true); setResp(prof.answers); }} style={{ minHeight: 44, justifyContent: 'center' }}><T s={13} w="700" c={p.accent}>Refazer teste</T></Pressable>
          </>
        ) : (
          <><T s={13} c={p.sub}>Responda 5 perguntas para o app sugerir uma alocação de referência. Não é recomendação personalizada.</T><Btn onPress={() => setFazendo(true)}>Fazer o teste</Btn></>
        )}
      </Card>

      {ideal && o && (
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}><Label>Alocação de referência × atual</Label><T s={11} c={p.mute}>perfil {NOME[prof!.profile!].toLowerCase()}</T></Row>
          {Object.entries(ideal).map(([k, meta]) => {
            const atual = o.allocation.find((c) => c.assetClass === k)?.percent ?? 0;
            return (
              <View key={k} style={{ gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}><Row style={{ gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_BY_CLASS[k] }} /><T s={13} w="600">{LABEL[k]}</T></Row><T s={12} c={p.mute}><T s={12} w="800">{pct(atual)}</T> / {pct(meta, 0)}</T></Row>
                <View><Bar f={Math.min(1, atual / 100)} color={COLOR_BY_CLASS[k]!} h={8} /><View style={{ position: 'absolute', left: `${meta}%`, top: -2, width: 2, height: 12, backgroundColor: p.text }} /></View>
              </View>
            );
          })}
          <T s={11} c={p.mute}>A linha marca a referência do perfil. Defina suas próprias metas na tela Carteira.</T>
        </Card>
      )}

      {o?.passiveGoal && (
        <View style={{ gap: 10 }}>
          <T s={20} w="700">Meta de renda passiva</T>
          <Card style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}><T s={14} w="700" style={{ flex: 1 }}>{money(o.passiveGoal.target)} por mês</T><T s={14} w="800">{pct(o.passiveGoal.percent)}</T></Row>
            <Bar f={Math.min(1, o.passiveGoal.percent / 100)} color={C.cyan} h={8} />
            <T s={12} c={p.mute}>Hoje: {money(o.dividends.monthlyAverage)}/mês em média nos últimos 12 meses</T>
          </Card>
        </View>
      )}

      <View style={{ gap: 4 }}><Label>Instituições e configurações</Label>{config.map(([d, c, t, s, h]) => <LinkRow key={t} icon={d} color={c} title={t} sub={s} href={h} />)}</View>

      <Pressable onPress={() => router.replace('/inicio')} style={{ height: 54, borderRadius: 18, backgroundColor: p.card, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
        <Icon d={I.back} /><T s={15} w="700">Voltar para Conta Pessoal</T>
      </Pressable>
      <T s={11} c={p.mute} style={{ textAlign: 'center' }}>O app registra e acompanha investimentos; não executa ordens nem faz recomendação personalizada.</T>
    </Screen>
  );
}
