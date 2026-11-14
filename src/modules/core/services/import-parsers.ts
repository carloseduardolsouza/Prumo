import { createHash } from 'node:crypto';
import { money } from '../../../shared/money.js';

export interface ParsedRow {
  date: string; // AAAA-MM-DD
  description: string;
  /** Com sinal: negativo = saída. */
  amount: string;
  fitid?: string | undefined;
}

/** "1.234,56" | "1234.56" | "-45,90" | "R$ 10,00" → "1234.56" */
export function parseAmount(raw: string): string | null {
  let s = raw.replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? money(s).toFixed(2) : null;
}

/** "14/11/2026" | "2026-11-14" | "20261114" | "20261114120000[-3:BRT]" → "2026-11-14" */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return valid(`${m[3]}-${m[2]}-${m[1]}`);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return valid(`${m[1]}-${m[2]}-${m[3]}`);
  m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  return m ? valid(`${m[1]}-${m[2]}-${m[3]}`) : null;
}

const valid = (d: string) => (new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d ? d : null);

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (c === sep && !quoted) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** CSV com cabeçalho (data, descrição/histórico, valor). Aceita ; ou , e valores em pt-BR. */
export function parseCsv(content: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = content.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ['O arquivo precisa ter cabeçalho e ao menos uma linha'] };
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) >= (lines[0]!.match(/,/g)?.length ?? 0) ? ';' : ',';
  const header = splitCsvLine(lines[0]!, sep).map(norm);
  const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iDate = col(['data', 'date']);
  const iDesc = col(['descri', 'historico', 'memo', 'estabelecimento', 'lancamento']);
  const iAmount = col(['valor', 'amount', 'quantia']);
  if (iDate < 0 || iDesc < 0 || iAmount < 0) return { rows: [], errors: ['Não encontrei as colunas data, descrição e valor no cabeçalho'] };

  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, idx) => {
    const c = splitCsvLine(line, sep);
    const date = parseDate(c[iDate] ?? '');
    const amount = parseAmount(c[iAmount] ?? '');
    const description = (c[iDesc] ?? '').trim();
    if (!date || !amount || !description || money(amount).isZero()) errors.push(`Linha ${idx + 2}: dados inválidos`);
    else rows.push({ date, description, amount });
  });
  return { rows, errors };
}

/** OFX (SGML ou XML): blocos <STMTTRN> com DTPOSTED, TRNAMT, FITID e MEMO/NAME. */
export function parseOfx(content: string): { rows: ParsedRow[]; errors: string[] } {
  const blocks = content.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];
  if (!blocks.length) return { rows: [], errors: ['Nenhuma transação encontrada no OFX'] };
  const tag = (b: string, t: string) => new RegExp(`<${t}>\\s*([^<\\r\\n]+)`, 'i').exec(b)?.[1]?.trim();

  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  blocks.forEach((b, i) => {
    const date = parseDate(tag(b, 'DTPOSTED') ?? '');
    const amount = parseAmount(tag(b, 'TRNAMT') ?? '');
    const description = tag(b, 'MEMO') ?? tag(b, 'NAME') ?? '';
    if (!date || !amount || !description || money(amount).isZero()) errors.push(`Transação ${i + 1}: dados inválidos`);
    else rows.push({ date, description, amount, fitid: tag(b, 'FITID') });
  });
  return { rows, errors };
}

/** Identidade estável de uma linha importada: reimportar o mesmo arquivo não duplica (RN011). */
export function rowHash(walletId: string, r: ParsedRow): string {
  const key = [walletId, r.date, r.amount, r.fitid ?? '', norm(r.description).replace(/\s+/g, ' ')].join('|');
  return createHash('sha256').update(key).digest('hex');
}
