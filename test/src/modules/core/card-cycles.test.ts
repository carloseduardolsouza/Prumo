import { describe, expect, it } from 'vitest';
import { competenceDate, cycleFor, invoiceStatus, shiftCycle, shiftYm } from '../../../../src/modules/core/services/card-cycles.js';

// Cartão que fecha dia 13 e vence dia 20 (como o Nubank do protótipo).
const C = 13, D = 20;

describe('cycleFor — qual fatura recebe a compra', () => {
  it('compra antes do fechamento entra na fatura do mês', () => {
    expect(cycleFor('2026-11-12', C, D)).toEqual({ startDate: '2026-10-14', closingDate: '2026-11-13', dueDate: '2026-11-20', refYear: 2026, refMonth: 11 });
  });
  it('compra no dia do fechamento ainda entra nessa fatura (inclusivo)', () => {
    expect(cycleFor('2026-11-13', C, D).closingDate).toBe('2026-11-13');
  });
  it('compra no dia seguinte (melhor dia de compra) vai para o ciclo seguinte', () => {
    const c = cycleFor('2026-11-14', C, D);
    expect(c).toMatchObject({ startDate: '2026-11-14', closingDate: '2026-12-13', dueDate: '2026-12-20', refMonth: 12 });
  });
  it('vencimento menor ou igual ao fechamento cai no mês seguinte (fecha 25, vence 5)', () => {
    expect(cycleFor('2026-11-10', 25, 5)).toMatchObject({ closingDate: '2026-11-25', dueDate: '2026-12-05', refYear: 2026, refMonth: 12 });
  });
  it('virada de ano', () => {
    expect(cycleFor('2026-12-20', 13, 20)).toMatchObject({ closingDate: '2027-01-13', dueDate: '2027-01-20', refYear: 2027, refMonth: 1 });
    expect(cycleFor('2026-12-20', 25, 5)).toMatchObject({ closingDate: '2026-12-25', dueDate: '2027-01-05', refYear: 2027 });
  });
  it('fechamento no dia 31 usa o último dia de meses curtos e bissextos', () => {
    expect(cycleFor('2026-02-10', 31, 10).closingDate).toBe('2026-02-28');
    expect(cycleFor('2028-02-10', 31, 10).closingDate).toBe('2028-02-29');
    expect(cycleFor('2026-04-30', 31, 10).closingDate).toBe('2026-04-30');
  });
  it('os ciclos são contíguos: nenhum dia fica sem fatura nem em duas', () => {
    let prevClosing = '';
    for (let d = new Date('2026-01-01T00:00:00Z'); d < new Date('2027-01-01T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const c = cycleFor(date, 31, 10);
      expect(date >= c.startDate && date <= c.closingDate).toBe(true);
      if (prevClosing && c.closingDate !== prevClosing) expect(c.startDate > prevClosing).toBe(true);
      prevClosing = c.closingDate;
    }
  });
});

describe('parcelas', () => {
  it('shiftCycle avança uma fatura por parcela', () => {
    const base = cycleFor('2026-11-12', C, D);
    expect(shiftCycle(base, 1, C, D).dueDate).toBe('2026-12-20');
    expect(shiftCycle(base, 3, C, D)).toMatchObject({ closingDate: '2027-02-13', refYear: 2027, refMonth: 2 });
  });
  it('competência: mesmo dia, mês a mês, ajustada ao fim do mês', () => {
    expect(competenceDate('2026-11-14', 1)).toBe('2026-11-14');
    expect(competenceDate('2026-11-14', 3)).toBe('2027-01-14');
    expect(competenceDate('2026-01-31', 2)).toBe('2026-02-28');
    expect(shiftYm(2026, 11, 2)).toEqual([2027, 1]);
  });
});

describe('invoiceStatus', () => {
  const inv = { closingDate: '2026-11-13', dueDate: '2026-11-20', totalCents: 184210, paidCents: 0 };
  it('aberta até o fechamento (inclusive)', () => {
    expect(invoiceStatus(inv, '2026-11-13')).toBe('open');
  });
  it('fechada, parcial, paga e vencida', () => {
    expect(invoiceStatus(inv, '2026-11-14')).toBe('closed');
    expect(invoiceStatus({ ...inv, paidCents: 50000 }, '2026-11-15')).toBe('partial');
    expect(invoiceStatus({ ...inv, paidCents: 184210 }, '2026-11-15')).toBe('paid');
    expect(invoiceStatus(inv, '2026-11-21')).toBe('overdue');
    expect(invoiceStatus({ ...inv, paidCents: 50000 }, '2026-11-21')).toBe('overdue'); // parcial vencida continua vencida
  });
  it('fechada sem valor não fica pendente', () => {
    expect(invoiceStatus({ ...inv, totalCents: 0 }, '2026-11-25')).toBe('paid');
  });
});
