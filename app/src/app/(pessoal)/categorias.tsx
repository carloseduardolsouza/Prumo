import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { financeApi, type Category } from '@/api/finance';
import { Badge, Btn, Card, Field, I, Label, Notice, Row, Screen, Seg, T, useP } from '@/ui/kit';
import { C } from '@/ui/theme';
import { errorMessage } from '@/state/session';

const cores = [C.blue, C.yellow, C.red, C.green, C.violet, C.orange, C.cyan];
const ICONS: Record<string, string> = { house: I.house, food: I.food, car: I.car, play: I.play, heart: I.heart, school: I.school, bag: I.bag, dots: I.dots, job: I.job, code: I.code, up: I.up };

export default function Categorias() {
  const p = useP();
  const [tipo, setTipo] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [cats, setCats] = useState<Category[] | null>(null);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(cores[0]!);
  const [pai, setPai] = useState<string | undefined>();
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    try { setCats(await financeApi.categories()); setErro(''); } catch (e) { setErro(errorMessage(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const lista = (cats ?? []).filter((c) => c.type === tipo);
  const pais = lista.filter((c) => !c.parentId);

  const add = async () => {
    if (!nome.trim()) return setErro('Informe o nome.');
    try {
      await financeApi.createCategory({ name: nome.trim(), type: tipo, color: cor, ...(pai ? { parentId: pai } : {}) });
      setNome(''); setPai(undefined);
      await load();
    } catch (e) { setErro(errorMessage(e)); }
  };
  const arquivar = async (c: Category) => {
    try { await financeApi.archiveCategory(c.id); await load(); } catch (e) { setErro(errorMessage(e)); }
  };

  return (
    <Screen eyebrow="Preferências" title="Categorias" back>
      <Seg value={tipo} onChange={(t) => { setTipo(t); setPai(undefined); }} items={[['EXPENSE', 'Despesas'], ['INCOME', 'Receitas']]} />
      {erro ? <Notice kind="err">{erro}</Notice> : null}
      {!cats && !erro && <ActivityIndicator color={p.accent} />}
      <View style={{ gap: 4 }}>
        {pais.map((c) => (
          <View key={c.id}>
            <Row style={{ paddingVertical: 8 }}>
              <Badge d={ICONS[c.icon ?? 'dots'] ?? I.dots} color={c.color ?? p.sub} />
              <View style={{ flex: 1 }}><T s={15} w="600">{c.name}</T></View>
              <Pressable accessibilityLabel={`Arquivar ${c.name}`} onPress={() => arquivar(c)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}><T s={12} w="700" c={p.red}>Arquivar</T></Pressable>
            </Row>
            {lista.filter((s) => s.parentId === c.id).map((s) => (
              <Row key={s.id} style={{ paddingLeft: 58, minHeight: 36 }}>
                <T s={13} c={p.sub} style={{ flex: 1 }}>{s.name}</T>
                <Pressable accessibilityLabel={`Arquivar ${s.name}`} onPress={() => arquivar(s)} style={{ minHeight: 36, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}><T s={11} w="700" c={p.mute}>Arquivar</T></Pressable>
              </Row>
            ))}
          </View>
        ))}
      </View>
      <Card style={{ gap: 12 }}>
        <Label>Nova {pai ? 'subcategoria' : 'categoria'}</Label>
        <Field label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Pets" />
        <View style={{ gap: 8 }}>
          <Label>Dentro de (opcional)</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {pais.map((c) => (
              <Pressable key={c.id} onPress={() => setPai(pai === c.id ? undefined : c.id)} style={{ height: 34, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center', backgroundColor: pai === c.id ? p.text : p.card2 }}>
                <T s={12} w="700" c={pai === c.id ? p.bg : p.sub}>{c.name}</T>
              </Pressable>
            ))}
          </View>
        </View>
        <Row style={{ gap: 10 }}>{cores.map((c) => <Pressable key={c} accessibilityLabel={`Cor ${c}`} onPress={() => setCor(c)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 3, borderColor: cor === c ? p.text : 'transparent' }} />)}</Row>
        <Btn onPress={add}>Adicionar</Btn>
      </Card>
    </Screen>
  );
}
