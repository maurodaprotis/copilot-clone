import type { Category, Transaction } from "./types.js";
import { isNeedsReview } from "./review.js";

/** Posted-only: TxnStatus=pending never applies. Unreviewed (To Review) also does not. */
export function appliesToBalance(txn: Transaction): boolean {
  if (txn.status === "pending") return false;
  if (isNeedsReview(txn.review_status)) return false;
  return txn.review_status !== "excluded";
}

function isExcluded(txn: Transaction): boolean {
  if (txn.is_excluded === true) return true;
  return txn.review_status === "excluded";
}

/**
 * Regular non-excluded hits budgets.
 * CLONE-SPEC: pending TxnStatus does NOT; income/transfer never; exclude_from_budget never.
 * Unreviewed (pending / needs_review) also does not — spent rises after Review.
 */
export function hitsBudget(txn: Transaction, category?: Category | null): boolean {
  if (txn.type !== "regular") return false;
  if (txn.status === "pending") return false;
  if (isExcluded(txn)) return false;
  if (isNeedsReview(txn.review_status)) return false;
  if (category?.exclude_from_budget) return false;
  return true;
}

/**
 * Signed amount in account currency for balance rollups.
 * Income / refund of expense adds; regular expense subtracts; transfers net separately.
 */
export function signedAmountAccount(txn: Transaction): number {
  const amt = txn.amount_account;
  if (txn.type === "income") return amt;
  if (txn.type === "regular") return txn.is_refund ? amt : -amt;
  return -amt;
}
