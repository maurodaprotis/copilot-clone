/** Amount is always stored positive; sign comes from transaction type. */
export type TransactionType = "regular" | "income" | "transfer";

/**
 * To Review inbox. Spec: needs_review | reviewed.
 * Scaffold also used pending (= needs_review) and excluded.
 */
export type ReviewStatus = "pending" | "needs_review" | "reviewed" | "excluded";

/** CLONE-SPEC TxnStatus. Pending does not move balances, budgets, or cash flow. */
export type TxnStatus = "pending" | "posted";

export type BudgetRolloverMode = "off" | "under_only" | "over_only" | "both";

export interface UserSettings {
  id: string;
  reporting_currency: string;
  locale: string;
  timezone: string;
}

export interface Account {
  id: string;
  name: string;
  currency: string;
  type: "cash" | "bank" | "credit" | "investment" | "other";
  is_archived: boolean;
}

export interface CategoryGroup {
  id: string;
  name: string;
  sort_order: number;
  is_system: boolean;
}

export interface Category {
  id: string;
  group_id: string;
  name: string;
  emoji: string;
  color: string;
  exclude_from_budget: boolean;
  is_income_category: boolean;
  archived: boolean;
  sort_order: number;
}

export interface BudgetMonth {
  category_id: string;
  year_month: string;
  /** Reporting currency (USD). */
  budgeted_amount: number;
  rollover_mode: BudgetRolloverMode;
  rollover_from_prior: number;
}

export interface Transaction {
  id: string;
  account_id: string;
  category_id: string | null;
  /** Always positive. */
  amount: number;
  currency: string;
  /** Amount in the account's currency (positive). */
  amount_account: number;
  /** Amount in reporting currency (positive). */
  amount_reporting: number;
  type: TransactionType;
  is_refund: boolean;
  review_status: ReviewStatus;
  /**
   * Posted vs pending hold. Defaults to posted when omitted (older rows).
   * Independent of review_status (needs_review can still be posted).
   */
  status?: TxnStatus;
  /** First-class exclude (T1). Also inferred from review_status === "excluded". */
  is_excluded?: boolean;
  posted_at: string;
  note: string | null;
  transfer_pair_id: string | null;
  fingerprint: string | null;
}

/** rate_book maps `${from}:${to}:${YYYY-MM-DD}` -> rate (1 from = rate to). */
export type RateBook = Record<string, number>;

export interface FxRate {
  from: string;
  to: string;
  on_date: string;
  rate: number;
}

export interface FxConvertResult {
  amount: number;
  from: string;
  to: string;
  on_date: string;
  rate: number | null;
  used_fallback: boolean;
  warning?: string;
}
