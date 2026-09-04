import type { Transaction } from "./types.js";
import { normalizeReviewStatus } from "./types.js";

/**
 * ReviewStatus needs_review does not apply to balance.
 * Bank TxnStatus "pending" (when present) also does not apply.
 */
export function appliesToBalance(txn: Transaction): boolean {
  const review = normalizeReviewStatus(txn.review_status);
  if (review === "needs_review") return false;
  if (txn.status === "pending") return false;
  return true;
}

/**
 * Regular (expense) non-excluded transactions hit budgets.
 * Income/transfer and excluded/needs_review do not.
 */
export function hitsBudget(txn: Transaction): boolean {
  if (txn.type !== "regular") return false;
  const review = normalizeReviewStatus(txn.review_status);
  if (review === "excluded" || review === "needs_review") {
    return false;
  }
  if (txn.status === "pending") return false;
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
  // transfer: caller pairs legs; single leg treated as outflow of amount_account
  return -amt;
}
