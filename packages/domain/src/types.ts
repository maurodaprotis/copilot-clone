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

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  kind: "expense" | "income" | "transfer";
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
  /** Bank pending vs posted. Defaults to posted when omitted. */
  status?: TxnStatus;
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

/** Map legacy review_status `"pending"` → `needs_review` on read/write. */
export function normalizeReviewStatus(
  value: string | null | undefined,
): ReviewStatus {
  if (value === "reviewed" || value === "excluded") return value;
  // missing, "pending", "needs_review", or anything else → needs_review
  return "needs_review";
}
