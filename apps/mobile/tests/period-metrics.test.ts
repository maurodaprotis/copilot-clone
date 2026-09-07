import { describe, expect, it } from "vitest";
import {
  dedupeTransactionsById,
  reportingAmountForMetrics,
  sumPeriodMetrics,
} from "../src/offline/periodMetrics";
import { __test } from "../src/offline/queries";

function txn(partial: Record<string, unknown>) {
  return {
    id: "t1",
    amount: 10,
    amount_reporting: 10,
    currency: "USD",
    type: "regular",
    is_refund: 0,
    review_status: "reviewed",
    ...partial,
  };
}

describe("period metrics dedupe + reporting-only", () => {
  it("counts each txn id once (duplicate rows do not double)", () => {
    const rows = [
      txn({ id: "a", amount_reporting: 10, type: "regular" }),
      txn({ id: "a", amount_reporting: 10, type: "regular" }),
      txn({ id: "b", amount_reporting: 10, type: "income" }),
      txn({ id: "b", amount_reporting: 10, type: "income" }),
    ];
    const m = sumPeriodMetrics(rows as any, "USD");
    expect(m.spent).toBe(10);
    expect(m.income).toBe(10);
    expect(m.net).toBe(0);
  });

  it("never sums amount + amount_reporting", () => {
    const rows = [
      txn({
        id: "x",
        amount: 14000,
        amount_reporting: 10,
        currency: "ARS",
        type: "regular",
      }),
    ];
    expect(reportingAmountForMetrics(rows[0] as any, "USD")).toBe(10);
    expect(sumPeriodMetrics(rows as any, "USD").spent).toBe(10);
  });

  it("excludes soft-deleted and excluded", () => {
    const rows = [
      txn({ id: "live", amount_reporting: 10 }),
      txn({ id: "gone", amount_reporting: 99, deleted_at: "2026-09-06T00:00:00Z" }),
      txn({ id: "ex", amount_reporting: 50, review_status: "excluded" }),
    ];
    expect(sumPeriodMetrics(rows as any, "USD").spent).toBe(10);
  });

  it("mapApiTxn drops soft-deleted and keeps amount_reporting only", () => {
    expect(
      __test.mapApiTxn({
        id: "d",
        account_id: "acc",
        amount: 10,
        amount_reporting: 10,
        currency: "USD",
        deleted_at: "2026-09-06T00:00:00Z",
      }),
    ).toBeNull();
    const mapped = __test.mapApiTxn({
      id: "t1",
      account_id: "acc-cash-ars",
      amount: 14000,
      currency: "ARS",
      amount_account: 14000,
      amount_reporting: 10,
      type: "regular",
      review_status: "reviewed",
      posted_at: "2026-09-06T12:00:00.000Z",
    });
    expect(mapped!.amount_reporting).toBe(10);
    expect(mapped!.amount).toBe(14000);
  });

  it("dedupeTransactionsById keeps first occurrence", () => {
    const out = dedupeTransactionsById([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "a", n: 3 },
    ]);
    expect(out).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ]);
  });
});
