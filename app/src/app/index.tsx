import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { I, Icon, Label, T, useP } from '@/ui/kit';
import { errorMessage, useSession } from '@/state/session';

export default function Login() {
  const p = useP();
  const { top, bottom } = useSafeAreaInsets();
  const { signIn, status } = useSession();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const field = { height: 56, borderRadius: 18, backgroundColor: p.card, borderWidth: 1, borderColor: p.line, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 } as const;

  const entrar = async () => {
    if (!email.trim() || !senha) return setErro('Informe e-mail e senha.');
    setErro('');
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), senha); // ao autenticar, o Redirect abaixo leva para o app
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (status === 'authenticated') return <Redirect href="/inicio" />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: top + 40, paddingBottom: bottom + 24, paddingHorizontal: 24, overflow: 'hidden' }}>
      <Svg width={420} height={420} viewBox="0 0 420 420" style={{ position: 'absolute', right: -170, top: -130 }}>
        {[['#4C7DF0', 250, 0], ['#E5484D', 1, -300], ['#F2B437', 300, -350]].map(([c, d, o]) => (
          <Circle key={String(c)} cx={210} cy={210} r={150} fill="none" stroke={String(c)} strokeWidth={34} strokeLinecap="round" strokeDasharray={`${d} ${942 - Number(d)}`} strokeDashoffset={Number(o)} transform="rotate(150 210 210)" />
        ))}
      </Svg>
      <View style={{ gap: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: p.text, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={p.bg} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 18 10 12l4 4 6-8" /></Svg>
          </View>
          <T s={20} w="800">Prumo</T>
        </View>
        <View style={{ gap: 12 }}>
          <Label>Conta pessoal</Label>
          <T s={36} w="700" style={{ lineHeight: 40 }}>Seu dinheiro,{'\n'}sob controle.</T>
        </View>
      </View>

      <View style={{ marginTop: 'auto', gap: 14 }}>
        <View style={{ gap: 8 }}>
          <Label>E-mail</Label>
          <View style={field}>
            <Icon d={I.mail} color={p.mute} size={18} />
            <TextInput accessibilityLabel="E-mail" value={email} onChangeText={setEmail} placeholder="voce@email.com" placeholderTextColor={p.mute} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={{ flex: 1, color: p.text, fontSize: 15 }} />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Label>Senha</Label>
          <View style={[field, { paddingRight: 6 }]}>
            <Icon d={I.lock} color={p.mute} size={18} />
            <TextInput accessibilityLabel="Senha" value={senha} onChangeText={setSenha} placeholder="Sua senha" placeholderTextColor={p.mute} secureTextEntry={!show} onSubmitEditing={entrar} style={{ flex: 1, color: p.text, fontSize: 15 }} />
            <Pressable accessibilityLabel="Mostrar ou ocultar senha" onPress={() => setShow(!show)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon d={I.eye} color={p.mute} />
            </Pressable>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', minHeight: 32, justifyContent: 'center' }}>
          <Pressable onPress={() => router.push('/esqueci-senha')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: p.link, fontWeight: '700', fontSize: 13 }}>Esqueci a senha</Text>
          </Pressable>
        </View>
        {erro ? <T s={13} w="700" c={p.red}>{erro}</T> : null}
        <Pressable accessibilityRole="button" disabled={loading} onPress={entrar} style={{ height: 58, borderRadius: 20, backgroundColor: p.text, alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
          {loading ? <ActivityIndicator color={p.bg} /> : <T s={16} w="800" c={p.bg}>Entrar</T>}
        </Pressable>
        <Text style={{ textAlign: 'center', fontSize: 14, color: p.mute, marginTop: 8 }}>
          Não tem conta? <Text onPress={() => router.push('/criar-conta')} style={{ color: p.link, fontWeight: '700' }}>Criar conta</Text>
        </Text>
      </View>
    </View>
  );
}
