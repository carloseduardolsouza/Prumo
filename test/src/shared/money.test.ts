import { describe, expect, it } from 'vitest';
import { money, round2, splitEvenly, toMoneyString } from '../../../src/shared/money.js';

describe('money', () => {
  it('não sofre erro de ponto flutuante', () => {
    expect(money('0.1').plus('0.2').toString()).toBe('0.3');
  });

  it('arredonda para 2 casas (half up) e formata como string', () => {
    expect(round2('10.005').toString()).toBe('10.01');
    expect(toMoneyString(1234.5)).toBe('1234.50');
  });

  it('divide em parcelas cuja soma é exatamente o total (RN032)', () => {
    const parts = splitEvenly('100.00', 3);
    expect(parts.map((p) => p.toFixed(2))).toEqual(['33.34', '33.33', '33.33']);
    expect(parts.reduce((s, p) => s.plus(p), money(0)).toFixed(2)).toBe('100.00');
  });

  it('divide valores sem sobra de centavos', () => {
    expect(splitEvenly('599.40', 6).map((p) => p.toFixed(2))).toEqual(Array(6).fill('99.90'));
  });

  it('rejeita número de parcelas inválido', () => {
    expect(() => splitEvenly(10, 0)).toThrow(RangeError);
  });
});
