import { describe, expect, it } from 'vitest';
import { buildSchedule, interestOf, pricePayment, scheduleFixedPayment, simulateExtra, totalOf } from '../../../../src/modules/core/services/amortization.js';
import { money } from '../../../../src/shared/money.js';

describe('Price', () => {
  it('parcela fixa conhecida: 100.000 a 1% a.m. em 12x = 8.884,88', () => {
    expect(pricePayment(100000, 0.01, 12).toFixed(2)).toBe('8884.88');
  });
  it('principal soma exatamente o valor financiado e o saldo termina em zero (ajuste de centavos)', () => {
    const rows = buildSchedule({ principal: '34870.00', monthlyRate: '0.0149', n: 30, system: 'PRICE' });
    expect(rows).toHaveLength(30);
    expect(rows.reduce((s, r) => s.plus(r.principal), money(0)).toFixed(2)).toBe('34870.00');
    expect(rows.at(-1)!.balanceAfter.toFixed(2)).toBe('0.00');
  });
  it('juros diminuem e amortização cresce ao longo do prazo', () => {
    const rows = buildSchedule({ principal: 10000, monthlyRate: 0.02, n: 12, system: 'PRICE' });
    expect(rows[0]!.interest.gt(rows[11]!.interest)).toBe(true);
    expect(rows[0]!.principal.lt(rows[11]!.principal)).toBe(true);
    expect(rows[0]!.interest.toFixed(2)).toBe('200.00'); // 10.000 × 2%
  });
  it('taxa zero divide em partes iguais, sem juros', () => {
    const rows = buildSchedule({ principal: 1200, monthlyRate: 0, n: 12, system: 'PRICE' });
    expect(interestOf(rows).isZero()).toBe(true);
    expect(rows.every((r) => r.payment.toFixed(2) === '100.00')).toBe(true);
  });
  it('rejeita prazo inválido', () => {
    expect(() => pricePayment(1000, 0.01, 0)).toThrow(RangeError);
  });
});

describe('SAC', () => {
  it('amortização fixa e parcela decrescente', () => {
    const rows = buildSchedule({ principal: 12000, monthlyRate: 0.01, n: 12, system: 'SAC' });
    expect(rows[0]!.principal.toFixed(2)).toBe('1000.00');
    expect(rows[0]!.payment.toFixed(2)).toBe('1120.00'); // 1000 + 12.000 × 1%
    expect(rows[11]!.payment.toFixed(2)).toBe('1010.00');
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.payment.lte(rows[i - 1]!.payment)).toBe(true);
    expect(rows.reduce((s, r) => s.plus(r.principal), money(0)).toFixed(2)).toBe('12000.00');
  });
  it('SAC paga menos juros no total que Price para o mesmo contrato', () => {
    const a = { principal: 50000, monthlyRate: 0.015, n: 36 };
    expect(interestOf(buildSchedule({ ...a, system: 'SAC' })).lt(interestOf(buildSchedule({ ...a, system: 'PRICE' })))).toBe(true);
  });
});

describe('amortização extraordinária (RN046)', () => {
  const base = { balance: '34870.00', monthlyRate: '0.0149', system: 'PRICE' as const, remainingTerms: 30, currentPayment: '1410.55' };
  it('manter a parcela: termina antes e economiza juros (compatível com a tela do protótipo)', () => {
    const r = simulateExtra({ ...base, extra: '5000', mode: 'REDUCE_TERM' });
    expect(r.monthsSaved).toBeGreaterThanOrEqual(3);
    expect(r.interestSaved.gt(0)).toBe(true);
    expect(r.newPayment.toFixed(2)).toBe('1410.55');
  });
  it('manter o prazo: parcela menor, mesmo número de parcelas', () => {
    const r = simulateExtra({ ...base, extra: '5000', mode: 'REDUCE_INSTALLMENT' });
    expect(r.newTerms).toBe(30);
    expect(r.newPayment.lt(1410.55)).toBe(true);
  });
  it('amortizar mais economiza mais', () => {
    const a = simulateExtra({ ...base, extra: '2000', mode: 'REDUCE_TERM' });
    const b = simulateExtra({ ...base, extra: '10000', mode: 'REDUCE_TERM' });
    expect(b.interestSaved.gt(a.interestSaved)).toBe(true);
    expect(b.monthsSaved).toBeGreaterThan(a.monthsSaved);
  });
  it('valores inválidos: zero, negativo ou igual ao saldo (para isso existe a quitação)', () => {
    for (const extra of ['0', '-1', '34870.00', '99999']) expect(() => simulateExtra({ ...base, extra, mode: 'REDUCE_TERM' })).toThrow(RangeError);
  });
  it('parcela que não cobre os juros nunca quita', () => {
    expect(() => scheduleFixedPayment(100000, 0.05, 100)).toThrow(RangeError);
  });
  it('total pago = principal + juros', () => {
    const rows = buildSchedule({ principal: 1000, monthlyRate: 0.02, n: 6, system: 'PRICE' });
    expect(totalOf(rows).toFixed(2)).toBe(money(1000).plus(interestOf(rows)).toFixed(2));
  });
});
