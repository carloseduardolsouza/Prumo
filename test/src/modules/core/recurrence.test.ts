import { describe, expect, it } from 'vitest';
import { monthlyFactor, nthOccurrence, occurrencesBetween, projectBalance, type RuleSpec } from '../../../../src/modules/core/services/recurrence.js';

const monthly = (over: Partial<RuleSpec> = {}): RuleSpec => ({ frequency: 'MONTHLY', startDate: '2026-01-31', ...over });

describe('occurrencesBetween', () => {
  it('mensal no dia 31: meses curtos caem no último dia e voltam ao 31 depois (sem acumular erro)', () => {
    expect(occurrencesBetween(monthly(), '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    expect(nthOccurrence(monthly({ startDate: '2028-01-31' }), 1)).toBe('2028-02-29'); // bissexto
  });

  it('dia de referência diferente do dia inicial', () => {
    const r = monthly({ startDate: '2026-11-05', dayOfMonth: 10 });
    expect(occurrencesBetween(r, '2026-11-01', '2027-01-31')).toEqual(['2026-11-10', '2026-12-10', '2027-01-10']);
  });

  it('semanal, quinzenal, diária e personalizada', () => {
    expect(occurrencesBetween({ frequency: 'WEEKLY', startDate: '2026-11-02' }, '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(occurrencesBetween({ frequency: 'BIWEEKLY', startDate: '2026-11-02' }, '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-16', '2026-11-30']);
    expect(occurrencesBetween({ frequency: 'DAILY', startDate: '2026-11-28' }, '2026-11-28', '2026-12-01')).toHaveLength(4);
    expect(occurrencesBetween({ frequency: 'CUSTOM', intervalDays: 10, startDate: '2026-11-01' }, '2026-11-01', '2026-11-30')).toEqual(['2026-11-01', '2026-11-11', '2026-11-21']);
    expect(() => nthOccurrence({ frequency: 'CUSTOM', startDate: '2026-11-01' }, 1)).toThrow(RangeError);
  });

  it('bimestral, trimestral, semestral e anual', () => {
    const s = '2026-01-15';
    expect(occurrencesBetween({ frequency: 'BIMONTHLY', startDate: s }, s, '2026-07-31')).toEqual(['2026-01-15', '2026-03-15', '2026-05-15', '2026-07-15']);
    expect(occurrencesBetween({ frequency: 'QUARTERLY', startDate: s }, s, '2026-12-31')).toHaveLength(4);
    expect(occurrencesBetween({ frequency: 'SEMIANNUAL', startDate: s }, s, '2027-12-31')).toEqual(['2026-01-15', '2026-07-15', '2027-01-15', '2027-07-15']);
    expect(occurrencesBetween({ frequency: 'ANNUAL', startDate: s }, s, '2028-12-31')).toEqual(['2026-01-15', '2027-01-15', '2028-01-15']);
  });

  it('respeita data final e número máximo contado desde o início (não reinicia por janela)', () => {
    expect(occurrencesBetween(monthly({ startDate: '2026-01-10', endDate: '2026-03-31' }), '2026-01-01', '2026-12-31')).toHaveLength(3);
    const lim = monthly({ startDate: '2026-01-10', maxOccurrences: 3 });
    expect(occurrencesBetween(lim, '2026-01-01', '2026-12-31')).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
    expect(occurrencesBetween(lim, '2026-03-01', '2026-12-31')).toEqual(['2026-03-10']); // 3ª ocorrência, não "3 novas"
  });

  it('idempotente: pedir a mesma janela duas vezes dá o mesmo resultado', () => {
    const r = monthly({ startDate: '2026-11-05' });
    expect(occurrencesBetween(r, '2026-11-01', '2027-02-01')).toEqual(occurrencesBetween(r, '2026-11-01', '2027-02-01'));
  });
});

describe('monthlyFactor', () => {
  it('equivalentes mensais', () => {
    expect(monthlyFactor({ frequency: 'MONTHLY' })).toBe(1);
    expect(monthlyFactor({ frequency: 'ANNUAL' })).toBeCloseTo(1 / 12);
    expect(monthlyFactor({ frequency: 'WEEKLY' })).toBeCloseTo(4.333, 2);
    expect(monthlyFactor({ frequency: 'CUSTOM', intervalDays: 15 })).toBe(2);
  });
});

describe('projectBalance', () => {
  it('soma eventos por dia e detecta o primeiro dia negativo', () => {
    const r = projectBalance(100_000, [{ date: '2026-12-05', cents: -150_000 }, { date: '2026-12-10', cents: 700_000 }, { date: '2026-12-05', cents: -10_000 }], '2026-12-01', '2026-12-12');
    expect(r.points).toHaveLength(12);
    expect(r.points[3]!.balanceCents).toBe(100_000); // dia 4: nada aconteceu
    expect(r.firstNegative).toEqual({ date: '2026-12-05', balanceCents: -60_000 });
    expect(r.min.balanceCents).toBe(-60_000);
    expect(r.points.at(-1)!.balanceCents).toBe(640_000);
  });
  it('evento atrasado (antes do início) cai no primeiro dia; sem eventos o saldo é constante', () => {
    expect(projectBalance(1000, [{ date: '2026-11-01', cents: -400 }], '2026-12-01', '2026-12-03').points[0]!.balanceCents).toBe(600);
    const flat = projectBalance(5000, [], '2026-12-01', '2026-12-05');
    expect(flat.firstNegative).toBeNull();
    expect(new Set(flat.points.map((p) => p.balanceCents))).toEqual(new Set([5000]));
  });
});
