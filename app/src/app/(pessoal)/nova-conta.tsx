import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WALLET_TYPES, financeApi, money, newKey, parseMoney, today, type Wallet, type WalletType } from '@/api/finance';
import { Btn, Card, Chips, Field, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const cores = [C.nu, C.inter, C.itau, C.blue, C.green, C.yellow, C.red];

// Cria uma conta ou, com ?id=, edita/arquiva/ajusta o saldo de uma existente.
export default function NovaConta() {
  const p = useP();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = Boolean(id);
  const [w, setW] = useState<Wallet | null>(null);
  const [nome, setNome] = useState('');
  const [inst, setInst] = useState('');
  const [tipo, setTipo] = useState<WalletType>('CHECKING');
  const [saldo, setSaldo] = useState('');
  const [data, setData] = useState(today());
  const [cor, setCor] = useState<string | undefined>();
  const [novoSaldo, setNovoSaldo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [carregando, setCarregando] = useState(editando);
  const key = useRef(newKey());

  useEffect(() => {
    if (!id) return;
    financeApi.wallet(id).then((x) => { setW(x); setNome(x.name); setInst(x.institution ?? ''); setTipo(x.type); setCor(x.color ?? undefined); }).catch((e) => setMsg({ ok: false, t: errorMessage(e) })).finally(() => setCarregando(false));
  }, [id]);

  const run = async (fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); }
  };

  const salvar = () => run(async () => {
    if (!nome.trim()) return setMsg({ ok: false, t: 'Dê um nome para identificar.' });
    if (editando) {
      setW(await financeApi.updateWallet(id!, { name: nome.trim(), type: tipo, institution: inst.trim(), ...(cor ? { color: cor } : {}) }));
      return setMsg({ ok: true, t: 'Conta atualizada.' });
    }
    const opening = parseMoney(saldo || '0');
    if (!/^-?\d+(\.\d{1,2})?$/.test(opening)) return setMsg({ ok: false, t: 'Saldo inicial inválido.' });
    await financeApi.createWallet({ name: nome.trim(), type: tipo, ...(inst.trim() ? { institution: inst.trim() } : {}), ...(cor ? { color: cor } : {}), openingBalance: opening, openingDate: data }, key.current);
    router.back();
  });

  const arquivar = () => run(async () => {
    const u = await financeApi.archiveWallet(id!, !w?.archived);
    setW(u);
    setMsg({ ok: true, t: u.archived ? 'Conta arquivada. O histórico foi mantido.' : 'Conta reativada.' });
  });

  const ajustar = () => run(async () => {
    const n = parseMoney(novoSaldo);
    if (!/^-?\d+(\.\d{1,2})?$/.test(n)) return setMsg({ ok: false, t: 'Informe o saldo correto.' });
    if (motivo.trim().length < 3) return setMsg({ ok: false, t: 'Informe a justificativa do ajuste.' });
    setW(await financeApi.adjustWallet(id!, n, motivo.trim()));
    setNovoSaldo(''); setMotivo('');
    setMsg({ ok: true, t: 'Saldo ajustado e registrado no histórico.' });
  });

  if (carregando) return <Screen title="Conta" back><ActivityIndicator color={p.accent} /></Screen>;

  return (
    <Screen eyebrow="Carteira" title={editando ? 'Editar conta' : 'Nova conta'} back>
      {editando && w && <Card style={{ gap: 4 }}><Label>Saldo atual</Label><T s={28} w="800">{money(w.balance)}</T>{w.archived && <T s={12} c={p.mute}>Conta arquivada</T>}</Card>}
      <Field label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Itaú conta corrente" />
      <Field label="Instituição (opcional)" value={inst} onChange={setInst} placeholder="Ex.: Itaú, Nubank" />
      <View style={{ gap: 10 }}><Label>Tipo</Label><Chips value={tipo} onChange={setTipo} items={WALLET_TYPES} /></View>
      {!editando && (
        <>
          <Row>
            <View style={{ flex: 1 }}><Field label="Saldo inicial (R$)" value={saldo} onChange={setSaldo} keyboard="decimal-pad" placeholder="0,00" /></View>
            <View style={{ flex: 1 }}><Field label="Data do saldo" value={data} onChange={setData} placeholder="AAAA-MM-DD" /></View>
          </Row>
          <T s={11} c={p.mute}>O saldo inicial é um saldo de abertura: não conta como receita.</T>
        </>
      )}
      <View style={{ gap: 10 }}>
        <Label>Cor</Label>
        <Row style={{ gap: 10 }}>{cores.map((c) => <Pressable key={c} accessibilityLabel={`Cor ${c}`} onPress={() => setCor(c)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 3, borderColor: cor === c ? p.text : 'transparent' }} />)}</Row>
      </View>
      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}
      <Btn onPress={salvar}>{editando ? 'Salvar alterações' : 'Criar conta'}</Btn>

      {editando && w && (
        <>
          <Card style={{ gap: 12 }}>
            <T s={15} w="700">Ajustar saldo</T>
            <T s={12} c={p.sub}>Use quando o saldo do app diverge do banco. O ajuste fica registrado com a justificativa.</T>
            <Field label="Saldo correto (R$)" value={novoSaldo} onChange={setNovoSaldo} keyboard="decimal-pad" />
            <Field label="Justificativa" value={motivo} onChange={setMotivo} placeholder="Ex.: conferência com o extrato" />
            <Btn kind="ghost" onPress={ajustar}>Ajustar saldo</Btn>
          </Card>
          <Pressable onPress={arquivar} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
            <T s={14} w="800" c={w.archived ? p.link : p.red}>{w.archived ? 'Reativar conta' : 'Arquivar conta'}</T>
          </Pressable>
        </>
      )}
    </Screen>
  );
}
