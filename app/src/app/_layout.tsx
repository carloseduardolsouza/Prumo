import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaletteCtx } from '@/ui/kit';
import { ThemeModeProvider, useIsDark, usePalette } from '@/ui/themeMode';
import { SessionProvider, useSession } from '@/state/session';

function Shell() {
  const p = usePalette(false);
  const dark = useIsDark();
  const { status } = useSession();
  const authed = status === 'authenticated';

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={p.accent} />
      </View>
    );
  }
  return (
    <PaletteCtx.Provider value={p}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
        {/* Só com sessão: o app (as duas contas) e o formulário de nova movimentação. */}
        <Stack.Protected guard={authed}>
          <Stack.Screen name="(pessoal)" />
          <Stack.Screen name="(invest)" />
          <Stack.Screen name="nova-movimentacao" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        {/* A raiz sempre existe: mostra o login ou redireciona para o app (evita "Unmatched Route" ao abrir já logado). */}
        <Stack.Screen name="index" />
        {/* Só sem sessão: cadastro e recuperação de senha. */}
        <Stack.Protected guard={!authed}>
          <Stack.Screen name="criar-conta" />
          <Stack.Screen name="esqueci-senha" />
        </Stack.Protected>
        {/* Links de e-mail abrem com ou sem sessão. */}
        <Stack.Screen name="redefinir-senha" />
        <Stack.Screen name="verificar-email" />
      </Stack>
    </PaletteCtx.Provider>
  );
}

export default function Root() {
  return (
    <ThemeModeProvider>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </ThemeModeProvider>
  );
}
