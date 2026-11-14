import { del, get, patch, post, put } from './client';

// Valores monetários trafegam como string decimal ("1234.56"); só viram number para exibir.
export type WalletType = 'CHECKING' | 'SAVINGS' | 'DIGITAL_BANK' | 'BANK' | 'PAYMENT' | 'DIGITAL_WALLET' | 'CASH' | 'INTERNATIONAL' | 'OTHER';

export const WALLET_TYPES: [WalletType, string][] = [
  ['CHECKING', 'Conta corrente'], ['SAVINGS', 'Poupança'], ['DIGITAL_BANK', 'Banco digital'], ['BANK', 'Banco tradicional'], ['PAYMENT', 'Conta de pagamento'],
  ['DIGITAL_WALLET', 'Carteira digital'], ['CASH', 'Dinheiro físico'], ['INTERNATIONAL', 'Conta internacional'], ['OTHER', 'Outra'],
];
export const walletTypeLabel = (t: WalletType) => WALLET_TYPES.find(([k]) => k === t)?.[1] ?? t;

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  institution: string | null;
  color: string | null;
  notes: string | null;
  openingDate: string;
  balance: string;
  negative: boolean;
  archived: boolean;
}
export interface WalletList { wallets: Wallet[]; summary: { totalBalance: string; activeCount: number } }

export interface Category { id: string; name: string; type: 'INCOME' | 'EXPENSE'; icon: string | null; color: string | null; parentId: string | null; archived: boolean }

export type TxStatus = 'planned' | 'partial' | 'settled' | 'canceled';
export interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  status: TxStatus;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  walletId: string | null;
  plannedAmount: string;
  paidAmount: string;
  remaining: string;
  competenceDate: string;
  dueDate: string | null;
  paidDate: string | null;
  notes: string | null;
}

export interface StatementItem {
  id: string;
  kind: 'income' | 'expense' | 'transfer';
  status: 'settled' | 'planned' | 'partial';
  description: string;
  categoryName: string | null;
  walletId: string | null;
  walletName: string | null;
  toWalletName: string | null;
  amount: string;
  plannedAmount: string;
  date: string;
  via?: 'card';
  purchaseId?: string;
  cardName?: string;
}
export interface Statement {
  items: StatementItem[];
  total: number;
  summary: { income: string; expense: string; result: string; plannedIncome: string; plannedExpense: string };
}
export type StatementType = 'todas' | 'receita' | 'despesa' | 'transferencia';

export interface ImportResult { parsed: number; duplicates: number; toImport: number; invalidRows: number; imported: number; errors: string[]; preview: { date: string; description: string; amount: string }[] }

/** Chave de idempotência para POSTs financeiros: o toque duplo ou o retry de rede não duplica o lançamento. */
export const newKey = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
const idem = (key = newKey()) => ({ headers: { 'Idempotency-Key': key } });

const qs = (o: Record<string, string | number | undefined>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
};

export const financeApi = {
  wallets: (status: 'active' | 'archived' | 'all' = 'active') => get<WalletList>(`/wallets${qs({ status })}`),
  wallet: async (id: string) => (await get<{ wallet: Wallet }>(`/wallets/${id}`)).wallet,
  createWallet: async (b: { name: string; type: WalletType; institution?: string; color?: string; openingBalance: string; openingDate?: string }, key?: string) =>
    (await post<{ wallet: Wallet }>('/wallets', b, idem(key))).wallet,
  updateWallet: async (id: string, b: Partial<{ name: string; type: WalletType; institution: string; color: string; notes: string }>) => (await patch<{ wallet: Wallet }>(`/wallets/${id}`, b)).wallet,
  archiveWallet: async (id: string, archived: boolean) => (await post<{ wallet: Wallet }>(`/wallets/${id}/${archived ? 'archive' : 'unarchive'}`)).wallet,
  adjustWallet: async (id: string, newBalance: string, reason: string) => (await post<{ wallet: Wallet }>(`/wallets/${id}/adjust`, { newBalance, reason }, idem())).wallet,
  importFile: (id: string, format: 'csv' | 'ofx', content: string, commit: boolean) => post<ImportResult>(`/wallets/${id}/import`, { format, content, commit }),

  categories: async (type?: 'INCOME' | 'EXPENSE') => (await get<{ categories: Category[] }>(`/categories${qs({ type })}`)).categories,
  createCategory: async (b: { name: string; type: 'INCOME' | 'EXPENSE'; color?: string; parentId?: string }) => (await post<{ category: Category }>('/categories', b)).category,
  archiveCategory: (id: string) => del(`/categories/${id}`),

  transaction: async (id: string) => (await get<{ transaction: Transaction }>(`/transactions/${id}`)).transaction,
  createTransaction: async (b: { type: 'INCOME' | 'EXPENSE'; description: string; amount: string; categoryId?: string; walletId?: string; settled: boolean; competenceDate?: string; dueDate?: string; paidDate?: string; notes?: string }, key?: string) =>
    (await post<{ transaction: Transaction }>('/transactions', b, idem(key))).transaction,
  settleTransaction: async (id: string, b: { walletId: string; amount?: string; date?: string }) => (await post<{ transaction: Transaction }>(`/transactions/${id}/settle`, b, idem())).transaction,
  cancelTransaction: async (id: string) => (await post<{ transaction: Transaction }>(`/transactions/${id}/cancel`)).transaction,
  createTransfer: (b: { fromWalletId: string; toWalletId: string; amount: string; date?: string; notes?: string }, key?: string) => post('/transfers', b, idem(key)),
  cancelTransfer: (id: string) => post(`/transfers/${id}/cancel`),

  statement: (q: { from: string; to: string; type?: StatementType; status?: 'all' | 'settled' | 'planned'; q?: string; walletId?: string; limit?: number }) =>
    get<Statement>(`/statement${qs({ ...q, limit: q.limit ?? 200 })}`),
};

// ── Utilitários de exibição ──────────────────────────────────────────────────
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());

/** Primeiro e último dia de um mês (month: 0-11). */
export function monthRange(year: number, month: number): { from: string; to: string } {
  return { from: iso(new Date(year, month, 1)), to: iso(new Date(year, month + 1, 0)) };
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const monthLabel = (year: number, month: number) => `${MESES[month]} ${year}`;
export const monthName = (month: number) => MESES[month]!;

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MES3 = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
/** "2026-11-14" → "SEX, 14 NOV" */
export function dayHeading(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${DIAS[new Date(y, m - 1, d).getDay()]}, ${d} ${MES3[m - 1]}`;
}
/** "2026-11-14" → "14 nov" */
export const shortDate = (date: string) => { const [, m, d] = date.split('-').map(Number) as [number, number, number]; return `${d} ${MES3[m - 1]!.toLowerCase()}`; };

export const money = (v: string | number, opts: { sign?: boolean; hide?: boolean } = {}) => {
  if (opts.hide) return 'R$ ••••';
  const n = Number(v);
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${opts.sign ? (n < 0 ? '− ' : '+ ') : n < 0 ? '− ' : ''}R$ ${s}`;
};
export const parseMoney = (text: string) => text.trim().replace(/\./g, '').replace(',', '.');

const BRAND: [RegExp, string, string][] = [[/nu|nubank/i, '#820AD1', 'nu'], [/inter/i, '#FF7A00', 'inter'], [/ita[uú]/i, '#EC7000', 'itaú'], [/c6/i, '#2B2B2B', 'C6'], [/bradesco/i, '#CC092F', 'brad'], [/santander/i, '#EC0000', 'sant'], [/caixa/i, '#005CA9', 'caixa']];
/** Cor e sigla da carteira: usa a cor escolhida; senão reconhece bancos conhecidos; senão cinza. */
export function walletBadge(w: { name: string; institution?: string | null; color?: string | null; type?: WalletType }): { bg: string; text: string } {
  const label = `${w.institution ?? ''} ${w.name}`;
  const brand = BRAND.find(([re]) => re.test(label));
  if (w.type === 'CASH') return { bg: w.color ?? '#26282D', text: 'R$' };
  return { bg: w.color ?? brand?.[1] ?? '#3A3D44', text: brand?.[2] ?? (w.institution ?? w.name).slice(0, 4).toLowerCase() };
}

/** "+ R$ 10,00" / "− R$ 10,00"; transferências sem sinal. */
export const moneyKind = (kind: 'income' | 'expense' | 'transfer', value: string, hide = false) =>
  hide ? 'R$ ••••' : kind === 'transfer' ? money(value) : Number(value) < 0 ? `+ ${money(Math.abs(Number(value)))}` : `${kind === 'income' ? '+' : '−'} ${money(value)}`; // valor negativo = estorno

// ── Dashboard (E4) ──────────────────────────────────────────────────────────────
export type PeriodKey = 'today' | 'week' | 'month' | 'prev_month' | '3m' | '6m' | 'year' | 'custom';
export interface CategoryTotal { categoryId: string | null; name: string; color: string; amount: string; percent: number; children: { categoryId: string; name: string; amount: string }[] }
export interface Dashboard {
  period: { key: PeriodKey; from: string; to: string; label: string; bucket: 'day' | 'week' | 'month' };
  balance: { total: string; activeWallets: number };
  summary: { income: string; expense: string; result: string; savingsRate: number | null };
  expensesByCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  series: { label: string; from: string; to: string; income: string; expense: string }[];
  balanceEvolution: { date: string; balance: string }[];
  upcoming: { from: string; to: string; plannedIncome: string; plannedExpense: string; overdueCount: number; overdueAmount: string };
  methodology: string;
}

export const dashboardApi = {
  get: (period: PeriodKey, custom?: { from: string; to: string }) =>
    get<Dashboard>(`/dashboard?period=${period}${period === 'custom' && custom ? `&from=${custom.from}&to=${custom.to}` : ''}`),
};

// ── Cartões e faturas (E5) ──────────────────────────────────────────────────────
export type InvoiceStatus = 'open' | 'closed' | 'partial' | 'paid' | 'overdue';
export interface Invoice {
  id: string; cardId: string; refYear: number; refMonth: number; startDate: string; closingDate: string; dueDate: string;
  status: InvoiceStatus; total: string; paid: string; remaining: string; minimumPayment: string | null; current?: boolean;
}
export interface CardSummary { limit: string; committed: string; available: string; usedPercent: number; currentInvoice: Invoice; futureInstallments: string; note: string }
export interface CreditCard {
  id: string; name: string; issuer: string | null; brand: string | null; holder: string | null; last4: string | null; limit: string;
  closingDay: number; dueDay: number; color: string | null; limitPolicy: 'CONSERVATIVE' | 'INVOICE_ONLY'; status: 'ACTIVE' | 'BLOCKED' | 'CANCELED' | 'ARCHIVED'; notes: string | null;
  summary?: CardSummary;
}
export interface InvoiceDetail {
  invoice: Invoice; card: { id: string; name: string; last4: string | null };
  purchases: { installmentId: string; purchaseId: string; description: string; establishment: string | null; amount: string; date: string; competenceDate: string; number: number; total: number; refund: boolean }[];
  payments: { id: string; amount: string; date: string; walletId: string; canceled: boolean }[];
}
export interface Purchase {
  id: string; cardId: string; cardName: string; description: string; establishment: string | null; categoryId: string | null; purchaseDate: string; totalAmount: string;
  installments: number; refundOfId: string | null; reason: string | null; canceled: boolean;
  items: { id: string; number: number; total: number; amount: string; competenceDate: string; invoiceId: string; invoiceDueDate: string }[];
}

export const INVOICE_LABEL: Record<InvoiceStatus, string> = { open: 'Aberta', closed: 'Fechada', partial: 'Parcial', paid: 'Paga', overdue: 'Vencida' };

export const cardApi = {
  list: () => get<{ cards: CreditCard[]; totals: { availableLimit: string } }>('/cards'),
  get: async (id: string) => (await get<{ card: CreditCard }>(`/cards/${id}`)).card,
  create: async (b: { name: string; issuer?: string; brand?: string; last4?: string; limit: string; closingDay: number; dueDay: number; color?: string; limitPolicy?: string }, key?: string) =>
    (await post<{ card: CreditCard }>('/cards', b, idem(key))).card,
  update: async (id: string, b: Record<string, string>) => (await patch<{ card: CreditCard }>(`/cards/${id}`, b)).card,
  setStatus: async (id: string, status: CreditCard['status']) => (await post<{ card: CreditCard }>(`/cards/${id}/status`, { status })).card,
  adjustLimit: async (id: string, limit: string, reason: string) => (await post<{ card: CreditCard }>(`/cards/${id}/limit`, { limit, reason })).card,
  invoices: async (id: string, from = -3, to = 3) => (await get<{ invoices: Invoice[] }>(`/cards/${id}/invoices?from=${from}&to=${to}`)).invoices,
  future: (id: string) => get<{ months: { refYear: number; refMonth: number; dueDate: string; amount: string }[]; total: string }>(`/cards/${id}/future-installments`),
  invoice: (id: string) => get<InvoiceDetail>(`/invoices/${id}`),
  pay: (id: string, b: { walletId: string; amount: string; date?: string; fees?: string }) => post<InvoiceDetail>(`/invoices/${id}/pay`, b, idem()),
  cancelPayment: (id: string) => post<InvoiceDetail>(`/invoices/payments/${id}/cancel`),
  purchase: async (id: string) => (await get<{ purchase: Purchase }>(`/card-purchases/${id}`)).purchase,
  createPurchase: async (b: { cardId: string; description: string; amount: string; installments: number; categoryId?: string; purchaseDate?: string; notes?: string; reason?: string }, key?: string) =>
    (await post<{ purchase: Purchase }>('/card-purchases', b, idem(key))).purchase,
  cancelPurchase: async (id: string) => (await post<{ purchase: Purchase }>(`/card-purchases/${id}/cancel`)).purchase,
  refund: async (id: string, reason: string, amount?: string) => (await post<{ purchase: Purchase }>(`/card-purchases/${id}/refund`, { reason, ...(amount ? { amount } : {}) }, idem())).purchase,
};

export const invoiceLabel = (i: { refMonth: number; refYear: number }) => `${MES3[i.refMonth - 1]!.charAt(0)}${MES3[i.refMonth - 1]!.slice(1).toLowerCase()}/${String(i.refYear).slice(2)}`;

// ── Recorrências, calendário, divisões (E6) ─────────────────────────────────────
export type Frequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM';
export const FREQUENCIES: [Frequency, string][] = [['MONTHLY', 'Mensal'], ['WEEKLY', 'Semanal'], ['BIWEEKLY', 'Quinzenal'], ['ANNUAL', 'Anual'], ['BIMONTHLY', 'Bimestral'], ['QUARTERLY', 'Trimestral'], ['SEMIANNUAL', 'Semestral'], ['DAILY', 'Diária'], ['CUSTOM', 'Personalizada']];
export interface Rule {
  id: string; type: 'INCOME' | 'EXPENSE'; description: string; categoryId: string | null; categoryName: string | null; walletId: string | null; walletName: string | null;
  amount: string; monthlyAmount: string; frequency: Frequency; intervalDays: number | null; dayOfMonth: number | null; startDate: string; endDate: string | null; isSubscription: boolean; active: boolean; nextDate: string | null;
}
export interface RecurringSummary {
  monthlyTotal: string; fixed: { total: string; items: Rule[] }; subscriptions: { total: string; items: Rule[] }; income: { total: string; items: Rule[] };
  alerts: { kind: 'price_increase'; ruleId: string; description: string; from: string; to: string; yearlyImpact: string }[];
}
export interface SplitItem { id: string; description: string; totalAmount: string; myShare: string; date: string; receivable: string; participants: { id: string; name: string; amount: string; paid: boolean }[] }
export interface CalendarEvent { id: string; date: string; kind: 'income' | 'expense' | 'invoice' | 'transfer' | 'financing' | 'consortium' | 'investment'; title: string; info: string; amount: string | null; status: 'settled' | 'planned' | 'partial' | 'overdue'; href?: string }
export interface Projection { startBalance: string; days: { date: string; balance: string }[]; endBalance: string; lowest: { date: string; balance: string }; firstNegative: { date: string; balance: string } | null; negativeDays: number; assumptions: string }

export const planningApi = {
  recurring: () => get<RecurringSummary>('/recurring'),
  rule: async (id: string) => (await get<{ rule: Rule }>(`/recurring/${id}`)).rule,
  createRule: async (b: Record<string, unknown>, key?: string) => (await post<{ rule: Rule }>('/recurring', b, idem(key))).rule,
  updateRule: async (id: string, b: Record<string, unknown>) => (await patch<{ rule: Rule }>(`/recurring/${id}`, b)).rule,
  stopRule: (id: string) => post(`/recurring/${id}/stop`),
  splits: () => get<{ splits: SplitItem[]; receivable: string }>('/splits'),
  createSplit: async (b: { description: string; totalAmount: string; walletId: string; categoryId?: string; participants: { name: string }[] }, key?: string) => (await post<{ split: SplitItem }>('/splits', b, idem(key))).split,
  paySplit: (splitId: string, participantId: string, walletId: string) => post(`/splits/${splitId}/participants/${participantId}/pay`, { walletId }),
  calendar: (from: string, to: string) => get<{ events: CalendarEvent[]; days: Record<string, { count: number; kinds: CalendarEvent['kind'][] }>; today: string }>(`/calendar?from=${from}&to=${to}`),
  projection: (days = 90) => get<Projection>(`/cash-flow/projection?days=${days}`),
};

// ── Financiamentos e consórcios (E7) ────────────────────────────────────────────
export interface FinSummary {
  estimatedBalance: string; isEstimate: boolean; estimateNote: string; officialBalance: string | null; divergence: string | null; totalContracted: string; totalPaid: string;
  principalAmortized: string; interestPaid: string; feesPaid: string; lateFeesPaid: string; paidCount: number; remainingCount: number; totalCount: number;
  nextDue: { number: number; dueDate: string; total: string; overdue: boolean } | null; estimatedPayoffDate: string | null;
}
export interface Financing {
  id: string; name: string; creditor: string | null; kind: string; system: 'PRICE' | 'SAC'; monthlyRatePercent: string; financedAmount: string; installments: number; feePerInstallment: string;
  firstDueDate: string; dueDay: number; scheduleSource: 'CALCULATED' | 'IMPORTED' | 'MANUAL'; status: 'ACTIVE' | 'PAID_OFF' | 'CANCELED'; summary: FinSummary;
}
export interface FinInstallment { number: number; of: number; dueDate: string; principal: string; interest: string; fees: string; total: string; status: string; paidAmount: string; lateFee: string; paidDate: string | null }
export interface ExtraSimulation { balanceBefore: string; termsBefore: number; termsAfter: number; monthsSaved: number; interestSaved: string; newPayment: string }
export interface Consortium {
  id: string; name: string; administrator: string | null; groupNumber: string | null; quota: string | null; kind: string; status: 'ACTIVE' | 'CONTEMPLATED' | 'CANCELED' | 'CLOSED'; installments: number; installmentAmount: string;
  adjustmentRule: string | null; nextAssemblyDate: string | null;
  summary: { initialLetter: string; currentLetter: string; letterGrowthPercent: number; totalPaid: string; paidCount: number; remainingCount: number; totalCount: number; remainingObligations: string; paidOverLetterPercent: number; receivedOrUsed: string; nextDue: { number: number; dueDate: string; amount: string } | null; note: string };
}
export interface ConsortiumDetail {
  consortium: Consortium;
  schedule: { number: number; dueDate: string; amount: string; status: string; paidAmount: string; paidDate: string | null }[];
  adjustments: { id: string; target: string; mode: string; value: string; previous: string; next: string; effectiveDate: string; source: string; note: string | null }[];
  events: { id: string; kind: string; date: string; modality: string | null; amount: string | null; description: string | null }[];
}
export interface DebtSummary { estimatedBalance: string; isEstimate: boolean; consortiumObligations: string; monthlyPayments: string; incomeCommittedPercent: number | null; interestPaid: string; overdueCount: number; note: string }

export const debtApi = {
  summary: () => get<DebtSummary>('/debts/summary'),
  financings: async () => (await get<{ financings: Financing[] }>('/financings')).financings,
  financing: (id: string) => get<{ financing: Financing; schedule: FinInstallment[] }>(`/financings/${id}`),
  createFinancing: (b: Record<string, unknown>, key?: string) => post<{ financing: Financing; schedule: FinInstallment[] }>('/financings', b, idem(key)),
  payInstallment: (id: string, n: number, b: { walletId: string; lateFee?: string }) => post<{ financing: Financing; schedule: FinInstallment[] }>(`/financings/${id}/installments/${n}/pay`, b, idem()),
  cancelInstallment: (id: string, n: number) => post<{ financing: Financing; schedule: FinInstallment[] }>(`/financings/${id}/installments/${n}/cancel-payment`),
  extra: (id: string, b: { amount: string; mode: 'REDUCE_TERM' | 'REDUCE_INSTALLMENT'; walletId?: string; simulate: boolean }) => post<{ simulation?: ExtraSimulation; applied?: ExtraSimulation }>(`/financings/${id}/extra-amortization`, b),
  payoff: (id: string, walletId: string) => post<{ financing: Financing }>(`/financings/${id}/payoff`, { walletId }, idem()),
  officialBalance: (id: string, amount: string) => put<{ financing: Financing }>(`/financings/${id}/official-balance`, { amount }),
  consortiums: async () => (await get<{ consortiums: Consortium[] }>('/consortiums')).consortiums,
  consortium: (id: string) => get<ConsortiumDetail>(`/consortiums/${id}`),
  createConsortium: (b: Record<string, unknown>, key?: string) => post<ConsortiumDetail>('/consortiums', b, idem(key)),
  payConsortium: (id: string, b: { walletId: string; numbers: number[]; lateFee?: string }) => post<ConsortiumDetail>(`/consortiums/${id}/pay`, b, idem()),
  adjustConsortium: (id: string, b: { target: 'LETTER' | 'INSTALLMENT'; mode: 'AMOUNT' | 'PERCENT'; value: string; source?: 'USER' | 'ADMINISTRATOR'; note?: string }) => post<ConsortiumDetail>(`/consortiums/${id}/adjustments`, b),
  consortiumEvent: (id: string, b: { kind: 'BID' | 'CONTEMPLATION' | 'RELEASE' | 'USE'; amount?: string; modality?: string; description?: string }) => post<ConsortiumDetail>(`/consortiums/${id}/events`, b),
};

// ───────────── E8 · Investimentos ─────────────
export type AssetClass = 'FIXED_INCOME' | 'STOCK' | 'FII' | 'ETF' | 'BDR' | 'CRYPTO' | 'PHYSICAL' | 'CUSTOM';
export const ASSET_CLASSES: [AssetClass, string][] = [['STOCK', 'Ações'], ['FII', 'FIIs'], ['FIXED_INCOME', 'Renda fixa'], ['ETF', 'ETFs'], ['BDR', 'BDRs'], ['CRYPTO', 'Cripto'], ['PHYSICAL', 'Bens físicos'], ['CUSTOM', 'Outros']];
export interface InvAsset { id: string; ticker: string; name: string; assetClass: AssetClass; classLabel: string; archived: boolean; quantity: string; averageCost: string; price: string; value: string; invested: string; unrealized: string; unrealizedPercent: number | null; realized: string; dividends: string; change: number | null; weightPercent: number }
export interface InvOperation { id: string; kind: 'CONTRIBUTION' | 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE'; brokerageId: string; investmentId: string | null; date: string; quantity: string | null; unitPrice: string | null; amount: string; fees: string; dividendKind: string | null; note: string | null; ticker?: string | null; brokerage?: string; scheduled?: boolean }
export interface InvBrokerage { id: string; name: string; note: string | null; cash: string; assetsValue: string; total: string }
export interface InvAlert { id: string; investmentId: string; direction: 'ABOVE' | 'BELOW'; price: string; triggered: boolean; ticker?: string }
export interface InvOverview {
  asOf: string; patrimony: string; positionsValue: string; cash: string; invested: string; contributed: string; result: string; resultPercent: number | null; unrealized: string; realized: string; return12m: number | null; methodology: string; contributedMonth: string;
  dividends: { last12m: string; monthlyAverage: string; yield: number | null; yieldOnCost: number | null; upcoming: { id: string; ticker: string; date: string; amount: string; kind: string | null }[]; upcomingTotal: string; monthly: { month: string; amount: number }[] };
  passiveGoal: { target: string; percent: number } | null;
  allocation: { assetClass: AssetClass; label: string; value: string; percent: number; target: number | null }[];
  series: { month: string; value: number; contributed: number }[];
  highlights: { ticker: string; price: string; change: number }[];
}
export interface InvRebalance { contribution: string; hasTargets: boolean; classes: { assetClass: AssetClass; label: string; current: string; percent: number; target: number; differenceToTarget: string; suggestedContribution: string }[]; note: string }
export interface InvProfile { answered: boolean; profile: 'CONSERVATIVE' | 'MODERATE' | 'BOLD' | null; score: number | null; answers: number[]; updatedAt: string | null }
export interface InvTax { year: number; months: { month: string; group: string; sold: string; gain: string; lossCarried: string; exempt: boolean; base: string; rate: number; tax: string; darfCode: string | null; darfDueDate: string | null }[]; totalTax: string; income: { dividends: string; jcp: string; other: string }; holdings: { ticker: string; name: string; assetClass: string; quantity: string; cost: string }[]; note: string }
export const COLOR_BY_CLASS: Record<string, string> = { FIXED_INCOME: '#F2B437', STOCK: '#4C7DF0', FII: '#46D9C8', ETF: '#A78BFA', BDR: '#A78BFA', CRYPTO: '#FF8A4C', PHYSICAL: '#6FD39B', CUSTOM: '#8A9099' };

export const investApi = {
  overview: () => get<InvOverview>('/investments/overview'),
  brokerages: async () => (await get<{ brokerages: InvBrokerage[] }>('/investments/brokerages')).brokerages,
  createBrokerage: (b: { name: string; note?: string }) => post<{ id: string }>('/investments/brokerages', b),
  removeBrokerage: (id: string) => del(`/investments/brokerages/${id}`),
  assets: async () => (await get<{ assets: InvAsset[] }>('/investments/assets')).assets,
  asset: (id: string) => get<{ asset: InvAsset; quotes: { date: string; price: string }[]; operations: InvOperation[]; alerts: InvAlert[] }>(`/investments/assets/${id}`),
  setQuote: (id: string, price: string, date?: string) => put<{ ok: boolean }>(`/investments/assets/${id}/quote`, { price, ...(date ? { date } : {}) }),
  operations: async (q: { from?: string; to?: string; kind?: string; limit?: number } = {}) => {
    const qs = Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    return (await get<{ operations: InvOperation[] }>(`/investments/operations${qs ? `?${qs}` : ''}`)).operations;
  },
  addOperation: (b: Record<string, unknown>, key?: string) => post<InvOperation>('/investments/operations', b, idem(key)),
  removeOperation: (id: string) => del(`/investments/operations/${id}`),
  alerts: async () => (await get<{ alerts: InvAlert[] }>('/investments/alerts')).alerts,
  addAlert: (b: { investmentId: string; direction: 'ABOVE' | 'BELOW'; price: string }) => post<InvAlert>('/investments/alerts', b),
  removeAlert: (id: string) => del(`/investments/alerts/${id}`),
  rebalance: (contribution = 0) => get<InvRebalance>(`/investments/rebalance?contribution=${contribution}`),
  setTargets: (targets: { assetClass: AssetClass; percent: number }[]) => put<InvRebalance>('/investments/targets', { targets }),
  profile: () => get<InvProfile>('/investments/profile'),
  setProfile: (answers: number[]) => put<InvProfile>('/investments/profile', { answers }),
  tax: (year?: number) => get<InvTax>(`/investments/tax${year ? `?year=${year}` : ''}`),
};

// ───────────── E9 · Planejamento ─────────────
export interface BudgetItem { categoryId: string; name: string; color: string; limit: string; spent: string; remaining: string; percent: number; status: 'ok' | 'warn' | 'over' }
export interface BudgetList { month: string; items: BudgetItem[]; total: { limit: string; spent: string; percent: number }; plannedUntilEnd: string; note: string }
export type Spendable = { hasBudget: false } | { hasBudget: true; today: string; daysLeft: number; free: string; dailyLimit: string; availableToday: string; spentToday: string; week: { date: string; spent: string }[] };
export interface Goal { id: string; name: string; kind: 'SAVING' | 'FREEDOM'; color: string | null; target: string; saved: string; percent: number; status: 'ACTIVE' | 'REACHED' | 'CANCELED'; targetDate: string | null; monthsLeft: number | null; monthlyNeeded: string | null }
export interface GoalDetail { goal: Goal; contributions: { id: string; amount: string; date: string; note: string | null }[] }
export interface AutoInvestRule { id: string; walletId: string; wallet: string; brokerageId: string; brokerage: string; amount: string; dayOfMonth: number; active: boolean; lastRunMonth: string | null; due: boolean }
export interface HealthScore { score: number | null; label: string | null; pillars: { id: string; name: string; value: string; reference: string; score: number; ok: boolean }[]; tips: { title: string; text: string; href: string }[]; window: { days: number; averageIncome: string; averageExpense: string }; note: string }
export interface NetWorth {
  total: string; parts: { personal: string; investments: string; financings: string; cardInvoices: string }; consortiumObligations: string; change12m: string; series: { month: string; personal: number; investments: number }[];
  freedom: { passiveMonthly: string; averageExpense: string; coveragePercent: number | null; coverage: { name: string; amount: string; covered: number }[] }; note: string;
}

export const plannerApi = {
  budgets: (month?: string) => get<BudgetList>(`/budgets${month ? `?month=${month}` : ''}`),
  spendable: () => get<Spendable>('/budgets/spendable'),
  setBudget: (categoryId: string, amount: string) => put<BudgetList>(`/budgets/${categoryId}`, { amount }),
  removeBudget: (categoryId: string) => del<BudgetList>(`/budgets/${categoryId}`),
  goals: async () => (await get<{ goals: Goal[] }>('/goals')).goals,
  goal: (id: string) => get<GoalDetail>(`/goals/${id}`),
  createGoal: (b: { name: string; kind?: 'SAVING' | 'FREEDOM'; targetAmount: string; targetDate?: string; initialAmount?: string; color?: string }) => post<Goal>('/goals', b),
  cancelGoal: (id: string) => patch<Goal>(`/goals/${id}`, { status: 'CANCELED' }),
  contribute: (id: string, amount: string, note?: string) => post<GoalDetail>(`/goals/${id}/contributions`, { amount, ...(note ? { note } : {}) }),
  autoInvest: async () => (await get<{ rules: AutoInvestRule[] }>('/auto-invest')).rules,
  createAutoInvest: (b: { walletId: string; brokerageId: string; amount: string; dayOfMonth: number }) => post('/auto-invest', b),
  toggleAutoInvest: (id: string, active: boolean) => patch(`/auto-invest/${id}`, { active }),
  confirmAutoInvest: (id: string) => post(`/auto-invest/${id}/confirm`),
  removeAutoInvest: (id: string) => del(`/auto-invest/${id}`),
  health: () => get<HealthScore>('/insights/health-score'),
  netWorth: () => get<NetWorth>('/insights/net-worth'),
  exportCsv: (kind: 'transactions' | 'investments', from: string, to: string) => get<string>(`/insights/export?kind=${kind}&from=${from}&to=${to}`, { raw: true }),
};
