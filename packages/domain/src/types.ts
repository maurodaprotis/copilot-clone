/** Amount is always stored positive; sign comes from transaction type. */
export type TransactionType = "regular" | "income" | "transfer";

/**
 * Review inbox status. Distinct from TxnStatus.
 * `pending` is NOT a ReviewStatus — it is a bank clearing state (TxnStatus).
 * Legacy stored value `"pending"` on review_status is treated as `needs_review`.
 */
export type ReviewStatus = "needs_review" | "reviewed" | "excluded";

/** Bank clearing: pending vs posted. Independent of review_status. */
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
  /** When false, omitted from net-worth total (default true). */
  include_in_net_worth: boolean;
  /**
   * Manual opening / set balance in account currency.
   * Displayed balance = current_balance + signed posted txn deltas.
   */
  current_balance: number;
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
  amount_account: number;
  amount_reporting: number;
  type: TransactionType;
  is_refund: boolean;
  review_status: ReviewStatus;
  /** Bank pending vs posted. Defaults to posted when omitted. */
  status?: TxnStatus;
  /** First-class exclude (T1). Also inferred from review_status === "excluded". */
  is_excluded?: boolean;
  posted_at: string;
  note: string | null;
  transfer_pair_id: string | null;
  fingerprint: string | null;
}

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

/** Map legacy review_status `"pending"` → `needs_review` on read/write. */
export function normalizeReviewStatus(
  value: string | null | undefined,
): ReviewStatus {
  if (value === "reviewed" || value === "excluded") return value;
  return "needs_review";
}

export function isNeedsReview(value: string | null | undefined): boolean {
  return normalizeReviewStatus(value) === "needs_review";
}
