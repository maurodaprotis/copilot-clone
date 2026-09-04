import { ClientError } from "./errors.js";
import type { Category, SplitLeg, Transaction } from "./types.js";
import { normalizeReviewStatus } from "./types.js";

const DEFAULT_TOLERANCE = 0.01;

function yearMonthFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export function splitLegsSum(legs: Pick<SplitLeg, "amount">[]): number {
  return legs.reduce((s, l) => s + Number(l.amount), 0);
}

/** SP1 — cannot save unbalanced split. */
export function isBalancedSplit(
  parentAmount: number,
  legs: Pick<SplitLeg, "amount">[],
  tolerance = DEFAULT_TOLERANCE,
): boolean {
  if (legs.length === 0) return false;
  return Math.abs(splitLegsSum(legs) - parentAmount) <= tolerance;
}

export function assertBalancedSplit(
  parentAmount: number,
  legs: Pick<SplitLeg, "amount">[],
  tolerance = DEFAULT_TOLERANCE,
): void {
  if (!isBalancedSplit(parentAmount, legs, tolerance)) {
    throw new ClientError(
      "unbalanced_split",
      `Unbalanced split: legs sum ${splitLegsSum(legs)} != parent ${parentAmount}`,
    );
  }
}

export type SplitBudgetContribution = {
  category_id: string;
  year_month: string;
  /** Reporting-currency spend (positive spend, negative refund). */
  amount_reporting: number;
};

function parentEligibleForSplitBudget(parent: Transaction): boolean {
  if (parent.type !== "regular") return false;
  if (parent.status === "pending") return false;
  if (parent.is_excluded === true) return false;
  const review = normalizeReviewStatus(parent.review_status);
  if (review === "needs_review" || review === "excluded") return false;
  return true;
}

/**
 * Budget contributions for a parent + legs.
 * Parent with is_split_parent does NOT double-count its category_id.
 * SP2: parent excluded ⇒ no leg contributions.
 */
export function splitBudgetContributions(input: {
  parent: Transaction;
  legs: SplitLeg[];
  categories?: Map<string, Category> | Category[];
}): SplitBudgetContribution[] {
  const parent = input.parent;
  if (!parent.is_split_parent) return [];
  if (!parentEligibleForSplitBudget(parent)) return [];

  const catMap =
    input.categories instanceof Map
      ? input.categories
      : new Map((input.categories ?? []).map((c) => [c.id, c]));

  const parentReporting = parent.amount_reporting;
  const parentAmount = parent.amount;
  const ratio = parentAmount === 0 ? 0 : parentReporting / parentAmount;
  const defaultYm = yearMonthFromIso(parent.posted_at);
  const out: SplitBudgetContribution[] = [];

  for (const leg of input.legs) {
    if (leg.transaction_id !== parent.id) continue;
    const cat = catMap.get(leg.category_id);
    if (cat?.exclude_from_budget) continue;
    const reporting = leg.amount * ratio;
    const signed = parent.is_refund ? -reporting : reporting;
    out.push({
      category_id: leg.category_id,
      year_month: leg.year_month_override ?? defaultYm,
      amount_reporting: signed,
    });
  }
  return out;
}

/** Equal split helper for UI. */
export function equalSplitAmounts(
  parentAmount: number,
  legCount: number,
  decimals = 2,
): number[] {
  if (legCount <= 0) return [];
  const factor = 10 ** decimals;
  const totalCents = Math.round(parentAmount * factor);
  const base = Math.floor(totalCents / legCount);
  const amounts = Array.from({ length: legCount }, () => base);
  let rem = totalCents - base * legCount;
  for (let i = 0; i < rem; i++) amounts[i]! += 1;
  return amounts.map((c) => c / factor);
}
