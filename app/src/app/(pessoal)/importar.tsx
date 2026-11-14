import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { financeApi, money, type ImportResult, type Wallet } from '@/api/finance';
import { Badge, Btn, Card, Chips, I, Label, Notice, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

export default function Importar() {
  const p = useP();
  const [origem, setOrigem] = useState<'arquivo' | 'of'>('arquivo');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string | undefined>();
  const [arq, setArq] = useState<{ name: string; content: string; format: 'csv' | 'ofx' } | null>(null);
  const [previa, setPrevia] = useState<ImportResult | null>(null);
  const [feito, setFeito] = useState<ImportResult | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    financeApi.wallets().then((w) => { setWallets(w.wallets); setWalletId(w.wallets[0]?.id); }).catch((e) => setErro(errorMessage(e)));
  }, []);

  const escolher = async () => {
    setErro(''); setPrevia(null); setFeito(null);
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/x-ofx', 'application/vnd.ms-excel', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      const format = /\.ofx$/i.test(a.name) ? 'ofx' : 'csv';
      const content = await (await fetch(a.uri)).text();
      setArq({ name: a.name, content, format });
      if (walletId) setPrevia(await financeApi.importFile(walletId, format, content, false));
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  const trocarConta = async (id: string) => {
    setWalletId(id); setFeito(null);
    if (!arq) return;
    try { setPrevia(await financeApi.importFile(id, arq.format, arq.content, false)); setErro(''); } catch (e) { setErro(errorMessage(e)); }
  };

  const importar = async () => {
    if (!arq || !walletId) return;
    setOcupado(true);
    try {
      setFeito(await financeApi.importFile(walletId, arq.format, arq.content, true));
      setPrevia(null); setArq(null); setErro('');
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Screen eyebrow="Extrato" title="Importar lançamentos" back>
      <Seg value={origem} onChange={setOrigem} items={[['arquivo', 'CSV / OFX'], ['of', 'Open Finance']]} />
      {origem === 'of' ? (
        <Card style={{ gap: 8 }}>
          <T s={15} w="700">Em breve</T>
          <T s={13} c={p.sub}>A conexão automática com bancos depende de análise técnica e regulatória. Por enquanto, exporte o extrato no app do banco e importe o arquivo aqui.</T>
        </Card>
      ) : wallets.length === 0 ? (
        <Card><T s={13} c={p.sub}>Cadastre uma conta antes de importar lançamentos.</T></Card>
      ) : (
        <>
          <View style={{ gap: 10 }}>
            <Label>Conta de destino</Label>
            <Chips value={walletId ?? ''} onChange={trocarConta} items={wallets.map((w) => [w.id, w.name] as [string, string])} />
          </View>
          <Pressable onPress={escolher} style={{ minHeight: 96, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.dash, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12 }}>
            <Badge d={I.upload} color={p.link} size={36} bg={p.card} />
            <T s={13} w="700">{arq ? `${arq.name} selecionado` : 'Selecionar arquivo .csv ou .ofx'}</T>
          </Pressable>
          <T s={11} c={p.mute}>CSV com cabeçalho (data, descrição, valor): valores negativos são saídas. Tudo entra como efetivado.</T>

          {previa && (
            <Card style={{ gap: 8 }}>
              <Label>Prévia · {previa.parsed} lançamentos no arquivo</Label>
              {previa.preview.map((r, i) => (
                <Row key={i}><T s={12} c={p.mute} style={{ width: 82 }}>{r.date.split('-').reverse().join('/')}</T><T s={13} w="600" style={{ flex: 1 }} lines={1}>{r.description}</T><T s={13} w="700" c={Number(r.amount) > 0 ? C.green : p.text}>{money(r.amount, { sign: true })}</T></Row>
              ))}
              <T s={12} c={p.sub}>{previa.toImport} novos · {previa.duplicates} já importados (ignorados){previa.invalidRows ? ` · ${previa.invalidRows} linhas inválidas` : ''}</T>
            </Card>
          )}
          {feito && <Notice>{feito.imported} lançamentos importados{feito.duplicates ? `, ${feito.duplicates} duplicados ignorados` : ''}.</Notice>}
          {erro ? <Notice kind="err">{erro}</Notice> : null}
          <Btn onPress={previa && previa.toImport > 0 && !ocupado ? importar : undefined}>{ocupado ? 'Importando...' : previa ? `Importar ${previa.toImport} lançamentos` : 'Importar lançamentos'}</Btn>
        </>
      )}
    </Screen>
  );
}
