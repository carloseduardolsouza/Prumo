import { addDays } from '../../../shared/dates.js';

export type Frequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM';

export interface RuleSpec {
  frequency: Frequency;
  intervalDays?: number | null;
  dayOfMonth?: number | null;
  startDate: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
}

const MONTH_STEP: Partial<Record<Frequency, number>> = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 };
const DAY_STEP: Partial<Record<Frequency, number>> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14 };

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Data da k-ésima ocorrência (k = 0 é a primeira). Meses sem o dia de referência usam o último dia (spec §7.4). */
export function nthOccurrence(rule: RuleSpec, k: number): string {
  const dayStep = DAY_STEP[rule.frequency] ?? (rule.frequency === 'CUSTOM' ? rule.intervalDays ?? 0 : 0);
  if (dayStep > 0) return addDays(rule.startDate, dayStep * k);
  const step = MONTH_STEP[rule.frequency];
  if (!step) throw new RangeError('Frequência CUSTOM exige intervalDays > 0');
  const [y, m, d] = rule.startDate.split('-').map(Number) as [number, number, number];
  const t = y * 12 + (m - 1) + step * k;
  const ty = Math.floor(t / 12), tm = (t % 12) + 1;
  return `${ty}-${pad(tm)}-${pad(Math.min(rule.dayOfMonth ?? d, lastDay(ty, tm)))}`;
}

/** Ocorrências dentro de [from, to], respeitando data final e quantidade máxima (contada desde o início). */
export function occurrencesBetween(rule: RuleSpec, from: string, to: string): string[] {
  const out: string[] = [];
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
  for (let k = 0; k < 6000; k++) {
    if (rule.maxOccurrences && k >= rule.maxOccurrences) break;
    const d = nthOccurrence(rule, k);
    if (d > end) break;
    if (d >= from) out.push(d);
  }
  return out;
}

/** Equivalente mensal aproximado, só para exibição (totais "por mês" dos recorrentes). */
export function monthlyFactor(rule: Pick<RuleSpec, 'frequency' | 'intervalDays'>): number {
  switch (rule.frequency) {
    case 'DAILY': return 30;
    case 'WEEKLY': return 52 / 12;
    case 'BIWEEKLY': return 26 / 12;
    case 'MONTHLY': return 1;
    case 'BIMONTHLY': return 1 / 2;
    case 'QUARTERLY': return 1 / 3;
    case 'SEMIANNUAL': return 1 / 6;
    case 'ANNUAL': return 1 / 12;
    case 'CUSTOM': return 30 / (rule.intervalDays || 30);
  }
}

// ── Projeção de saldo (RN071/072) ────────────────────────────────────────────────
export interface CashEvent {
  date: string;
  /** Centavos, com sinal. */
  cents: number;
}

export interface ProjectionPoint {
  date: string;
  balanceCents: number;
}

/** Saldo dia a dia: parte do saldo inicial e soma só eventos ainda não efetivados (nunca conta duas vezes). */
export function projectBalance(startCents: number, events: CashEvent[], from: string, to: string): { points: ProjectionPoint[]; min: ProjectionPoint; firstNegative: ProjectionPoint | null } {
  const byDay = new Map<string, number>();
  for (const e of events) byDay.set(e.date < from ? from : e.date, (byDay.get(e.date < from ? from : e.date) ?? 0) + e.cents);
  const points: ProjectionPoint[] = [];
  let bal = startCents;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    bal += byDay.get(d) ?? 0;
    points.push({ date: d, balanceCents: bal });
  }
  const min = points.reduce((m, p) => (p.balanceCents < m.balanceCents ? p : m), points[0]!);
  return { points, min, firstNegative: points.find((p) => p.balanceCents < 0) ?? null };
}
