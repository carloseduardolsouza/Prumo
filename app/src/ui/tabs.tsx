import { Tabs } from 'expo-router';
import { Icon, I, PaletteCtx } from './kit';
import { usePalette } from './themeMode';

const ICONS: Record<string, string> = { inicio: I.home, extrato: I.extrato, dashboard: I.dash, carteira: I.wallet, perfil: I.user };

// Rotas em `hidden` ficam fora da barra mas continuam navegáveis (`href: null` redireciona para outra aba no expo-router atual).
export function AccountTabs({ inv, tabs, hidden }: { inv: boolean; tabs: [string, string][]; hidden: string[] }) {
  const palette = usePalette(inv);
  return (
    <PaletteCtx.Provider value={palette}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: palette.bg },
          tabBarActiveTintColor: palette.text,
          tabBarInactiveTintColor: palette.mute,
          tabBarStyle: { backgroundColor: palette.card, borderTopColor: palette.line, height: 72, paddingTop: 6 },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        }}>
        {tabs.map(([name, title]) => (
          <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Icon d={ICONS[name.replace(/^inv-/, '')]} color={String(color)} size={22} /> }} />
        ))}
        {hidden.map((name) => <Tabs.Screen key={name} name={name} options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />)}
      </Tabs>
    </PaletteCtx.Provider>
  );
}
