import type { Category, Transaction } from "./types.js";
import { normalizeReviewStatus } from "./types.js";

export function appliesToBalance(txn: Transaction): boolean {
  const review = normalizeReviewStatus(txn.review_status);
  if (review === "needs_review") return false;
  if (txn.status === "pending") return false;
  return true;
}

function isExcluded(txn: Transaction): boolean {
  if (txn.is_excluded === true) return true;
  return normalizeReviewStatus(txn.review_status) === "excluded";
}

export function hitsBudget(txn: Transaction, category?: Category | null): boolean {
  if (txn.type !== "regular") return false;
  if (txn.status === "pending") return false;
  if (isExcluded(txn)) return false;
  if (normalizeReviewStatus(txn.review_status) === "needs_review") return false;
  if (category?.exclude_from_budget) return false;
  return true;
}

export function signedAmountAccount(txn: Transaction): number {
  const amt = txn.amount_account;
  if (txn.type === "income") return amt;
  if (txn.type === "regular") return txn.is_refund ? amt : -amt;
  return -amt;
}
