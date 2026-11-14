export type Palette = Record<'bg' | 'card' | 'card2' | 'line' | 'text' | 'sub' | 'mute' | 'accent' | 'onAccent' | 'track' | 'link' | 'dash' | 'okBg' | 'warnBg' | 'errBg' | 'red', string> & { inv: boolean };

const darkExtra = { link: '#9DB8F7', dash: '#3A3D44', okBg: '#173A2B', warnBg: '#3A3220', errBg: '#3A1E22', red: '#FF8A8E' };
const lightExtra = { text: '#16181D', link: '#2F5FD0', dash: '#C4C9D1', okBg: '#DDF5E7', warnBg: '#FBEFD0', errBg: '#FBE0E1', red: '#C7313A', onAccent: '#FFFFFF' };

export const pessoal: Palette = { bg: '#121316', card: '#1C1D21', card2: '#26282D', line: '#2A2C31', text: '#F2F3F5', sub: '#B9BEC6', mute: '#8A9099', accent: '#4C7DF0', onAccent: '#121316', track: '#2A2C31', inv: false, ...darkExtra };
export const invest: Palette = { bg: '#0E1215', card: '#171C20', card2: '#232B31', line: '#232B31', text: '#F2F3F5', sub: '#B9C0C6', mute: '#8A949C', accent: '#46D9C8', onAccent: '#0E1215', track: '#283037', inv: true, ...darkExtra };
export const pessoalLight: Palette = { ...pessoal, bg: '#F4F5F7', card: '#FFFFFF', card2: '#ECEEF2', line: '#E1E4E9', sub: '#4A505A', mute: '#6B7280', track: '#E3E6EB', ...lightExtra };
export const investLight: Palette = { ...invest, bg: '#F1F6F7', card: '#FFFFFF', card2: '#E6EEF0', line: '#DCE6E8', sub: '#4A5559', mute: '#667276', accent: '#0E9F90', track: '#DDE7E9', ...lightExtra, link: '#0E7F74' };

export const C = { blue: '#4C7DF0', yellow: '#F2B437', red: '#E5484D', green: '#6FD39B', violet: '#A78BFA', cyan: '#46D9C8', orange: '#FF8A4C', pink: '#FF8A8E', nu: '#820AD1', inter: '#FF7A00', itau: '#EC7000' };

export const brl = (n: number, d = 2) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (n: number, d = 1, sign = false) => (sign && n > 0 ? '+' : '') + n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
