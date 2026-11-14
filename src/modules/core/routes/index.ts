import { Router } from 'express';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import { cardPurchases, cards, invoices } from './card.routes.js';
import { consortiums, debts, financings } from './debts.routes.js';
import { calendar, cashFlow, internal, recurring, splits } from './planning.routes.js';
import { dashboard, reports } from './dashboard.routes.js';
import { investments } from './investment.routes.js';
import { autoInvest, budgets, goals, insights } from './planner.routes.js';
import { categories, statement, transactions, transfers, wallets } from './finance.routes.js';

// Cada entrega registra aqui seus routers.
const router = Router();

router.get('/', (_req, res) => {
  res.json({ name: 'prumo-core', version: '0.9.0', docs: 'docs/api/bruno' });
});

router.use('/auth', authRoutes); // E1
router.use('/me', meRoutes); // E1
router.use('/categories', categories); // E3
router.use('/wallets', wallets); // E3
router.use('/transactions', transactions); // E3
router.use('/transfers', transfers); // E3
router.use('/statement', statement); // E3
router.use('/dashboard', dashboard); // E4
router.use('/reports', reports); // E4
router.use('/cards', cards); // E5
router.use('/invoices', invoices); // E5
router.use('/card-purchases', cardPurchases); // E5
router.use('/recurring', recurring); // E6
router.use('/splits', splits); // E6
router.use('/calendar', calendar); // E6
router.use('/cash-flow', cashFlow); // E6
router.use('/internal', internal); // E6 (chave interna)
router.use('/financings', financings); // E7
router.use('/consortiums', consortiums); // E7
router.use('/debts', debts); // E7
router.use('/investments', investments); // E8
router.use('/budgets', budgets); // E9
router.use('/goals', goals); // E9
router.use('/auto-invest', autoInvest); // E9
router.use('/insights', insights); // E9

export default router;
