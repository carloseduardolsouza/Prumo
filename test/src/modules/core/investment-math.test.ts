import { describe, expect, it } from 'vitest';
import { modifiedDietz, replay, taxByMonth, type Op } from '../../../../src/modules/core/services/investment-math.js';

const op = (o: Partial<Op> & Pick<Op, 'id' | 'kind' | 'date' | 'amount'>): Op => ({ brokerageId: 'b', investmentId: 'a', quantity: null, unitPrice: null, fees: '0', ...o });

describe('replay', () => {
  const ops = [
    op({ id: '1', kind: 'CONTRIBUTION', date: '2026-01-01', amount: '10000', investmentId: null }),
    op({ id: '2', kind: 'BUY', date: '2026-01-02', quantity: '100', unitPrice: '10', amount: '1000', fees: '10' }),
    op({ id: '3', kind: 'BUY', date: '2026-01-03', quantity: '100', unitPrice: '12', amount: '1200' }),
    op({ id: '4', kind: 'SELL', date: '2026-02-01', quantity: '50', unitPrice: '15', amount: '750', fees: '5' }),
    op({ id: '5', kind: 'DIVIDEND', date: '2026-02-10', amount: '30', fees: '3' }),
  ];
  it('calcula custo médio com taxas e resultado realizado', () => {
    const r = replay(ops, '2026-03-01');
    const p = r.positions.get('a')!;
    expect(p.quantity.toString()).toBe('150');
    expect(p.cost.toFixed(2)).toBe('1657.50'); // custo médio 11,05 × 150
    expect(r.realizedByOp.get('4')!.toFixed(2)).toBe('192.50'); // 750 - 5 - 50×11,05
    expect(p.dividends.toFixed(2)).toBe('27.00');
    expect(r.cash.get('b')!.toFixed(2)).toBe('8562.00'); // 10000 - 1010 - 1200 + 745 + 27
  });
  it('ignora operações futuras e sinaliza venda acima da posição', () => {
    expect(replay(ops, '2026-01-02').positions.get('a')!.quantity.toString()).toBe('100');
    expect(replay([...ops, op({ id: '6', kind: 'SELL', date: '2026-03-01', quantity: '500', unitPrice: '10', amount: '5000' })], '2026-04-01').oversold).toBe(true);
  });
});

describe('modifiedDietz', () => {
  it('desconta o aporte do ganho', () => {
    const r = modifiedDietz(1000, 2200, [{ date: '2026-07-01', amount: 1000 }], '2026-01-01', '2026-12-31')!;
    expect(r.toNumber()).toBeGreaterThan(13);
    expect(r.toNumber()).toBeLessThan(14);
  });
  it('retorna nulo sem capital', () => expect(modifiedDietz(0, 0, [], '2026-01-01', '2026-12-31')).toBeNull());
});

describe('taxByMonth', () => {
  it('isenta ações até R$ 20 mil vendidos no mês', () => {
    const [m] = taxByMonth([{ date: '2026-03-10', group: 'STOCK', sold: 19000, gain: 4000 }]);
    expect(m!.exempt).toBe(true);
    expect(m!.tax).toBe('0.00');
  });
  it('taxa 15% acima da isenção e compensa prejuízo anterior', () => {
    const r = taxByMonth([{ date: '2026-03-10', group: 'STOCK', sold: 30000, gain: -1000 }, { date: '2026-04-10', group: 'STOCK', sold: 30000, gain: 3000 }]);
    expect(r[1]!.base).toBe('2000.00');
    expect(r[1]!.tax).toBe('300.00');
  });
  it('FII não tem isenção', () => expect(taxByMonth([{ date: '2026-03-10', group: 'FII', sold: 1000, gain: 100 }])[0]!.tax).toBe('20.00'));
});
