import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { investApi, money, parseMoney, shortDate, today } from '@/api/finance';
import { Btn, Card, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';
import { useLoad } from '@/state/useLoad';

export default function InvCotacoes() {
  const p = useP();
  const { data: assets, error, reload } = useLoad(investApi.assets);
  const [px, setPx] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const held = (assets ?? []).filter((a) => !a.archived);

  const salvar = async () => {
    const edits = Object.entries(px).filter(([, v]) => v.trim());
    if (!edits.length) return setMsg({ ok: false, t: 'Altere ao menos um preço.' });
    try {
      for (const [id, v] of edits) await investApi.setQuote(id, parseMoney(v));
      setPx({}); setMsg({ ok: true, t: `${edits.length} cotação(ões) salva(s) em ${shortDate(today())}.` }); await reload();
    } catch (e) { setMsg({ ok: false, t: errorMessage(e) }); }
  };

  return (
    <Screen eyebrow="Conta investimentos" title="Atualização de cotações" back>
      <T s={13} c={p.sub}>Atualização manual. Cada preço guarda a data e a origem “informado por você”. Renda fixa: informe o valor atual de uma unidade (ex.: o saldo, se a quantidade for 1).</T>
      {error ? <Notice kind="err">{error}</Notice> : null}
      {assets && held.length === 0 && <Card><T s={13} c={p.sub}>Nenhum ativo cadastrado ainda. Registre uma compra primeiro.</T></Card>}
      {held.length > 0 && (
        <Card style={{ gap: 4 }}>
          {held.map((a) => (
            <Row key={a.id} style={{ minHeight: 52 }}>
              <View style={{ flex: 1 }}><T s={14} w="800">{a.ticker}</T><T s={11} c={p.mute}>{a.classLabel} · atual {money(a.price)}</T></View>
              <T s={13} c={p.mute}>R$</T>
              <TextInput accessibilityLabel={`Preço de ${a.ticker}`} value={px[a.id] ?? ''} placeholder={Number(a.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} placeholderTextColor={p.mute}
                onChangeText={(v) => { setMsg(null); setPx({ ...px, [a.id]: v }); }} keyboardType="decimal-pad"
                style={{ width: 104, height: 44, borderRadius: 12, backgroundColor: p.card2, color: p.text, textAlign: 'right', paddingHorizontal: 12, fontWeight: '700' }} />
            </Row>
          ))}
        </Card>
      )}
      {msg && <Notice kind={msg.ok ? 'ok' : 'err'}>{msg.t}</Notice>}
      <Btn onPress={salvar}>Salvar cotações</Btn>
      <T s={11} c={C.yellow}>Integração com provedores de cotação: versão futura.</T>
    </Screen>
  );
}
