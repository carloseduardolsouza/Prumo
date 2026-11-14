import { Children, createContext, ReactNode, useContext, useState } from 'react';
import { Pressable, ScrollView, StyleProp, Switch, Text, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PieChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Palette, pessoal } from './theme';

export const PaletteCtx = createContext<Palette>(pessoal);
export const useP = () => useContext(PaletteCtx);

export const I = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  extrato: 'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4',
  dash: 'M5 20V11M11 20V5M17 20v-6M3 20h18',
  wallet: 'M3 7h18v13H3zM3 7l2-3h12v3M16.5 13.5h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  plus: 'M12 4v16M4 12h16',
  back: 'm15 6-6 6 6 6',
  next: 'm9 6 6 6-6 6',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  warn: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  up: 'm3 17 6-6 4 4 8-8M15 7h6v6',
  coin: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  filter: 'M4 6h16M7 12h10M10 18h4',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  car: 'M5 17h14v-5l-2-5H7l-2 5zM7 17v2M17 17v2',
  food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 7h3v11',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7z',
  swap: 'M4 8h14l-3-3M20 16H6l3 3',
  play: 'M3 5h18v14H3zM10 9l5 3-5 3z',
  job: 'M4 7h16v13H4zM9 7V4h6v3',
  wifi: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  house: 'M3 10.5 12 3l9 7.5V20H3z',
  repeat: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  phone: 'M7 3h10v18H7zM11 18h2',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
  bank: 'M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
  out: 'M9 4H4v16h5M16 8l4 4-4 4M20 12H9',
  clip: 'm21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7',
  upload: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L12 6.3M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  down: 'M12 5v14M5 12l7 7 7-7',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  sell: 'M7 17 17 7M8 7h9v9',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 9h6M9 13h6',
  water: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
  gym: 'M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  cloud: 'M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z',
  school: 'M2 8l10-5 10 5-10 5zM6 10v5c3 2 9 2 12 0v-5',
  build: 'M4 21V5l8-3 8 3v16M9 21v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 13h.01M16 13h.01',
};

export function Icon({ d, color, size = 20, sw = 1.9 }: { d: string; color?: string; size?: number; sw?: number }) {
  const p = useP();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? p.text} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

type TProps = { children?: ReactNode; s?: number; w?: TextStyle['fontWeight']; c?: string; caps?: boolean; style?: StyleProp<TextStyle>; lines?: number };
export function T({ children, s = 14, w = '500', c, caps, style, lines }: TProps) {
  const p = useP();
  return (
    <Text numberOfLines={lines} style={[{ fontSize: s, fontWeight: w, color: c ?? p.text, fontVariant: ['tabular-nums'] }, caps && { letterSpacing: s * 0.1, textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}
export const Label = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => {
  const p = useP();
  return <T s={10} w="700" c={p.mute} caps style={style}>{children}</T>;
};

export function Screen({ eyebrow, title, back, right, children, pad = 20 }: { eyebrow?: string; title?: string; back?: boolean; right?: ReactNode; children: ReactNode; pad?: number }) {
  const p = useP();
  const { top } = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: pad, paddingBottom: 32, gap: 18 }}>
      {(title || eyebrow) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {back && (
            <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: p.card, alignItems: 'center', justifyContent: 'center' }}>
              <Icon d={I.back} size={20} />
            </Pressable>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            {eyebrow && <Label>{eyebrow}</Label>}
            {title && <T s={28} w="700" lines={1}>{title}</T>}
          </View>
          {right}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

export const Card = ({ children, style, onPress, color }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; color?: string }) => {
  const p = useP();
  const st: StyleProp<ViewStyle> = [{ backgroundColor: color ?? p.card, borderRadius: 24, padding: 18, gap: 12 }, style];
  return onPress ? <Pressable onPress={onPress} style={st}>{children}</Pressable> : <View style={st}>{children}</View>;
};

export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>{children}</View>
);

export function Badge({ d, color, size = 46, bg }: { d: string; color: string; size?: number; bg?: string }) {
  const p = useP();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.35, backgroundColor: bg ?? p.card, alignItems: 'center', justifyContent: 'center' }}>
      <Icon d={d} color={color} size={size * 0.43} />
    </View>
  );
}

export function Sigla({ t, bg, fg = '#fff', size = 44 }: { t: string; bg: string; fg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: t.length > 3 ? 10 : 13 }}>{t}</Text>
    </View>
  );
}

export function Chips<V extends string | number>({ items, value, onChange }: { items: [V, string][]; value: V; onChange: (v: V) => void }) {
  const p = useP();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ flexGrow: 0, marginHorizontal: -20 }}>
      {items.map(([id, label]) => {
        const on = id === value;
        return (
          <Pressable key={String(id)} accessibilityState={{ selected: on }} onPress={() => onChange(id)} style={{ height: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? (p.inv ? p.accent : p.text) : p.card }}>
            <T s={13} w="700" c={on ? (p.inv ? p.onAccent : p.bg) : p.sub}>{label}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Seg<V extends string>({ items, value, onChange }: { items: [V, string][]; value: V; onChange: (v: V) => void }) {
  const p = useP();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: p.card, borderRadius: 16, padding: 4 }}>
      {items.map(([id, label]) => {
        const on = id === value;
        return (
          <Pressable key={id} accessibilityState={{ selected: on }} onPress={() => onChange(id)} style={{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? p.text : 'transparent' }}>
            <T s={13} w="700" c={on ? p.bg : p.sub}>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Bar({ f, color, h = 8, track }: { f: number; color: string; h?: number; track?: string }) {
  const p = useP();
  return (
    <View style={{ height: h, borderRadius: 999, backgroundColor: track ?? p.track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(f, 1)) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

export function Ring({ f, color, size = 72, stroke = 8, children }: { f: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const p = useP();
  return (
    <PieChart donut radius={size / 2} innerRadius={size / 2 - stroke} innerCircleColor={p.card} data={[{ value: Math.max(f, 0.001) * 100, color }, { value: Math.max(1 - f, 0.001) * 100, color: p.track }]} centerLabelComponent={() => <View>{children}</View>} />
  );
}

// bg = cor do fundo onde o gráfico está; as fatias são separadas por uma borda dessa cor.
export function Donut({ parts, size = 150, stroke = 16, gap = 10, bg, children }: { parts: { f: number; color: string }[]; size?: number; stroke?: number; gap?: number; bg?: string; children?: ReactNode }) {
  const p = useP();
  const back = bg ?? p.card;
  return (
    <PieChart donut radius={size / 2} innerRadius={size / 2 - stroke} innerCircleColor={back} strokeWidth={gap / 2} strokeColor={back} data={parts.map((x) => ({ value: x.f * 100, color: x.color }))} centerLabelComponent={() => <View>{children}</View>} />
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const p = useP();
  return <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: p.dash, true: p.accent }} thumbColor="#fff" />;
}

export function useToggle(init = false): [boolean, () => void] {
  const [v, set] = useState(init);
  return [v, () => set(!v)];
}

export const Pill = ({ children, color, bg, dashed }: { children: ReactNode; color: string; bg?: string; dashed?: boolean }) => {
  const p = useP();
  return (
  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: bg, borderWidth: bg ? 0 : 1, borderColor: p.dash, borderStyle: dashed ? 'dashed' : 'solid' }}>
    <T s={10} w="700" c={color}>{children}</T>
  </View>
  );
};

export function Btn({ children, onPress, kind = 'solid', style }: { children: ReactNode; onPress?: () => void; kind?: 'solid' | 'ghost'; style?: StyleProp<ViewStyle> }) {
  const p = useP();
  const solid = kind === 'solid';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[{ height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: solid ? p.text : p.card2 }, style]}>
      <T s={15} w="800" c={solid ? p.bg : p.text}>{children}</T>
    </Pressable>
  );
}

export function LinkRow({ icon, color, title, sub, href }: { icon: string; color: string; title: string; sub?: string; href?: string }) {
  const p = useP();
  return (
    <Pressable onPress={() => href && router.push(href as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, minHeight: 56 }}>
      <Badge d={icon} color={color} size={42} />
      <T s={15} w="600" style={{ flex: 1 }}>{title}</T>
      {sub ? <T s={12} c={p.mute}>{sub}</T> : null}
      <Icon d={I.next} color={p.mute} size={16} />
    </Pressable>
  );
}

export function MonthNav({ label, onPrev, onNext }: { label: string; onPrev?: () => void; onNext?: () => void }) {
  const p = useP();
  const b = (d: string, l: string, onPress?: () => void) => (
    <Pressable accessibilityLabel={l} onPress={onPress} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: p.card, alignItems: 'center', justifyContent: 'center' }}><Icon d={d} size={18} /></Pressable>
  );
  return <Row style={{ justifyContent: 'space-between' }}>{b(I.back, 'Mês anterior', onPrev)}<T s={15} w="700">{label}</T>{b(I.next, 'Próximo mês', onNext)}</Row>;
}

export const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => {
  const p = useP();
  return (
    <View style={{ flex: 1, backgroundColor: p.card, borderRadius: 20, padding: 14, gap: 8 }}>
      <Label>{label}</Label>
      <T s={15} w="800" c={color}>{value}</T>
    </View>
  );
};

// Grade de N colunas iguais. Percentuais + gap estouram a linha e quebram o layout, então as linhas são montadas à mão.
export function Grid({ cols, gap = 10, children }: { cols: number; gap?: number; children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View style={{ gap }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap }}>
          {Array.from({ length: cols }, (_, k) => <View key={k} style={{ flex: 1 }}>{r[k]}</View>)}
        </View>
      ))}
    </View>
  );
}

export function Field({ label, value, onChange, placeholder, secure, keyboard, hint }: { label: string; value: string; onChange?: (v: string) => void; placeholder?: string; secure?: boolean; keyboard?: 'default' | 'email-address' | 'decimal-pad' | 'phone-pad'; hint?: string }) {
  const p = useP();
  return (
    <View style={{ gap: 8 }}>
      <Label>{label}</Label>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={p.mute} secureTextEntry={secure} keyboardType={keyboard} autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
        style={{ height: 52, borderRadius: 16, backgroundColor: p.card, color: p.text, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: p.line }} />
      {hint ? <T s={11} c={p.mute}>{hint}</T> : null}
    </View>
  );
}

export function SwitchRow({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const p = useP();
  return (
    <Row style={{ minHeight: 56 }}>
      <View style={{ flex: 1, gap: 2 }}><T s={15} w="600">{title}</T>{sub ? <T s={12} c={p.mute}>{sub}</T> : null}</View>
      <Toggle label={title} value={value} onChange={onChange} />
    </Row>
  );
}

// Aviso de sucesso após salvar; some ao navegar.
export function Notice({ children, kind = 'ok' }: { children: ReactNode; kind?: 'ok' | 'err' }) {
  const p = useP();
  return <View style={{ borderRadius: 16, padding: 14, backgroundColor: kind === 'ok' ? p.okBg : p.errBg }}><T s={13} w="700" c={kind === 'ok' ? '#2E9E62' : p.red}>{children}</T></View>;
}
