import type { WalletType } from '@prisma/client';
import { prisma } from '../../../shared/database.js';
import { addDays, eachDay } from '../../../shared/dates.js';
import { conflict, notFound } from '../../../shared/errors.js';
import { money, toMoneyString } from '../../../shared/money.js';
import { AuditModel } from '../models/audit.model.js';
import { fromDate, toDate } from '../models/finance.schemas.js';
import { LedgerModel } from '../models/ledger.model.js';
import { WalletModel, toPublicWallet } from '../models/wallet.model.js';
import { dateOrToday, todayOf } from './context.js';

export const toPublicEntry = (e: Awaited<ReturnType<typeof LedgerModel.list>>[number]) => ({
  id: e.id, kind: e.kind, amount: toMoneyString(e.amount.toString()), date: fromDate(e.effectiveDate), description: e.description,
  transactionId: e.transactionId, transferId: e.transferId, reversesEntryId: e.reversesEntryId,
});

async function ownedWallet(userId: string, id: string) {
  const w = await WalletModel.find(userId, id);
  if (!w) throw notFound('Carteira');
  return w;
}

export const WalletService = {
  async create(userId: string, input: { name: string; type: WalletType; institution?: string | undefined; color?: string | undefined; icon?: string | undefined; notes?: string | undefined; openingBalance: string; openingDate?: string | undefined }) {
    const openingDate = await dateOrToday(userId, input.openingDate);
    const opening = money(input.openingBalance);
    const wallet = await prisma.$transaction(async (tx) => {
      const w = await WalletModel.create(tx, {
        userId, name: input.name, type: input.type, institution: input.institution ?? null, color: input.color ?? null, icon: input.icon ?? null, notes: input.notes ?? null, openingDate,
      });
      // O saldo inicial entra como abertura, nunca como receita do período.
      if (!opening.isZero()) await LedgerModel.post(tx, { userId, walletId: w.id, amount: opening.toFixed(4), kind: 'OPENING', effectiveDate: openingDate, description: 'Saldo inicial' });
      return tx.wallet.findUniqueOrThrow({ where: { id: w.id } });
    });
    await AuditModel.record({ userId, action: 'wallet.create', entity: 'wallet', entityId: wallet.id, after: { name: wallet.name, type: wallet.type } });
    return toPublicWallet(wallet);
  },

  async list(userId: string, status: 'active' | 'archived' | 'all') {
    const wallets = await WalletModel.list(userId, status);
    const active = wallets.filter((w) => !w.archivedAt);
    const total = active.reduce((s, w) => s.plus(w.cachedBalance.toString()), money(0));
    return { wallets: wallets.map(toPublicWallet), summary: { totalBalance: toMoneyString(total), activeCount: active.length } };
  },

  async get(userId: string, id: string) {
    return toPublicWallet(await ownedWallet(userId, id));
  },

  async update(userId: string, id: string, patch: Record<string, string | undefined>) {
    const before = await ownedWallet(userId, id);
    const data = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const w = await WalletModel.update(id, data);
    await AuditModel.record({ userId, action: 'wallet.update', entity: 'wallet', entityId: id, before: { name: before.name }, after: { name: w.name } });
    return toPublicWallet(w);
  },

  /** Arquiva: mantém o histórico e deixa de aceitar lançamentos comuns (RN019). */
  async setArchived(userId: string, id: string, archived: boolean) {
    const w = await ownedWallet(userId, id);
    if (archived && w.archivedAt) throw conflict('Carteira já está arquivada');
    if (!archived && !w.archivedAt) throw conflict('Carteira já está ativa');
    const updated = await WalletModel.update(id, { archivedAt: archived ? new Date() : null });
    await AuditModel.record({ userId, action: archived ? 'wallet.archive' : 'wallet.unarchive', entity: 'wallet', entityId: id });
    return toPublicWallet(updated);
  },

  /** Ajuste manual com justificativa obrigatória (RN018): vira um lançamento de ajuste no ledger. */
  async adjust(userId: string, id: string, input: { newBalance?: string | undefined; delta?: string | undefined; reason: string; date?: string | undefined }) {
    await ownedWallet(userId, id);
    const current = money((await LedgerModel.sumOf(id))?.toString() ?? 0);
    const delta = input.newBalance !== undefined ? money(input.newBalance).minus(current) : money(input.delta ?? 0);
    if (delta.isZero()) throw conflict('O saldo já é esse: nada a ajustar');
    const date = await dateOrToday(userId, input.date);
    const updated = await prisma.$transaction(async (tx) => {
      await LedgerModel.post(tx, { userId, walletId: id, amount: delta.toFixed(4), kind: 'ADJUSTMENT', effectiveDate: date, description: input.reason });
      return tx.wallet.findUniqueOrThrow({ where: { id } });
    });
    await AuditModel.record({ userId, action: 'wallet.adjust', entity: 'wallet', entityId: id, before: { balance: toMoneyString(current) }, after: { balance: toMoneyString(current.plus(delta)), reason: input.reason } });
    return toPublicWallet(updated);
  },

  async ledger(userId: string, id: string, from?: string, to?: string) {
    await ownedWallet(userId, id);
    return (await LedgerModel.list(id, from ? toDate(from) : undefined, to ? toDate(to) : undefined)).map(toPublicEntry);
  },

  /** Saldo de fechamento de cada dia dos últimos `days` dias (evolução do saldo, RF021). */
  async balanceHistory(userId: string, id: string, days: number) {
    await ownedWallet(userId, id);
    const today = await todayOf(userId);
    const start = addDays(today, -(days - 1));
    let running = money((await LedgerModel.sumUntil(id, toDate(addDays(start, -1))))?.toString() ?? 0);
    const deltas = new Map((await LedgerModel.dailyDeltas(id, toDate(start))).map((d): [string, ReturnType<typeof money>] => [fromDate(d.effectiveDate), money(d._sum.amount?.toString() ?? 0)]));
    return eachDay(start, today).map((date) => {
      running = running.plus(deltas.get(date) ?? 0);
      return { date, balance: toMoneyString(running) };
    });
  },

  /** O saldo em cache precisa bater com a soma do ledger (RN013); `fix` corrige o cache. */
  async reconcile(userId: string, id: string, fix: boolean) {
    const w = await ownedWallet(userId, id);
    const ledger = money((await LedgerModel.sumOf(id))?.toString() ?? 0);
    const cached = money(w.cachedBalance.toString());
    const consistent = ledger.equals(cached);
    if (!consistent && fix) {
      await WalletModel.setBalance(id, ledger.toFixed(4));
      await AuditModel.record({ userId, action: 'wallet.reconcile_fix', entity: 'wallet', entityId: id, before: { cached: toMoneyString(cached) }, after: { cached: toMoneyString(ledger) } });
    }
    return { walletId: id, ledgerBalance: toMoneyString(ledger), cachedBalance: toMoneyString(cached), consistent, fixed: !consistent && fix };
  },
};
