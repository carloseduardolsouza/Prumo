import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Btn, Card, I, Icon, Label, LinkRow, Row, Seg, T, Toggle, Screen, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import type { Preferences } from '@/api/auth';
import { useSession } from '@/state/session';
import { initials } from '@/state/format';

const ferramentas: [string, string, string, string, string][] = [
  [I.up, C.cyan, 'Visão integrada', '', '/patrimonio'],
  [I.pulse, C.green, 'Saúde financeira', '', '/saude'],
  [I.target, C.violet, 'Orçamentos e metas', '', '/planejamento'],
  [I.bank, C.red, 'Dívidas e consórcio', '', '/dividas'],
  [I.repeat, C.yellow, 'Recorrentes e divisões', '', '/recorrentes'],
  [I.cal, C.blue, 'Calendário', '', '/calendario'],
  [I.bell, C.yellow, 'Notificações', '', '/notificacoes'],
];
const conta: [string, string, string, string, string][] = [
  [I.user, C.blue, 'Dados pessoais', '', '/dados'], [I.shield, C.green, 'Segurança', 'Senha, biometria', '/seguranca'], [I.phone, '#B9BEC6', 'Sessões e dispositivos', '', '/sessoes'],
];
const pref: [string, string, string, string, string][] = [
  [I.bell, C.yellow, 'Notificações', '', '/config-notificacoes'], [I.grid, C.red, 'Categorias', '', '/categorias'], [I.globe, C.blue, 'Moeda e região', 'BRL', '/regiao'], [I.lock, '#B9BEC6', 'Privacidade e dados', 'LGPD', '/privacidade'],
];

export default function Perfil() {
  const p = useP();
  const [sheet, setSheet] = useState(false);
  const { user, prefs, updatePrefs, signOut } = useSession();
  const save = (patch: Partial<Preferences>) => updatePrefs(patch).catch(() => undefined);
  const Sw = ({ t, v, f }: { t: string; v: boolean; f: (b: boolean) => void }) => (
    <Row style={{ minHeight: 52 }}><T s={15} w="600" style={{ flex: 1 }}>{t}</T><Toggle label={t} value={v} onChange={f} /></Row>
  );
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 8 }}>
        <Label>Perfil</Label>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: p.card2, alignItems: 'center', justifyContent: 'center' }}><T s={28} w="800">{initials(user?.name ?? "")}</T></View>
        <T s={24} w="700">{user?.name}</T><T s={13} c={p.mute}>{user?.email}</T>
      </View>

      <View style={{ gap: 10 }}>
        <Label>Suas contas</Label>
        <Card style={{ borderWidth: 1.5, borderColor: C.blue }}>
          <T s={10} w="800" c={C.blue}>ATIVA</T><T s={17} w="700">Conta Pessoal</T><T s={12} c={p.mute}>Contas, cartões e gastos do dia a dia</T>
        </Card>
        <Card onPress={() => setSheet(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Badge d={I.up} color={C.cyan} size={42} bg={p.card2} />
          <View style={{ flex: 1, gap: 2 }}><T s={15} w="700">Ir para Conta de Investimentos</T><T s={12} c={p.mute}>Espaço separado para ativos e rentabilidade</T></View>
          <Icon d={I.next} color={p.mute} size={16} />
        </Card>
      </View>

      <View style={{ gap: 4 }}><Label>Ferramentas</Label>{ferramentas.map(([d, c, t, s, h]) => <LinkRow key={t} icon={d} color={c} title={t} sub={s} href={h} />)}</View>
      <View style={{ gap: 4 }}><Label>Conta</Label>{conta.map(([d, c, t, s, h]) => <LinkRow key={t} icon={d} color={c} title={t} sub={s} href={h} />)}</View>
      <View style={{ gap: 4 }}>
        <Label>Preferências</Label>
        {pref.map(([d, c, t, s, h]) => <LinkRow key={t} icon={d} color={c} title={t} sub={s} href={h} />)}
        <Sw t="Ocultar valores ao abrir" v={prefs?.hideValuesOnOpen ?? false} f={(v) => save({ hideValuesOnOpen: v })} />
        <Sw t="Bloqueio por biometria" v={prefs?.biometricLock ?? false} f={(v) => save({ biometricLock: v })} />
        <Sw t="Widget de saldo na tela inicial" v={prefs?.balanceWidget ?? false} f={(v) => save({ balanceWidget: v })} />
        <View style={{ gap: 8, paddingTop: 6 }}><T s={15} w="600">Tema</T><Seg value={prefs?.theme ?? "escuro"} onChange={(v) => save({ theme: v })} items={[['escuro', 'Escuro'], ['claro', 'Claro'], ['auto', 'Automático']]} /></View>
      </View>

      <Pressable onPress={signOut} style={{ height: 54, borderRadius: 18, backgroundColor: p.card, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
        <Icon d={I.out} color={p.red} /><T s={15} w="700" c={p.red}>Sair da conta</T>
      </Pressable>
      <T s={12} c={p.mute} style={{ textAlign: 'center' }}>Versão 1.0</T>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000A' }}>
          <View accessibilityViewIsModal style={{ backgroundColor: p.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: p.dash }} />
            <T s={20} w="700">Trocar para Conta de Investimentos?</T>
            <T s={14} c={p.sub} style={{ lineHeight: 21 }}>A Conta de Investimentos é separada da Pessoal: tem saldo, ativos, aportes e relatórios próprios. Nada da Conta Pessoal aparece lá, e você volta pelo Perfil quando quiser.</T>
            <Btn onPress={() => { setSheet(false); router.push('/inv-inicio'); }}>Entrar na Conta de Investimentos</Btn>
            <Btn kind="ghost" onPress={() => setSheet(false)}>Continuar na Conta Pessoal</Btn>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
