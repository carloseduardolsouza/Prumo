import { Router } from 'express';
import { asyncHandler as h } from '../../../shared/http/async-handler.js';
import { requireAuth } from '../../../shared/middleware/auth.js';
import { idempotent } from '../../../shared/middleware/idempotency.js';
import { validate } from '../../../shared/middleware/validate.js';
import { CategoryController, StatementController, TransactionController, TransferController, WalletController } from '../controllers/finance.controller.js';
import {
  adjustSchema, categoryCreateSchema, categoryListQuery, categoryUpdateSchema, historyQuery, idParam, importSchema, rangeQuery,
  settleSchema, statementQuery, transferCreateSchema, txCreateSchema, txUpdateSchema, walletCreateSchema, walletListQuery, walletUpdateSchema,
} from '../models/finance.schemas.js';

const c = (k: keyof typeof CategoryController) => h(CategoryController[k]!);
const w = (k: keyof typeof WalletController) => h(WalletController[k]!);
const t = (k: keyof typeof TransactionController) => h(TransactionController[k]!);

// Categorias
export const categories = Router().use(requireAuth);
categories.get('/', validate({ query: categoryListQuery }), c('list'));
categories.post('/', validate({ body: categoryCreateSchema }), c('create'));
categories.patch('/:id', validate({ params: idParam, body: categoryUpdateSchema }), c('update'));
categories.delete('/:id', validate({ params: idParam }), c('archive'));

// Carteiras
export const wallets = Router().use(requireAuth);
wallets.get('/', validate({ query: walletListQuery }), w('list'));
wallets.post('/', idempotent, validate({ body: walletCreateSchema }), w('create'));
wallets.get('/:id', validate({ params: idParam }), w('get'));
wallets.patch('/:id', validate({ params: idParam, body: walletUpdateSchema }), w('update'));
wallets.post('/:id/archive', validate({ params: idParam }), w('archive'));
wallets.post('/:id/unarchive', validate({ params: idParam }), w('unarchive'));
wallets.post('/:id/adjust', idempotent, validate({ params: idParam, body: adjustSchema }), w('adjust'));
wallets.get('/:id/ledger', validate({ params: idParam, query: rangeQuery }), w('ledger'));
wallets.get('/:id/balance-history', validate({ params: idParam, query: historyQuery }), w('balanceHistory'));
wallets.get('/:id/reconcile', validate({ params: idParam }), w('reconcile'));
wallets.post('/:id/reconcile', validate({ params: idParam }), w('reconcile'));
wallets.post('/:id/import', validate({ params: idParam, body: importSchema }), w('import'));

// Lançamentos
export const transactions = Router().use(requireAuth);
transactions.post('/', idempotent, validate({ body: txCreateSchema }), t('create'));
transactions.get('/:id', validate({ params: idParam }), t('get'));
transactions.patch('/:id', validate({ params: idParam, body: txUpdateSchema }), t('update'));
transactions.post('/:id/settle', idempotent, validate({ params: idParam, body: settleSchema }), t('settle'));
transactions.post('/:id/cancel', validate({ params: idParam }), t('cancel'));

// Transferências
export const transfers = Router().use(requireAuth);
transfers.post('/', idempotent, validate({ body: transferCreateSchema }), h(TransferController['create']!));
transfers.post('/:id/cancel', validate({ params: idParam }), h(TransferController['cancel']!));

// Extrato
export const statement = Router().use(requireAuth);
statement.get('/', validate({ query: statementQuery }), h(StatementController['get']!));
