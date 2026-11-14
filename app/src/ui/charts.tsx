import { useWindowDimensions } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { useP } from './kit';

// Largura útil dentro de um Card (tela - margens da tela - padding do card).
export const useChartW = (extra = 0) => useWindowDimensions().width - 40 - 36 - extra;

export type BarItem = { label?: string; values: number[]; colors: string[] };

// Barras agrupadas (mode "group") ou empilhadas (mode "stack"); 1 valor por item = série simples.
export function Bars({ items, height = 120, mode = 'group', max, w, refLine }: { items: BarItem[]; height?: number; mode?: 'group' | 'stack'; max?: number; w?: number; refLine?: { value: number; color: string } }) {
  const p = useP();
  const W = w ?? useChartW();
  const n = items.length, k = mode === 'group' ? items[0].values.length : 1;
  const unit = W / n, sp = Math.max(4, unit * 0.28), bw = Math.max(3, (unit - sp - (k - 1) * 2) / k);
  const common = {
    width: W, height, barWidth: bw, spacing: sp, initialSpacing: sp / 2, endSpacing: 0, noOfSections: 3, hideRules: true, hideYAxisText: true,
    yAxisThickness: 0, xAxisThickness: 0, yAxisLabelWidth: 0, disableScroll: true, barBorderRadius: 4, maxValue: max,
    xAxisLabelTextStyle: { color: p.mute, fontSize: 10 }, backgroundColor: 'transparent',
    ...(refLine ? { showReferenceLine1: true, referenceLine1Position: refLine.value, referenceLine1Config: { color: refLine.color, dashWidth: 4, dashGap: 4, thickness: 1 } } : {}),
  };
  if (mode === 'stack') {
    return <BarChart {...common} stackData={items.map((it) => ({ label: it.label, stacks: it.values.map((value, i) => ({ value, color: it.colors[i] })) }))} />;
  }
  const data = items.flatMap((it) => it.values.map((value, i) => ({
    value, frontColor: it.colors[i], spacing: i === k - 1 ? sp : 2, label: i === 0 ? it.label : undefined, labelWidth: k * bw + (k - 1) * 2, labelTextStyle: { color: p.mute, fontSize: 10, textAlign: 'center' as const },
  })));
  return <BarChart {...common} data={data} />;
}

export type Serie = { values: number[]; color: string; dashed?: boolean; area?: boolean };
// Linhas (até 2 séries). Os valores são normalizados pelo mínimo para o gráfico "dar zoom" na variação.
export function Lines({ series, height = 130, w, refLine }: { series: Serie[]; height?: number; w?: number; refLine?: { value: number; color: string } }) {
  const W = w ?? useChartW();
  const all = series.flatMap((s) => s.values), lo = Math.min(...all, refLine?.value ?? Infinity), hi = Math.max(...all, refLine?.value ?? -Infinity);
  const mk = (s: Serie) => s.values.map((v) => ({ value: v - lo }));
  const [a, b] = series;
  return (
    <LineChart
      width={W} height={height} adjustToWidth initialSpacing={6} endSpacing={6} maxValue={(hi - lo) * 1.08 || 1} noOfSections={3}
      hideRules hideYAxisText yAxisThickness={0} xAxisThickness={0} yAxisLabelWidth={0} disableScroll hideDataPoints backgroundColor="transparent"
      data={mk(a)} color={a.color} thickness={3} curved areaChart={a.area} startFillColor={a.color} endFillColor={a.color} startOpacity={0.3} endOpacity={0}
      strokeDashArray={a.dashed ? [5, 5] : undefined}
      {...(b ? { data2: mk(b), color2: b.color, thickness2: 2, strokeDashArray2: b.dashed ? [5, 5] : undefined } : {})}
      {...(refLine ? { showReferenceLine1: true, referenceLine1Position: refLine.value - lo, referenceLine1Config: { color: refLine.color, dashWidth: 4, dashGap: 4, thickness: 1 } } : {})}
    />
  );
}
