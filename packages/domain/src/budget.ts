import { hitsBudget } from "./balance.js";
import type {
  BudgetMonth,
  BudgetRolloverMode,
  Category,
  Transaction,
} from "./types.js";

/** Extract YYYY-MM from ISO date/datetime. */
export function yearMonthFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export function daysInYearMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Reporting-currency spend contribution for budgets.
 * Spend is positive; refunds are negative (net against spend — T5).
 * Returns 0 when txn does not hit budgets.
 */
export function budgetSpendDelta(
  txn: Transaction,
  category?: Category | null,
): number {
  if (!hitsBudget(txn, category)) return 0;
  const amt = txn.amount_reporting;
  return txn.is_refund ? -amt : amt;
}

export function computeCategorySpent(input: {
  transactions: Transaction[];
  category_id: string;
  year_month: string;
  category?: Category | null;
}): number {
  let spent = 0;
  for (const txn of input.transactions) {
    if (txn.category_id !== input.category_id) continue;
    if (yearMonthFromIso(txn.posted_at) !== input.year_month) continue;
    spent += budgetSpendDelta(txn, input.category);
  }
  return spent;
}

export function effectiveBudget(budget: Pick<
  BudgetMonth,
  "budgeted_amount" | "rollover_from_prior"
>): number {
  return budget.budgeted_amount + budget.rollover_from_prior;
}

export function remainingBudget(budget: Pick<
  BudgetMonth,
  "budgeted_amount" | "rollover_from_prior"
>, spent: number): number {
  return effectiveBudget(budget) - spent;
}

/** Carry into next month per rollover_mode (B / §4.5). */
export function rolloverIntoNext(
  mode: BudgetRolloverMode,
  effective: number,
  spent: number,
): number {
  const delta = effective - spent; // positive = under, negative = over
  switch (mode) {
    case "off":
      return 0;
    case "under_only":
      return delta > 0 ? delta : 0;
    case "over_only":
      return delta < 0 ? delta : 0;
    case "both":
      return delta;
    default:
      return 0;
  }
}

export type CategoryBudgetRow = {
  category: Category;
  group_id: string;
  budgeted_amount: number;
  rollover_from_prior: number;
  effective: number;
  spent: number;
  remaining: number;
};

export function buildCategoryBudgetRows(input: {
  categories: Category[];
  budgets: BudgetMonth[];
  transactions: Transaction[];
  year_month: string;
}): CategoryBudgetRow[] {
  const budgetByCat = new Map(
    input.budgets
      .filter((b) => b.year_month === input.year_month)
      .map((b) => [b.category_id, b]),
  );

  return input.categories
    .filter((c) => !c.archived)
    .map((category) => {
      const b = budgetByCat.get(category.id);
      const budgeted_amount = b?.budgeted_amount ?? 0;
      const rollover_from_prior = b?.rollover_from_prior ?? 0;
      const spent = computeCategorySpent({
        transactions: input.transactions,
        category_id: category.id,
        year_month: input.year_month,
        category,
      });
      const effective = budgeted_amount + rollover_from_prior;
      return {
        category,
        group_id: category.group_id,
        budgeted_amount,
        rollover_from_prior,
        effective,
        spent,
        remaining: effective - spent,
      };
    });
}

/**
 * Day-by-day cumulative discretionary spend (reporting currency) for Dashboard line.
 * Excludes pending (hitsBudget false). Refunds net against spend.
 */
export function cumulativeSpendByDay(input: {
  transactions: Transaction[];
  year_month: string;
  categories?: Category[];
}): number[] {
  const days = daysInYearMonth(input.year_month);
  const catMap = new Map((input.categories ?? []).map((c) => [c.id, c]));
  const byDay = new Array<number>(days).fill(0);

  for (const txn of input.transactions) {
    if (yearMonthFromIso(txn.posted_at) !== input.year_month) continue;
    const category = txn.category_id
      ? catMap.get(txn.category_id) ?? null
      : null;
    const delta = budgetSpendDelta(txn, category);
    if (delta === 0) continue;
    const day = Number(txn.posted_at.slice(8, 10));
    if (day >= 1 && day <= days) {
      byDay[day - 1]! += delta;
    }
  }

  const cumulative: number[] = [];
  let run = 0;
  for (let i = 0; i < days; i++) {
    run += byDay[i]!;
    cumulative.push(run);
  }
  return cumulative;
}

/** Straight-line budget pace: day d target = totalEffective * d / daysInMonth. */
export function budgetPaceByDay(
  totalEffectiveBudget: number,
  yearMonth: string,
): number[] {
  const days = daysInYearMonth(yearMonth);
  const out: number[] = [];
  for (let d = 1; d <= days; d++) {
    out.push((totalEffectiveBudget * d) / days);
  }
  return out;
}

export function totalEffectiveBudget(rows: CategoryBudgetRow[]): number {
  return rows
    .filter((r) => !r.category.exclude_from_budget)
    .reduce((sum, r) => sum + r.effective, 0);
}
