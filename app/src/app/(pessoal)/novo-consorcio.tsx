import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { debtApi, financeApi, newKey, parseMoney, today } from '@/api/finance';
import { Btn, Chips, Field, Label, Notice, Row, Screen, T, useP } from '@/ui/kit';
import { errorMessage } from '@/state/session';

const TIPOS: [string, string][] = [['REAL_ESTATE', 'Imóvel'], ['VEHICLE', 'Veículo'], ['SERVICE', 'Serviço'], ['OTHER', 'Outros']];

export default function NovoConsorcio() {
  const p = useP();
  const [nome, setNome] = useState('');
  const [adm, setAdm] = useState('');
  const [grupo, setGrupo] = useState('');
  const [cota, setCota] = useState('');
  const [tipo, setTipo] = useState('REAL_ESTATE');
  const [carta, setCarta] = useState('');
  const [parcelas, setParcelas] = useState('');
  const [valor, setValor] = useState('');
  const [primeira, setPrimeira] = useState(today());
  const [erro, setErro] = useState('');
  const key = useRef(newKey());
  useEffect(() => { financeApi.wallets().catch(() => undefined); }, []);

  const criar = async () => {
    const c = parseMoney(carta), v = parseMoney(valor), n = Number(parcelas);
    if (!nome.trim()) return setErro('Dê um nome à cota.');
    if (!/^\d+(\.\d{1,2})?$/.test(c) || Number(c) <= 0) return setErro('Informe o valor da carta.');
    if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) <= 0) return setErro('Informe o valor da parcela.');
    if (!(n >= 1 && n <= 300)) return setErro('Informe a quantidade de parcelas.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeira)) return setErro('Use a data no formato AAAA-MM-DD.');
    try {
      const r = await debtApi.createConsortium({ name: nome.trim(), ...(adm.trim() ? { administrator: adm.trim() } : {}), ...(grupo.trim() ? { groupNumber: grupo.trim() } : {}), ...(cota.trim() ? { quota: cota.trim() } : {}), kind: tipo, initialLetter: c, installments: n, installmentAmount: v, firstDueDate: primeira }, key.current);
      router.replace({ pathname: '/consorcio', params: { id: r.consortium.id } });
    } catch (e) { setErro(errorMessage(e)); }
  };

  return (
    <Screen eyebrow="Dívidas" title="Novo consórcio" back>
      <Field label="Nome da cota" value={nome} onChange={setNome} placeholder="Ex.: Consórcio imóvel" />
      <Field label="Administradora (opcional)" value={adm} onChange={setAdm} />
      <Row>
        <View style={{ flex: 1 }}><Field label="Grupo" value={grupo} onChange={setGrupo} /></View>
        <View style={{ flex: 1 }}><Field label="Cota" value={cota} onChange={setCota} /></View>
      </Row>
      <View style={{ gap: 10 }}><Label>Tipo</Label><Chips value={tipo} onChange={setTipo} items={TIPOS} /></View>
      <Field label="Valor da carta (R$)" value={carta} onChange={setCarta} keyboard="decimal-pad" />
      <Row>
        <View style={{ flex: 1 }}><Field label="Parcela (R$)" value={valor} onChange={setValor} keyboard="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Nº de parcelas" value={parcelas} onChange={setParcelas} keyboard="decimal-pad" /></View>
      </Row>
      <Field label="Primeira parcela" value={primeira} onChange={setPrimeira} placeholder="AAAA-MM-DD" />
      <T s={11} c={p.mute}>A carta não é dinheiro disponível: só vale após a contemplação e conforme o contrato.</T>
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      <Btn onPress={criar}>Criar consórcio</Btn>
    </Screen>
  );
}
