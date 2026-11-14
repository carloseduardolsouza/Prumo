import { prisma } from '../../../shared/database.js';
import { badRequest } from '../../../shared/errors.js';
import { money } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { toDate } from '../models/finance.schemas.js';
import { LedgerModel } from '../models/ledger.model.js';
import { TransactionModel } from '../models/transaction.model.js';
import { activeWallet } from './context.js';
import { parseCsv, parseOfx, rowHash } from './import-parsers.js';

export const ImportService = {
  /** `commit=false` só mostra a prévia (o que entra e o que seria duplicado). */
  async run(userId: string, walletId: string, input: { format: 'csv' | 'ofx'; content: string; commit: boolean }) {
    const wallet = await activeWallet(userId, walletId);
    const { rows, errors } = input.format === 'csv' ? parseCsv(input.content) : parseOfx(input.content);
    if (!rows.length) throw badRequest(errors[0] ?? 'Nenhum lançamento encontrado no arquivo', { errors });

    const hashes = rows.map((r) => rowHash(wallet.id, r));
    const existing = await TransactionModel.existingHashes(userId, hashes);
    const seen = new Set<string>(); // o mesmo arquivo pode repetir uma linha idêntica
    const fresh = rows.flatMap((r, i) => {
      const h = hashes[i]!;
      if (existing.has(h) || seen.has(h)) return [];
      seen.add(h);
      return [{ ...r, hash: h }];
    });

    const preview = rows.slice(0, 5).map((r) => ({ date: r.date, description: r.description, amount: r.amount }));
    const summary = { parsed: rows.length, duplicates: rows.length - fresh.length, toImport: fresh.length, invalidRows: errors.length, errors: errors.slice(0, 10), preview };
    if (!input.commit) return { ...summary, imported: 0 };

    await prisma.$transaction(async (tx) => {
      for (const r of fresh) {
        const income = money(r.amount).gt(0);
        const value = money(r.amount).abs().toFixed(2);
        const date = toDate(r.date);
        const t = await TransactionModel.create(tx, {
          userId, type: income ? 'INCOME' : 'EXPENSE', status: 'SETTLED', description: r.description.slice(0, 120), walletId: wallet.id,
          plannedAmount: value, paidAmount: value, competenceDate: date, paidDate: date, externalHash: r.hash,
        });
        await LedgerModel.post(tx, { userId, walletId: wallet.id, amount: money(r.amount).toFixed(4), kind: income ? 'INCOME' : 'EXPENSE', effectiveDate: date, description: r.description, transactionId: t.id });
      }
    }, { timeout: 60_000 });
    await AuditModel.record({ userId, action: 'wallet.import', entity: 'wallet', entityId: wallet.id, after: { format: input.format, imported: fresh.length, duplicates: summary.duplicates } });
    return { ...summary, imported: fresh.length };
  },
};
