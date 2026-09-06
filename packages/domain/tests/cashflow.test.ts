import { describe, expect, it } from "vitest";
import {
  computeCashFlow,
  cashFlowSeries,
  computeCashFlowWithPrior,
  computeCashFlowRangePayload,
  resolveCashFlowWindow,
  priorYearMonth,
  shiftYearMonth,
  seedDemoTransactions,
  type Transaction,
} from "../src/index.js";

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    account_id: "a1",
    category_id: "c1",
    amount: 100,
    currency: "USD",
    amount_account: 100,
    amount_reporting: 100,
    type: "regular",
    is_refund: false,
    review_status: "reviewed",
    status: "posted",
    posted_at: "2026-09-10T12:00:00.000Z",
    note: null,
    transfer_pair_id: null,
    fingerprint: null,
    ...partial,
  };
}

describe("cash flow", () => {
  it("shifts year months across year boundaries", () => {
    expect(priorYearMonth("2026-01")).toBe("2025-12");
    expect(shiftYearMonth("2026-09", -1)).toBe("2026-08");
    expect(shiftYearMonth("2026-12", 1)).toBe("2027-01");
  });

  it("sums income, nets refunds into spend, omits transfers", () => {
    const transactions = [
      txn({ id: "i1", type: "income", amount_reporting: 3000, posted_at: "2026-09-01T00:00:00Z" }),
      txn({ id: "s1", type: "regular", amount_reporting: 200, posted_at: "2026-09-05T00:00:00Z" }),
      txn({
        id: "r1",
        type: "regular",
        is_refund: true,
        amount_reporting: 50,
        posted_at: "2026-09-06T00:00:00Z",
      }),
      txn({ id: "tr", type: "transfer", amount_reporting: 999, posted_at: "2026-09-07T00:00:00Z" }),
      txn({
        id: "nr",
        type: "regular",
        review_status: "needs_review",
        amount_reporting: 40,
        posted_at: "2026-09-08T00:00:00Z",
      }),
      txn({
        id: "ex",
        type: "regular",
        review_status: "excluded",
        amount_reporting: 25,
        posted_at: "2026-09-09T00:00:00Z",
      }),
      txn({
        id: "pend",
        type: "regular",
        status: "pending",
        amount_reporting: 10,
        posted_at: "2026-09-10T00:00:00Z",
      }),
      txn({
        id: "aug",
        type: "income",
        amount_reporting: 1000,
        posted_at: "2026-08-15T00:00:00Z",
      }),
    ];

    const cf = computeCashFlow({ transactions, year_month: "2026-09" });
    expect(cf.income).toBe(3000);
    expect(cf.spend).toBe(150); // 200 - 50 refund
    expect(cf.net).toBe(2850);
  });

  it("compares vs prior month", () => {
    const transactions = [
      txn({ id: "i1", type: "income", amount_reporting: 2000, posted_at: "2026-09-01T00:00:00Z" }),
      txn({ id: "s1", type: "regular", amount_reporting: 500, posted_at: "2026-09-02T00:00:00Z" }),
      txn({ id: "i0", type: "income", amount_reporting: 1000, posted_at: "2026-08-01T00:00:00Z" }),
      txn({ id: "s0", type: "regular", amount_reporting: 400, posted_at: "2026-08-02T00:00:00Z" }),
    ];
    const cmp = computeCashFlowWithPrior({ transactions, year_month: "2026-09" });
    expect(cmp.prior.year_month).toBe("2026-08");
    expect(cmp.prior.net).toBe(600);
    expect(cmp.net).toBe(1500);
    expect(cmp.net_delta).toBe(900);
  });
});

describe("cashFlowSeries + demo seed", () => {
  it("builds oldest→newest monthly points", () => {
    const demo = seedDemoTransactions({ yearMonth: "2026-09" });
    const asDomain = demo.map((d) =>
      txn({
        id: d.id,
        account_id: d.account_id,
        category_id: d.category_id,
        amount: d.amount,
        amount_account: d.amount_account,
        amount_reporting: d.amount_reporting,
        type: d.type,
        is_refund: d.is_refund === 1,
        review_status: d.review_status,
        posted_at: d.posted_at,
        name: d.name,
        fingerprint: d.fingerprint,
      }),
    );
    const series = cashFlowSeries({
      transactions: asDomain,
      year_month: "2026-09",
      months: 3,
    });
    expect(series.map((s) => s.year_month)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(series[2]!.income).toBeGreaterThan(0);
    expect(series[2]!.spend).toBeGreaterThan(0);
    expect(series[2]!.net).toBe(series[2]!.income - series[2]!.spend);
  });
});

describe("Help Center cash flow ranges", () => {
  it("resolves MTD with same-day prior month comparison", () => {
    const now = new Date(Date.UTC(2026, 6, 24)); // July 24
    const w = resolveCashFlowWindow("mtd", now);
    expect(w.start).toBe("2026-07-01");
    expect(w.end).toBe("2026-07-24");
    expect(w.prior_start).toBe("2026-06-01");
    expect(w.prior_end).toBe("2026-06-24");
  });

  it("resolves YTD and last 4 weeks windows", () => {
    const now = new Date(Date.UTC(2026, 8, 5)); // Sep 5
    const ytd = resolveCashFlowWindow("ytd", now);
    expect(ytd.start).toBe("2026-01-01");
    expect(ytd.end).toBe("2026-09-05");
    expect(ytd.prior_start).toBe("2025-01-01");
    expect(ytd.prior_end).toBe("2025-09-05");

    const w4 = resolveCashFlowWindow("last_4_weeks", now);
    expect(w4.end).toBe("2026-09-05");
    expect(w4.start).toBe("2026-08-09");
  });

  it("includes excluded spend when toggled and breaks down by category", () => {
    const transactions = [
      txn({
        id: "s1",
        type: "regular",
        amount_reporting: 100,
        category_id: "c-food",
        posted_at: "2026-09-02T00:00:00Z",
      }),
      txn({
        id: "ex",
        type: "regular",
        review_status: "excluded",
        amount_reporting: 40,
        category_id: "c-food",
        posted_at: "2026-09-03T00:00:00Z",
      }),
      txn({
        id: "i1",
        type: "income",
        amount_reporting: 1000,
        posted_at: "2026-09-01T00:00:00Z",
      }),
    ];
    const categories = [
      {
        id: "c-food",
        group_id: "g1",
        name: "Food",
        emoji: "🍔",
        color: "#f00",
        exclude_from_budget: false,
        is_income_category: false,
        archived: false,
        sort_order: 0,
      },
    ];
    const off = computeCashFlowRangePayload({
      transactions,
      categories,
      range: "mtd",
      include_excluded: false,
      now: new Date(Date.UTC(2026, 8, 5)),
    });
    expect(off.spend).toBe(100);
    expect(off.excluded_spend).toBe(40);
    expect(off.income).toBe(1000);
    expect(off.spending_by_category[0]?.amount).toBe(100);

    const on = computeCashFlowRangePayload({
      transactions,
      categories,
      range: "mtd",
      include_excluded: true,
      now: new Date(Date.UTC(2026, 8, 5)),
    });
    expect(on.spend).toBe(140);
  });

  it("lists excluded transactions and category rows for View More", () => {
    const transactions = [
      txn({
        id: "s1",
        type: "regular",
        amount_reporting: 100,
        category_id: "c-food",
        posted_at: "2026-09-02T00:00:00Z",
        name: "Groceries",
      }),
      txn({
        id: "ex",
        type: "regular",
        review_status: "excluded",
        amount_reporting: 40,
        category_id: "c-food",
        posted_at: "2026-09-03T00:00:00Z",
        name: "Work lunch",
      }),
    ];
    const categories = [
      {
        id: "c-food",
        group_id: "g1",
        name: "Food",
        emoji: "🍔",
        color: "#f00",
        exclude_from_budget: false,
        is_income_category: false,
        archived: false,
        sort_order: 0,
      },
    ];
    const payload = computeCashFlowRangePayload({
      transactions,
      categories,
      range: "mtd",
      include_excluded: false,
      now: new Date(Date.UTC(2026, 8, 5)),
    });
    expect(payload.excluded_spend).toBe(40);
    expect(payload.excluded_by_category[0]?.amount).toBe(40);
    expect(payload.excluded_transactions).toHaveLength(1);
    expect(payload.excluded_transactions[0]?.name).toBe("Work lunch");
  });
});
