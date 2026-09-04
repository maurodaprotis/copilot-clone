import type { Transaction } from "./types.js";

/** Posted-only: pending / unposted do not apply to balance. */
export function appliesToBalance(txn: Transaction): boolean {
  return txn.review_status !== "pending";
}

/**
 * Regular (expense) non-excluded transactions hit budgets.
 * Income/transfer and excluded/pending do not.
 */
export function hitsBudget(txn: Transaction): boolean {
  if (txn.type !== "regular") return false;
  if (txn.review_status === "excluded" || txn.review_status === "pending") {
    return false;
  }
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
