import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { cardApi, money, newKey, parseMoney, type CreditCard } from '@/api/finance';
import { Btn, Card, Chips, Field, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const cores = [C.nu, C.inter, '#1A1A1A', C.blue, C.green, C.red];
const bandeiras = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra'];

// Cria um cartão ou, com ?id=, edita/ajusta o limite/bloqueia/arquiva.
export default function NovoCartao() {
  const p = useP();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = Boolean(id);
  const [c, setC] = useState<CreditCard | null>(null);
  const [nome, setNome] = useState('');
  const [emissor, setEmissor] = useState('');
  const [bandeira, setBandeira] = useState('Visa');
  const [final, setFinal] = useState('');
  const [limite, setLimite] = useState('');
  const [fecha, setFecha] = useState('');
  const [vence, setVence] = useState('');
  const [cor, setCor] = useState<string | undefined>();
  const [politica, setPolitica] = useState<'CONSERVATIVE' | 'INVOICE_ONLY'>('CONSERVATIVE');
  const [novoLimite, setNovoLimite] = useState('');
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [carregando, setCarregando] = useState(editando);
  const key = useRef(newKey());

  useEffect(() => {
    if (!id) return;
    cardApi.get(id).then((x) => { setC(x); setNome(x.name); setEmissor(x.issuer ?? ''); setBandeira(x.brand ?? 'Visa'); setFinal(x.last4 ?? ''); setCor(x.color ?? undefined); setPolitica(x.limitPolicy); })
      .catch((e) => setMsg({ ok: false, t: errorMessage(e) })).finally(() => setCarregando(false));
  }, [id]);

  const run = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); } };

  const salvar = () => run(async () => {
    if (!nome.trim()) return setMsg({ ok: false, t: 'Dê um nome ao cartão.' });
    if (editando) {
      setC(await cardApi.update(id!, { name: nome.trim(), issuer: emissor.trim(), brand: bandeira, last4: final, limitPolicy: politica, ...(cor ? { color: cor } : {}) }));
      return setMsg({ ok: true, t: 'Cartão atualizado.' });
    }
    const lim = parseMoney(limite);
    const f = Number(fecha), v = Number(vence);
    if (!/^\d+(\.\d{1,2})?$/.test(lim) || Number(lim) <= 0) return setMsg({ ok: false, t: 'Informe o limite total.' });
    if (!(f >= 1 && f <= 31 && v >= 1 && v <= 31)) return setMsg({ ok: false, t: 'Dias de fechamento e vencimento devem estar entre 1 e 31.' });
    await cardApi.create({ name: nome.trim(), ...(emissor.trim() ? { issuer: emissor.trim() } : {}), brand: bandeira, ...(final ? { last4: final } : {}), limit: lim, closingDay: f, dueDay: v, ...(cor ? { color: cor } : {}), limitPolicy: politica }, key.current);
    router.back();
  });

  const ajustar = () => run(async () => {
    const n = parseMoney(novoLimite);
    if (!/^\d+(\.\d{1,2})?$/.test(n) || Number(n) <= 0) return setMsg({ ok: false, t: 'Informe o novo limite.' });
    if (motivo.trim().length < 3) return setMsg({ ok: false, t: 'Informe a justificativa.' });
    setC(await cardApi.adjustLimit(id!, n, motivo.trim()));
    setNovoLimite(''); setMotivo('');
    setMsg({ ok: true, t: 'Limite atualizado e registrado no histórico.' });
  });

  const mudarStatus = (s: CreditCard['status']) => run(async () => { setC(await cardApi.setStatus(id!, s)); setMsg({ ok: true, t: s === 'ACTIVE' ? 'Cartão reativado.' : s === 'BLOCKED' ? 'Cartão bloqueado para novas compras.' : 'Cartão arquivado. O histórico foi mantido.' }); });

  if (carregando) return <Screen title="Cartão" back><ActivityIndicator color={p.accent} /></Screen>;

  return (
    <Screen eyebrow="Carteira" title={editando ? 'Gerenciar cartão' : 'Novo cartão'} back>
      {editando && c && <Card style={{ gap: 4 }}><Label>Limite total</Label><T s={28} w="800">{money(c.limit)}</T><T s={12} c={p.mute}>Fecha dia {c.closingDay} · vence dia {c.dueDay}</T></Card>}
      <Field label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Nubank" />
      <Field label="Emissor (opcional)" value={emissor} onChange={setEmissor} />
      <View style={{ gap: 10 }}><Label>Bandeira</Label><Chips value={bandeira} onChange={setBandeira} items={bandeiras.map((b) => [b, b] as [string, string])} /></View>
      <Field label="Últimos 4 dígitos (opcional)" value={final} onChange={(v) => setFinal(v.replace(/\D/g, '').slice(0, 4))} keyboard="decimal-pad" hint="Nunca guardamos o número completo, o CVV nem a senha." />
      {!editando && (
        <>
          <Field label="Limite total (R$)" value={limite} onChange={setLimite} keyboard="decimal-pad" />
          <Row><View style={{ flex: 1 }}><Field label="Dia de fechamento" value={fecha} onChange={setFecha} keyboard="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Dia de vencimento" value={vence} onChange={setVence} keyboard="decimal-pad" /></View></Row>
          <T s={11} c={p.mute}>Compras feitas até o dia do fechamento (inclusive) entram na fatura que fecha nele; o melhor dia de compra é o seguinte.</T>
        </>
      )}
      <View style={{ gap: 10 }}>
        <Label>Como comprometer o limite</Label>
        <Chips value={politica} onChange={setPolitica} items={[['CONSERVATIVE', 'Todas as parcelas'], ['INVOICE_ONLY', 'Só faturas']]} />
        <T s={11} c={p.mute}>O limite exibido é uma estimativa; o oficial é o do banco.</T>
      </View>
      <Row style={{ gap: 10 }}>{cores.map((x) => <Pressable key={x} accessibilityLabel={`Cor ${x}`} onPress={() => setCor(x)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: x, borderWidth: 3, borderColor: cor === x ? p.text : 'transparent' }} />)}</Row>
      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}
      <Btn onPress={salvar}>{editando ? 'Salvar alterações' : 'Criar cartão'}</Btn>

      {editando && c && (
        <>
          <Card style={{ gap: 12 }}>
            <T s={15} w="700">Ajustar limite</T>
            <Field label="Novo limite (R$)" value={novoLimite} onChange={setNovoLimite} keyboard="decimal-pad" />
            <Field label="Justificativa" value={motivo} onChange={setMotivo} placeholder="Ex.: aumento concedido pelo banco" />
            <Btn kind="ghost" onPress={ajustar}>Ajustar limite</Btn>
          </Card>
          <Row style={{ justifyContent: 'center', gap: 24 }}>
            {c.status === 'ACTIVE' ? (
              <Pressable onPress={() => mudarStatus('BLOCKED')} style={{ minHeight: 48, justifyContent: 'center' }}><T s={14} w="800" c={C.yellow}>Bloquear</T></Pressable>
            ) : (
              <Pressable onPress={() => mudarStatus('ACTIVE')} style={{ minHeight: 48, justifyContent: 'center' }}><T s={14} w="800" c={p.link}>Reativar</T></Pressable>
            )}
            <Pressable onPress={() => mudarStatus('ARCHIVED')} style={{ minHeight: 48, justifyContent: 'center' }}><T s={14} w="800" c={p.red}>Arquivar</T></Pressable>
          </Row>
        </>
      )}
    </Screen>
  );
}
