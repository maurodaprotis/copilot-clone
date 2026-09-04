import { describe, expect, it } from "vitest";
import {
  budgetPaceByDay,
  budgetSpendDelta,
  computeCategorySpent,
  cumulativeSpendByDay,
  hitsBudget,
  remainingBudget,
  rolloverIntoNext,
  yearMonthFromIso,
  type Category,
  type Transaction,
} from "../src/index.js";

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    account_id: "a1",
    category_id: "cat-dining",
    amount: 50,
    currency: "USD",
    amount_account: 70000,
    amount_reporting: 50,
    type: "regular",
    is_refund: false,
    review_status: "reviewed",
    status: "posted",
    posted_at: "2026-09-04T12:00:00.000Z",
    note: null,
    transfer_pair_id: null,
    fingerprint: null,
    ...partial,
  };
}

const dining: Category = {
  id: "cat-dining",
  group_id: "grp-living",
  name: "Restaurants",
  emoji: "🍽",
  color: "#fbbf24",
  exclude_from_budget: false,
  is_income_category: false,
  archived: false,
  sort_order: 1,
};

const work: Category = {
  ...dining,
  id: "cat-work",
  name: "Work Expenses",
  exclude_from_budget: true,
};

describe("budget spent calculation", () => {
  it("yearMonthFromIso", () => {
    expect(yearMonthFromIso("2026-09-04T12:00:00.000Z")).toBe("2026-09");
  });

  it("reviewed regular spend counts", () => {
    expect(budgetSpendDelta(txn({}), dining)).toBe(50);
    expect(hitsBudget(txn({}), dining)).toBe(true);
  });

  it("needs_review does NOT hit budgets", () => {
    const pending = txn({ review_status: "needs_review" });
    expect(hitsBudget(pending, dining)).toBe(false);
    expect(budgetSpendDelta(pending, dining)).toBe(0);
  });

  it("TxnStatus pending does NOT hit budgets even if reviewed", () => {
    const hold = txn({ status: "pending", review_status: "reviewed" });
    expect(hitsBudget(hold, dining)).toBe(false);
    expect(budgetSpendDelta(hold, dining)).toBe(0);
  });

  it("excluded does not hit budgets", () => {
    expect(
      budgetSpendDelta(txn({ review_status: "excluded" }), dining),
    ).toBe(0);
    expect(budgetSpendDelta(txn({ is_excluded: true }), dining)).toBe(0);
  });

  it("income / transfer never hit budgets", () => {
    expect(budgetSpendDelta(txn({ type: "income" }), dining)).toBe(0);
    expect(budgetSpendDelta(txn({ type: "transfer" }), dining)).toBe(0);
  });

  it("refunds net against spend", () => {
    expect(budgetSpendDelta(txn({ is_refund: true }), dining)).toBe(-50);
  });

  it("exclude_from_budget category ignored", () => {
    expect(budgetSpendDelta(txn({ category_id: "cat-work" }), work)).toBe(0);
  });

  it("computeCategorySpent sums month + category only", () => {
    const rows = [
      txn({ id: "a", amount_reporting: 20, posted_at: "2026-09-01T00:00:00Z" }),
      txn({ id: "b", amount_reporting: 30, posted_at: "2026-09-10T00:00:00Z" }),
      txn({
        id: "c",
        amount_reporting: 99,
        posted_at: "2026-08-31T00:00:00Z",
      }),
      txn({
        id: "d",
        category_id: "cat-groceries",
        amount_reporting: 40,
        posted_at: "2026-09-05T00:00:00Z",
      }),
      txn({
        id: "e",
        amount_reporting: 10,
        is_refund: true,
        posted_at: "2026-09-12T00:00:00Z",
      }),
      txn({
        id: "f",
        amount_reporting: 7,
        review_status: "needs_review",
        posted_at: "2026-09-15T00:00:00Z",
      }),
    ];
    const spent = computeCategorySpent({
      transactions: rows,
      category_id: "cat-dining",
      year_month: "2026-09",
      category: dining,
    });
    // 20 + 30 - 10 = 40; pending 7 excluded; other category/month excluded
    expect(spent).toBe(40);
  });

  it("remaining and rollover modes", () => {
    expect(
      remainingBudget({ budgeted_amount: 100, rollover_from_prior: 20 }, 40),
    ).toBe(80);
    expect(rolloverIntoNext("off", 100, 40)).toBe(0);
    expect(rolloverIntoNext("under_only", 100, 40)).toBe(60);
    expect(rolloverIntoNext("under_only", 100, 140)).toBe(0);
    expect(rolloverIntoNext("over_only", 100, 140)).toBe(-40);
    expect(rolloverIntoNext("both", 100, 140)).toBe(-40);
    expect(rolloverIntoNext("both", 100, 40)).toBe(60);
  });

  it("cumulative spend excludes needs_review; pace is linear", () => {
    const rows = [
      txn({
        id: "1",
        amount_reporting: 10,
        posted_at: "2026-09-01T00:00:00Z",
      }),
      txn({
        id: "2",
        amount_reporting: 20,
        posted_at: "2026-09-03T00:00:00Z",
      }),
      txn({
        id: "3",
        amount_reporting: 5,
        review_status: "needs_review",
        posted_at: "2026-09-02T00:00:00Z",
      }),
    ];
    const cum = cumulativeSpendByDay({
      transactions: rows,
      year_month: "2026-09",
      categories: [dining],
    });
    expect(cum).toHaveLength(30);
    expect(cum[0]).toBe(10);
    expect(cum[1]).toBe(10); // pending day 2 ignored
    expect(cum[2]).toBe(30);
    expect(cum[29]).toBe(30);

    const pace = budgetPaceByDay(300, "2026-09");
    expect(pace).toHaveLength(30);
    expect(pace[29]).toBeCloseTo(300, 10);
    expect(pace[14]).toBeCloseTo(150, 10);
  });
});
