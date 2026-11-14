import type { Handler } from '../../../shared/http/async-handler.js';
import { authOf } from '../../../shared/middleware/auth.js';
import { CategoryService } from '../services/category.service.js';
import { ImportService } from '../services/import.service.js';
import { StatementService } from '../services/statement.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { TransferService } from '../services/transfer.service.js';
import { WalletService } from '../services/wallet.service.js';

const uid = (req: Parameters<Handler>[0]) => authOf(req).userId;
const id = (req: Parameters<Handler>[0]) => String(req.params['id']);
const query = <T>(req: Parameters<Handler>[0]) => (req as unknown as { validatedQuery: T }).validatedQuery;

export const CategoryController: Record<string, Handler> = {
  list: async (req, res) => {
    const q = query<{ type?: 'INCOME' | 'EXPENSE'; archived?: boolean }>(req);
    res.json({ categories: await CategoryService.list(uid(req), q.type, q.archived) });
  },
  create: async (req, res) => {
    res.status(201).json({ category: await CategoryService.create(uid(req), req.body) });
  },
  update: async (req, res) => {
    res.json({ category: await CategoryService.update(uid(req), id(req), req.body) });
  },
  archive: async (req, res) => {
    await CategoryService.archive(uid(req), id(req));
    res.status(204).end();
  },
};

export const WalletController: Record<string, Handler> = {
  list: async (req, res) => {
    res.json(await WalletService.list(uid(req), query<{ status: 'active' | 'archived' | 'all' }>(req).status));
  },
  create: async (req, res) => {
    res.status(201).json({ wallet: await WalletService.create(uid(req), req.body) });
  },
  get: async (req, res) => {
    res.json({ wallet: await WalletService.get(uid(req), id(req)) });
  },
  update: async (req, res) => {
    res.json({ wallet: await WalletService.update(uid(req), id(req), req.body) });
  },
  archive: async (req, res) => {
    res.json({ wallet: await WalletService.setArchived(uid(req), id(req), true) });
  },
  unarchive: async (req, res) => {
    res.json({ wallet: await WalletService.setArchived(uid(req), id(req), false) });
  },
  adjust: async (req, res) => {
    res.status(201).json({ wallet: await WalletService.adjust(uid(req), id(req), req.body) });
  },
  ledger: async (req, res) => {
    const q = query<{ from?: string; to?: string }>(req);
    res.json({ entries: await WalletService.ledger(uid(req), id(req), q.from, q.to) });
  },
  balanceHistory: async (req, res) => {
    res.json({ history: await WalletService.balanceHistory(uid(req), id(req), query<{ days: number }>(req).days) });
  },
  reconcile: async (req, res) => {
    res.json(await WalletService.reconcile(uid(req), id(req), req.method === 'POST'));
  },
  import: async (req, res) => {
    res.json(await ImportService.run(uid(req), id(req), req.body));
  },
};

export const TransactionController: Record<string, Handler> = {
  create: async (req, res) => {
    res.status(201).json({ transaction: await TransactionService.create(uid(req), req.body) });
  },
  get: async (req, res) => {
    res.json({ transaction: await TransactionService.get(uid(req), id(req)) });
  },
  update: async (req, res) => {
    res.json({ transaction: await TransactionService.update(uid(req), id(req), req.body) });
  },
  settle: async (req, res) => {
    res.json({ transaction: await TransactionService.settle(uid(req), id(req), req.body) });
  },
  cancel: async (req, res) => {
    res.json({ transaction: await TransactionService.cancel(uid(req), id(req)) });
  },
};

export const TransferController: Record<string, Handler> = {
  create: async (req, res) => {
    res.status(201).json({ transfer: await TransferService.create(uid(req), req.body) });
  },
  cancel: async (req, res) => {
    res.json({ transfer: await TransferService.cancel(uid(req), id(req)) });
  },
};

export const StatementController: Record<string, Handler> = {
  get: async (req, res) => {
    res.json(await StatementService.get(uid(req), query<Parameters<typeof StatementService.get>[1]>(req)));
  },
};
