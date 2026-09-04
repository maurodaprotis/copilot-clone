import { normalizeNamePattern, transactionMatchName } from "./rules.js";
import type { Recurring, RecurringCadence, RecurringKind, Transaction } from "./types.js";

export const DEFAULT_UPCOMING_WITHIN_DAYS = 14;

export function normalizeRecurringKind(
  value: string | null | undefined,
): RecurringKind {
  if (value === "income" || value === "reimbursement") return value;
  return "expense";
}

export function normalizeRecurringCadence(
  value: string | null | undefined,
): RecurringCadence {
  if (
    value === "weekly" ||
    value === "biweekly" ||
    value === "quarterly" ||
    value === "yearly"
  ) {
    return value;
  }
  return "monthly";
}

/** Add calendar months; clamp day to end of target month. */
export function addMonthsClamped(isoDate: string, months: number): string {
  const [ys, ms, ds] = isoDate.slice(0, 10).split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, dim);
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const t = Date.parse(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  const next = new Date(t + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

export function advanceNextExpectedDate(
  fromDate: string,
  cadence: RecurringCadence,
): string {
  const d = fromDate.slice(0, 10);
  switch (cadence) {
    case "weekly":
      return addDaysIso(d, 7);
    case "biweekly":
      return addDaysIso(d, 14);
    case "quarterly":
      return addMonthsClamped(d, 3);
    case "yearly":
      return addMonthsClamped(d, 12);
    case "monthly":
    default:
      return addMonthsClamped(d, 1);
  }
}

/**
 * After a match, roll next_expected_date forward from max(current next, txn day)
 * until it is strictly after the txn date (handles catching up missed cycles).
 */
export function rollForwardAfterMatch(
  recurring: Pick<Recurring, "next_expected_date" | "cadence">,
  txnPostedAt: string,
): string {
  const txnDay = txnPostedAt.slice(0, 10);
  let next = recurring.next_expected_date.slice(0, 10);
  if (next < txnDay) next = txnDay;
  // Always advance at least once so the same txn cannot rematch immediately.
  next = advanceNextExpectedDate(next, recurring.cadence);
  // Catch up if still on/before txn day (shouldn't happen after advance from txnDay).
  let guard = 0;
  while (next <= txnDay && guard < 36) {
    next = advanceNextExpectedDate(next, recurring.cadence);
    guard += 1;
  }
  return next;
}

export function amountWithinTolerance(
  expected: number,
  actual: number,
  opts?: { pct?: number; abs?: number },
): boolean {
  const pct = opts?.pct ?? 0.05;
  const abs = opts?.abs ?? 1;
  const tol = Math.max(Math.abs(expected) * pct, abs);
  return Math.abs(Math.abs(expected) - Math.abs(actual)) <= tol;
}

export function recurringNameMatches(
  recurringName: string,
  txnName: string,
): boolean {
  const a = normalizeNamePattern(recurringName);
  const b = normalizeNamePattern(txnName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function txnKindCompatible(
  kind: RecurringKind,
  txn: Pick<Transaction, "type" | "is_refund">,
): boolean {
  if (kind === "income") return txn.type === "income";
  if (kind === "reimbursement") return txn.type === "regular" && !!txn.is_refund;
  // expense: regular non-refund (also allow regular refund=false)
  return txn.type === "regular" && !txn.is_refund;
}

export type RecurringMatch = {
  recurring: Recurring;
  transaction: Transaction;
  score: number;
};

/**
 * Match a reviewed txn to the best active recurring (name + amount heuristics).
 * Returns null when nothing scores above zero.
 */
export function matchReviewedTxnToRecurring(
  txn: Transaction,
  recurrings: Recurring[],
): RecurringMatch | null {
  if (txn.review_status !== "reviewed") return null;
  let best: RecurringMatch | null = null;
  for (const r of recurrings) {
    if (!r.active) continue;
    if (r.currency.toUpperCase() !== txn.currency.toUpperCase()) continue;
    if (!txnKindCompatible(r.kind, txn)) continue;
    if (!recurringNameMatches(r.name, transactionMatchName(txn))) continue;
    if (!amountWithinTolerance(r.expected_amount, txn.amount)) continue;
    let score = 10;
    if (normalizeNamePattern(r.name) === normalizeNamePattern(transactionMatchName(txn))) {
      score += 5;
    }
    if (Math.abs(r.expected_amount - txn.amount) < 0.005) score += 3;
    if (r.account_id && r.account_id === txn.account_id) score += 2;
    if (r.category_id && r.category_id === txn.category_id) score += 1;
    if (!best || score > best.score) best = { recurring: r, transaction: txn, score };
  }
  return best;
}

export function upcomingRecurrings(
  recurrings: Recurring[],
  opts?: { within_days?: number; as_of?: string },
): Recurring[] {
  const within = opts?.within_days ?? DEFAULT_UPCOMING_WITHIN_DAYS;
  const asOf = (opts?.as_of ?? new Date().toISOString()).slice(0, 10);
  const until = addDaysIso(asOf, within);
  return recurrings
    .filter((r) => r.active)
    .filter((r) => {
      const d = r.next_expected_date.slice(0, 10);
      return d >= asOf && d <= until;
    })
    .sort((a, b) => a.next_expected_date.localeCompare(b.next_expected_date));
}
