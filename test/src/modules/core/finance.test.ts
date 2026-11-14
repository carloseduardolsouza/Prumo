import { describe, expect, it } from 'vitest';
import { addDays, eachDay, todayIn } from '../../../../src/shared/dates.js';
import { amount, dateStr, transferCreateSchema, txCreateSchema } from '../../../../src/modules/core/models/finance.schemas.js';
import { parseAmount, parseCsv, parseDate, parseOfx, rowHash } from '../../../../src/modules/core/services/import-parsers.js';

describe('dates', () => {
  it('todayIn respeita o fuso (21h em Brasília já é o dia seguinte em UTC)', () => {
    const t = new Date('2026-11-15T00:30:00Z');
    expect(todayIn('America/Sao_Paulo', t)).toBe('2026-11-14');
    expect(todayIn('UTC', t)).toBe('2026-11-15');
  });
  it('addDays e eachDay atravessam meses e anos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(eachDay('2026-11-28', '2026-12-01')).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']);
  });
});

describe('validação de entrada', () => {
  it('valores: aceita vírgula, recusa zero, negativo e mais de 2 casas', () => {
    expect(amount.parse('1234,56')).toBe('1234.56');
    expect(amount.parse(10)).toBe('10');
    for (const bad of ['0', '-5', '1.234', 'abc', '']) expect(amount.safeParse(bad).success).toBe(false);
  });
  it('datas: formato e calendário', () => {
    expect(dateStr.safeParse('2026-02-29').success).toBe(false);
    expect(dateStr.safeParse('14/11/2026').success).toBe(false);
    expect(dateStr.safeParse('2026-11-14').success).toBe(true);
  });
  it('efetivado exige carteira; transferência exige origem diferente do destino', () => {
    const base = { type: 'EXPENSE', description: 'x', amount: '10' };
    expect(txCreateSchema.safeParse({ ...base, settled: true }).success).toBe(false);
    expect(txCreateSchema.safeParse({ ...base, settled: false }).success).toBe(true);
    const id = '7f7a5a3e-0000-4000-8000-000000000001';
    expect(transferCreateSchema.safeParse({ fromWalletId: id, toWalletId: id, amount: '5' }).success).toBe(false);
  });
});

describe('importação', () => {
  it('parseAmount e parseDate aceitam formatos brasileiros e OFX', () => {
    expect(parseAmount('R$ 1.234,56')).toBe('1234.56');
    expect(parseAmount('-45,9')).toBe('-45.90');
    expect(parseAmount('1234.5')).toBe('1234.50');
    expect(parseAmount('abc')).toBeNull();
    expect(parseDate('14/11/2026')).toBe('2026-11-14');
    expect(parseDate('20261114120000[-3:BRT]')).toBe('2026-11-14');
    expect(parseDate('31/02/2026')).toBeNull();
  });

  it('CSV com ; , aspas e cabeçalho acentuado; linhas ruins viram erro, não derrubam', () => {
    const csv = 'Data;Descrição;Valor\n14/11/2026;"Mercado; centro";-386,42\n13/11/2026;Salário;7.000,00\nlixo;x;y\n';
    const { rows, errors } = parseCsv(csv);
    expect(rows).toEqual([
      { date: '2026-11-14', description: 'Mercado; centro', amount: '-386.42' },
      { date: '2026-11-13', description: 'Salário', amount: '7000.00' },
    ]);
    expect(errors).toHaveLength(1);
    expect(parseCsv('a,b\n1,2').errors[0]).toMatch(/colunas/);
  });

  it('OFX SGML', () => {
    const ofx = '<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110120000<TRNAMT>-64.30<FITID>A1<MEMO>Farmacia</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261105<TRNAMT>7000.00<FITID>A2<NAME>Salario</STMTTRN></BANKTRANLIST></OFX>';
    const { rows } = parseOfx(ofx);
    expect(rows).toEqual([
      { date: '2026-11-10', description: 'Farmacia', amount: '-64.30', fitid: 'A1' },
      { date: '2026-11-05', description: 'Salario', amount: '7000.00', fitid: 'A2' },
    ]);
  });

  it('rowHash é estável, ignora caixa/acentos e muda com a carteira ou o valor', () => {
    const r = { date: '2026-11-14', description: 'Mercado São João', amount: '-10.00' };
    expect(rowHash('w1', r)).toBe(rowHash('w1', { ...r, description: 'mercado sao joao' }));
    expect(rowHash('w1', r)).not.toBe(rowHash('w2', r));
    expect(rowHash('w1', r)).not.toBe(rowHash('w1', { ...r, amount: '-11.00' }));
  });
});
