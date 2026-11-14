import { addDays } from '../../../shared/dates.js';

export const PERIOD_KEYS = ['today', 'week', 'month', 'prev_month', '3m', '6m', 'year', 'custom'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];
export type Bucket = 'day' | 'week' | 'month';

export interface Period {
  key: PeriodKey;
  from: string;
  to: string;
  label: string;
  bucket: Bucket;
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MES3 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const parts = (d: string) => d.split('-').map(Number) as [number, number, number];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const firstOfMonth = (date: string) => { const [y, m] = parts(date); return ymd(y, m, 1); };
const endOfMonth = (date: string) => { const [y, m] = parts(date); return ymd(y, m, lastDay(y, m)); };
/** Soma `n` meses (pode ser negativo) ao primeiro dia do mês de `date`. */
function shiftMonth(date: string, n: number): string {
  const [y, m] = parts(date);
  const t = y * 12 + (m - 1) + n;
  return ymd(Math.floor(t / 12), (t % 12) + 1, 1);
}
const br = (d: string) => d.split('-').reverse().join('/');

/** Início da semana que contém `date` (0 = domingo, 1 = segunda). */
export function startOfWeek(date: string, firstDay: 0 | 1): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((dow - firstDay + 7) % 7));
}

export function resolvePeriod(key: PeriodKey, today: string, opts: { firstDayOfWeek?: 0 | 1; from?: string | undefined; to?: string | undefined } = {}): Period {
  const [y, m] = parts(today);
  switch (key) {
    case 'today':
      return { key, from: today, to: today, label: `Hoje, ${br(today)}`, bucket: 'day' };
    case 'week': {
      const from = startOfWeek(today, opts.firstDayOfWeek ?? 0);
      return { key, from, to: addDays(from, 6), label: `Semana de ${br(from).slice(0, 5)} a ${br(addDays(from, 6)).slice(0, 5)}`, bucket: 'day' };
    }
    case 'month':
      return { key, from: firstOfMonth(today), to: endOfMonth(today), label: `${MESES[m - 1]} ${y}`, bucket: 'week' };
    case 'prev_month': {
      const from = shiftMonth(today, -1);
      const [py, pm] = parts(from);
      return { key, from, to: endOfMonth(from), label: `${MESES[pm - 1]} ${py}`, bucket: 'week' };
    }
    case '3m':
    case '6m': {
      const n = key === '3m' ? 3 : 6;
      const from = shiftMonth(today, -(n - 1));
      const [fy, fm] = parts(from);
      return { key, from, to: endOfMonth(today), label: `${MES3[fm - 1]}${fy === y ? '' : ` ${fy}`} – ${MES3[m - 1]} ${y}`, bucket: 'month' };
    }
    case 'year':
      return { key, from: ymd(y, 1, 1), to: endOfMonth(today), label: `Jan – ${MES3[m - 1]} ${y}`, bucket: 'month' };
    case 'custom': {
      if (!opts.from || !opts.to || opts.from > opts.to) throw new RangeError('Período personalizado exige from <= to');
      const days = Math.round((Date.parse(`${opts.to}T00:00:00Z`) - Date.parse(`${opts.from}T00:00:00Z`)) / 86_400_000) + 1;
      return { key, from: opts.from, to: opts.to, label: `${br(opts.from)} – ${br(opts.to)}`, bucket: days <= 31 ? 'day' : days <= 150 ? 'week' : 'month' };
    }
  }
}

export interface BucketRange {
  label: string;
  from: string;
  to: string;
}

/** Divide o período em baldes para o gráfico de barras. Semanas contam de 7 em 7 dias a partir do início. */
export function buildBuckets(from: string, to: string, bucket: Bucket, weekLabels: 'sem' | 'data' = 'sem'): BucketRange[] {
  const out: BucketRange[] = [];
  if (bucket === 'day') {
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ label: br(d).slice(0, 5), from: d, to: d });
  } else if (bucket === 'week') {
    for (let d = from, i = 1; d <= to; d = addDays(d, 7), i++) {
      const end = addDays(d, 6) > to ? to : addDays(d, 6);
      out.push({ label: weekLabels === 'sem' ? `Sem ${i}` : br(d).slice(0, 5), from: d, to: end });
    }
  } else {
    for (let d = firstOfMonth(from); d <= to; d = shiftMonth(d, 1)) {
      const [, mm] = parts(d);
      out.push({ label: MES3[mm - 1]!, from: d < from ? from : d, to: endOfMonth(d) > to ? to : endOfMonth(d) });
    }
  }
  return out;
}

/** Índice do balde que contém `date` (-1 se fora). */
export function bucketIndex(buckets: BucketRange[], date: string): number {
  return buckets.findIndex((b) => date >= b.from && date <= b.to);
}

/** Reduz a série a no máximo `max` pontos, sempre mantendo o primeiro e o último. */
export function sample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = Math.ceil(items.length / max);
  const out = items.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== items[items.length - 1]) out.push(items[items.length - 1]!);
  return out;
}
