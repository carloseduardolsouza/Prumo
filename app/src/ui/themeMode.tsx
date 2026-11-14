import { createContext, ReactNode, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { invest, investLight, pessoal, pessoalLight } from './theme';

export type Mode = 'escuro' | 'claro' | 'auto';
const Ctx = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({ mode: 'escuro', setMode: () => {} });

// shortcut: o tema fica só em memória; para persistir entre aberturas, gravar `mode` em AsyncStorage.
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('escuro');
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}
export const useMode = () => useContext(Ctx);

export function useIsDark() {
  const { mode } = useMode();
  const sys = useColorScheme();
  return mode === 'auto' ? sys !== 'light' : mode === 'escuro';
}
export function usePalette(inv: boolean) {
  const dark = useIsDark();
  return inv ? (dark ? invest : investLight) : dark ? pessoal : pessoalLight;
}
