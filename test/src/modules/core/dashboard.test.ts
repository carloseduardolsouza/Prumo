import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildBuckets, bucketIndex, resolvePeriod, sample, startOfWeek } from '../../../../src/modules/core/services/dashboard-periods.js';
import { totalsByCategory } from '../../../../src/modules/core/services/dashboard.service.js';

const TODAY = '2026-11-14'; // sábado

describe('resolvePeriod', () => {
  it('mês atual e anterior (inclusive virada de ano)', () => {
    expect(resolvePeriod('month', TODAY)).toMatchObject({ from: '2026-11-01', to: '2026-11-30', label: 'Novembro 2026', bucket: 'week' });
    expect(resolvePeriod('prev_month', TODAY)).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(resolvePeriod('prev_month', '2026-01-10')).toMatchObject({ from: '2025-12-01', to: '2025-12-31', label: 'Dezembro 2025' });
  });

  it('3 e 6 meses terminam no fim do mês atual', () => {
    expect(resolvePeriod('3m', TODAY)).toMatchObject({ from: '2026-09-01', to: '2026-11-30', bucket: 'month' });
    expect(resolvePeriod('6m', '2026-02-20')).toMatchObject({ from: '2025-09-01', to: '2026-02-28' });
  });

  it('ano vai de 1º de janeiro até o fim do mês atual', () => {
    expect(resolvePeriod('year', TODAY)).toMatchObject({ from: '2026-01-01', to: '2026-11-30', bucket: 'month' });
  });

  it('semana respeita o primeiro dia (domingo ou segunda)', () => {
    expect(startOfWeek(TODAY, 0)).toBe('2026-11-08');
    expect(startOfWeek(TODAY, 1)).toBe('2026-11-09');
    expect(startOfWeek('2026-11-15', 1)).toBe('2026-11-09'); // domingo pertence à semana que começou na segunda
    expect(resolvePeriod('week', TODAY, { firstDayOfWeek: 1 })).toMatchObject({ from: '2026-11-09', to: '2026-11-15', bucket: 'day' });
  });

  it('hoje e personalizado (balde conforme a duração)', () => {
    expect(resolvePeriod('today', TODAY)).toMatchObject({ from: TODAY, to: TODAY });
    expect(resolvePeriod('custom', TODAY, { from: '2026-11-01', to: '2026-11-20' }).bucket).toBe('day');
    expect(resolvePeriod('custom', TODAY, { from: '2026-08-01', to: '2026-11-20' }).bucket).toBe('week');
    expect(resolvePeriod('custom', TODAY, { from: '2025-01-01', to: '2026-11-20' }).bucket).toBe('month');
    expect(() => resolvePeriod('custom', TODAY, { from: '2026-11-20', to: '2026-11-01' })).toThrow(RangeError);
    expect(() => resolvePeriod('custom', TODAY)).toThrow(RangeError);
  });
});

describe('buildBuckets', () => {
  it('mês em semanas de 7 dias, a última mais curta, sem lacunas', () => {
    const b = buildBuckets('2026-11-01', '2026-11-30', 'week');
    expect(b.map((x) => x.label)).toEqual(['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5']);
    expect(b[0]).toMatchObject({ from: '2026-11-01', to: '2026-11-07' });
    expect(b[4]).toMatchObject({ from: '2026-11-29', to: '2026-11-30' });
    for (let i = 1; i < b.length; i++) expect(b[i]!.from > b[i - 1]!.to).toBe(true);
  });

  it('meses cobrem o período e recortam as pontas', () => {
    const b = buildBuckets('2026-09-15', '2026-11-30', 'month');
    expect(b.map((x) => x.label)).toEqual(['Set', 'Out', 'Nov']);
    expect(b[0]).toMatchObject({ from: '2026-09-15', to: '2026-09-30' });
  });

  it('dias e índice do balde', () => {
    const b = buildBuckets('2026-11-09', '2026-11-15', 'day');
    expect(b).toHaveLength(7);
    expect(bucketIndex(b, '2026-11-11')).toBe(2);
    expect(bucketIndex(b, '2026-12-01')).toBe(-1);
  });

  it('sample mantém primeiro e último ponto', () => {
    const items = Array.from({ length: 365 }, (_, i) => i);
    const s = sample(items, 60);
    expect(s.length).toBeLessThanOrEqual(61);
    expect(s[0]).toBe(0);
    expect(s.at(-1)).toBe(364);
    expect(sample([1, 2, 3], 60)).toEqual([1, 2, 3]);
  });
});

describe('totalsByCategory', () => {
  const cats = [
    { id: 'moradia', name: 'Moradia', color: '#4C7DF0', parentId: null, type: 'EXPENSE' as const },
    { id: 'energia', name: 'Energia', color: '#4C7DF0', parentId: 'moradia', type: 'EXPENSE' as const },
    { id: 'agua', name: 'Água', color: '#4C7DF0', parentId: 'moradia', type: 'EXPENSE' as const },
    { id: 'lazer', name: 'Lazer', color: '#6FD39B', parentId: null, type: 'EXPENSE' as const },
  ];
  const row = (categoryId: string | null, v: string) => ({ categoryId, paidAmount: new Prisma.Decimal(v) });

  it('soma subcategorias no pai, ordena por valor e calcula percentuais', () => {
    const r = totalsByCategory([row('energia', '200.00'), row('agua', '100.00'), row('lazer', '100.00'), row(null, '100.00')], cats);
    expect(r.map((x) => [x.name, x.amount, x.percent])).toEqual([
      ['Moradia', '300.00', 60],
      ['Lazer', '100.00', 20],
      ['Sem categoria', '100.00', 20],
    ]);
    expect(r[0]!.children.map((c) => [c.name, c.amount])).toEqual([['Energia', '200.00'], ['Água', '100.00']]);
  });

  it('sem lançamentos devolve lista vazia (sem dividir por zero)', () => {
    expect(totalsByCategory([], cats)).toEqual([]);
  });

  it('lançamento direto na categoria pai não vira filho', () => {
    const r = totalsByCategory([row('moradia', '50.00')], cats);
    expect(r[0]!.children).toEqual([]);
    expect(r[0]!.amount).toBe('50.00');
  });
});
