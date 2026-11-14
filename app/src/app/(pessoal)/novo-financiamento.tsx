import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { debtApi, financeApi, money, newKey, parseMoney, today, type Wallet } from '@/api/finance';
import { Btn, Chips, Field, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { errorMessage } from '@/state/session';

const TIPOS: [string, string][] = [['VEHICLE', 'Veículo'], ['REAL_ESTATE', 'Imóvel'], ['PERSONAL', 'Pessoal'], ['PAYROLL', 'Consignado'], ['STUDENT', 'Estudantil'], ['PRIVATE', 'Particular'], ['OTHER', 'Outros']];

export default function NovoFinanciamento() {
  const p = useP();
  const [nome, setNome] = useState('');
  const [credor, setCredor] = useState('');
  const [tipo, setTipo] = useState('VEHICLE');
  const [valor, setValor] = useState('');
  const [taxa, setTaxa] = useState('');
  const [sistema, setSistema] = useState<'PRICE' | 'SAC'>('PRICE');
  const [parcelas, setParcelas] = useState('');
  const [primeira, setPrimeira] = useState(today());
  const [tarifa, setTarifa] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string | undefined>();
  const [erro, setErro] = useState('');
  const key = useRef(newKey());

  useEffect(() => { financeApi.wallets().then((w) => { setWallets(w.wallets); setWalletId(w.wallets[0]?.id); }).catch(() => undefined); }, []);

  const criar = async () => {
    const v = parseMoney(valor), n = Number(parcelas);
    if (!nome.trim()) return setErro('Dê um nome ao contrato.');
    if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) <= 0) return setErro('Informe o valor financiado.');
    if (!(n >= 1 && n <= 480)) return setErro('Informe a quantidade de parcelas.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeira)) return setErro('Use a data no formato AAAA-MM-DD.');
    try {
      const r = await debtApi.createFinancing({ name: nome.trim(), ...(credor.trim() ? { creditor: credor.trim() } : {}), kind: tipo, financedAmount: v, monthlyRatePercent: (taxa || '0').replace(',', '.'), system: sistema, installments: n, firstDueDate: primeira, ...(tarifa ? { feePerInstallment: parseMoney(tarifa) } : {}), ...(walletId ? { walletId } : {}) }, key.current);
      router.replace({ pathname: '/financiamento', params: { id: r.financing.id } });
    } catch (e) { setErro(errorMessage(e)); }
  };

  return (
    <Screen eyebrow="Dívidas" title="Novo financiamento" back>
      <Field label="Nome do contrato" value={nome} onChange={setNome} placeholder="Ex.: Financiamento do carro" />
      <Field label="Credor (opcional)" value={credor} onChange={setCredor} />
      <View style={{ gap: 10 }}><Label>Tipo</Label><Chips value={tipo} onChange={setTipo} items={TIPOS} /></View>
      <Field label="Valor financiado (R$)" value={valor} onChange={setValor} keyboard="decimal-pad" />
      <Row>
        <View style={{ flex: 1 }}><Field label="Taxa mensal (%)" value={taxa} onChange={setTaxa} keyboard="decimal-pad" placeholder="1,49" /></View>
        <View style={{ flex: 1 }}><Field label="Parcelas" value={parcelas} onChange={setParcelas} keyboard="decimal-pad" placeholder="48" /></View>
      </Row>
      <View style={{ gap: 10 }}><Label>Sistema de amortização</Label><Chips value={sistema} onChange={setSistema} items={[['PRICE', 'Price (parcela fixa)'], ['SAC', 'SAC (parcela decrescente)']]} /></View>
      <Field label="Primeira parcela" value={primeira} onChange={setPrimeira} placeholder="AAAA-MM-DD" />
      <Field label="Seguro/tarifas por parcela (opcional)" value={tarifa} onChange={setTarifa} keyboard="decimal-pad" hint="Somados à parcela e separados de principal e juros." />
      <View style={{ gap: 10 }}><Label>Conta de pagamento</Label><Chips value={walletId ?? ''} onChange={setWalletId} items={wallets.map((w) => [w.id, `${w.name} · ${money(w.balance)}`] as [string, string])} /></View>
      <T s={11} c={p.mute}>O cronograma é calculado pelo app com a taxa informada. Se o seu contrato traz valores diferentes, o saldo mostrado é só uma estimativa.</T>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      <Btn onPress={criar}>Criar contrato</Btn>
    </Screen>
  );
}
