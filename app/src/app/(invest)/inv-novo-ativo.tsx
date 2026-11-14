import { useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ASSET_CLASSES, financeApi, investApi, money, newKey, parseMoney, today, type AssetClass } from '@/api/finance';
import { Btn, Card, Chips, Field, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { errorMessage } from '@/state/session';
import { useLoad } from '@/state/useLoad';

type Kind = 'CONTRIBUTION' | 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE';
const ops: [Kind, string][] = [['CONTRIBUTION', 'Aporte'], ['BUY', 'Compra'], ['SELL', 'Venda'], ['DIVIDEND', 'Provento'], ['FEE', 'Taxa / IR']];
const PROV: [string, string][] = [['DIVIDENDO', 'Dividendo'], ['JCP', 'JCP'], ['RENDIMENTO', 'Rendimento'], ['CUPOM', 'Cupom']];
const num = (v: string) => Number(parseMoney(v)) || 0;

export default function InvNovoAtivo() {
  const p = useP();
  const [op, setOp] = useState<Kind>('CONTRIBUTION');
  const [assetId, setAssetId] = useState('');
  const [novo, setNovo] = useState(false);
  const [ticker, setTicker] = useState('');
  const [nome, setNome] = useState('');
  const [classe, setClasse] = useState<AssetClass>('STOCK');
  const [qtd, setQtd] = useState('');
  const [preco, setPreco] = useState('');
  const [valor, setValor] = useState('');
  const [taxas, setTaxas] = useState('');
  const [prov, setProv] = useState('DIVIDENDO');
  const [corretora, setCorretora] = useState('');
  const [carteira, setCarteira] = useState('');
  const [data, setData] = useState(today());
  const [erro, setErro] = useState('');
  const key = useRef(newKey());
  const { data: brk } = useLoad(investApi.brokerages);
  const { data: assets } = useLoad(investApi.assets);
  const { data: wl } = useLoad(financeApi.wallets);

  const negocia = op === 'BUY' || op === 'SELL';
  const comAtivo = negocia || op === 'DIVIDEND';
  const total = negocia ? num(qtd) * num(preco) : num(valor);
  const brokerageId = corretora || brk?.[0]?.id;
  const walletId = carteira || (op === 'CONTRIBUTION' ? wl?.wallets[0]?.id : undefined);

  const salvar = async () => {
    if (!brokerageId) return setErro('Cadastre uma instituição antes (menu Corretoras e bancos).');
    if (negocia && (!num(qtd) || !num(preco))) return setErro('Informe quantidade e preço.');
    if (!negocia && !num(valor)) return setErro('Informe o valor.');
    if (comAtivo && !assetId && !(novo && ticker.trim() && nome.trim())) return setErro('Escolha o ativo ou cadastre um novo.');
    try {
      await investApi.addOperation({
        kind: op, brokerageId, date: data,
        ...(comAtivo ? (novo || !assetId ? { asset: { ticker: ticker.trim(), name: nome.trim(), assetClass: classe } } : { investmentId: assetId }) : {}),
        ...(negocia ? { quantity: parseMoney(qtd), unitPrice: parseMoney(preco) } : { amount: parseMoney(valor) }),
        ...(taxas ? { fees: parseMoney(taxas) } : {}), ...(op === 'DIVIDEND' ? { dividendKind: prov } : {}), ...(op === 'CONTRIBUTION' && walletId ? { walletId } : {}),
      }, key.current);
      router.back();
    } catch (e) { setErro(errorMessage(e)); }
  };

  const held = (assets ?? []).filter((a) => !a.archived);
  return (
    <Screen eyebrow="Conta investimentos" title="Registrar operação" back>
      <Chips value={op} onChange={(v) => { setOp(v); setErro(''); }} items={ops} />

      {comAtivo && (
        <View style={{ gap: 10 }}>
          <Label>Ativo</Label>
          {held.length > 0 && <Chips value={novo ? '__novo' : assetId} onChange={(v) => { if (v === '__novo') { setNovo(true); setAssetId(''); } else { setNovo(false); setAssetId(v); } }} items={[...held.map((a) => [a.id, a.ticker] as [string, string]), ...(op === 'DIVIDEND' ? [] : [['__novo', '+ Novo ativo'] as [string, string]])]} />}
          {(novo || held.length === 0) && op !== 'DIVIDEND' && (
            <>
              <Field label="Código ou nome curto" value={ticker} onChange={(v) => setTicker(v.toUpperCase())} placeholder="Ex.: ITSA4, CDB Inter, BTC" />
              <Field label="Nome completo" value={nome} onChange={setNome} placeholder="Ex.: Itaúsa PN" />
              <Chips value={classe} onChange={setClasse} items={ASSET_CLASSES} />
            </>
          )}
          {op === 'DIVIDEND' && held.length === 0 && <T s={12} c={p.sub}>Registre uma compra antes para receber proventos desse ativo.</T>}
        </View>
      )}

      {negocia ? (
        <Row><View style={{ flex: 1 }}><Field label="Quantidade" value={qtd} onChange={setQtd} keyboard="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Preço unitário (R$)" value={preco} onChange={setPreco} keyboard="decimal-pad" /></View></Row>
      ) : (
        <Field label={op === 'DIVIDEND' ? 'Valor bruto (R$)' : 'Valor (R$)'} value={valor} onChange={setValor} keyboard="decimal-pad" />
      )}
      {(negocia || op === 'DIVIDEND') && <Field label={op === 'DIVIDEND' ? 'IR retido (R$, opcional)' : 'Corretagem e taxas (R$, opcional)'} value={taxas} onChange={setTaxas} keyboard="decimal-pad" />}
      {op === 'DIVIDEND' && <View style={{ gap: 10 }}><Label>Tipo de provento</Label><Chips value={prov} onChange={setProv} items={PROV} /></View>}

      <View style={{ gap: 10 }}><Label>Instituição</Label>{brk && brk.length === 0 ? <T s={12} c={p.sub}>Nenhuma cadastrada. Use Corretoras e bancos no perfil.</T> : <Chips value={brokerageId ?? ''} onChange={setCorretora} items={(brk ?? []).map((b) => [b.id, b.name] as [string, string])} />}</View>
      {op === 'CONTRIBUTION' && <View style={{ gap: 10 }}><Label>Sai da conta pessoal</Label><Chips value={walletId ?? ''} onChange={setCarteira} items={(wl?.wallets ?? []).map((w) => [w.id, `${w.name} · ${money(w.balance)}`] as [string, string])} /></View>}
      <Field label={op === 'DIVIDEND' ? 'Data de pagamento (futura = agendado)' : 'Data'} value={data} onChange={setData} placeholder="AAAA-MM-DD" />

      <Card style={{ gap: 6 }}>
        <Label>Resumo</Label>
        <T s={22} w="800">{money(total)}</T>
        <T s={11} c={p.mute}>{op === 'CONTRIBUTION' ? 'Sai da Conta Pessoal e entra na instituição; não é despesa.' : 'O app só registra; nenhuma ordem é enviada à corretora.'}</T>
      </Card>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      <Btn onPress={salvar}>Salvar operação</Btn>
    </Screen>
  );
}
