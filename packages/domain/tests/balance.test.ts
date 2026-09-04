import { describe, expect, it } from "vitest";
import {
  appliesToBalance,
  hitsBudget,
  signedAmountAccount,
  transactionFingerprint,
  type Transaction,
} from "../src/index.js";

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    account_id: "a1",
    category_id: "c1",
    amount: 100,
    currency: "ARS",
    amount_account: 100,
    amount_reporting: 0.07,
    type: "regular",
    is_refund: false,
    review_status: "reviewed",
    status: "posted",
    posted_at: "2026-09-01T12:00:00.000Z",
    note: null,
    transfer_pair_id: null,
    fingerprint: null,
    ...partial,
  };
}

describe("balance and budget rules", () => {
  it("needs_review does not apply to balance", () => {
    expect(appliesToBalance(txn({ review_status: "needs_review" }))).toBe(false);
    expect(
      appliesToBalance(txn({ review_status: "pending" as "needs_review" })),
    ).toBe(false);
    expect(appliesToBalance(txn({ review_status: "reviewed" }))).toBe(true);
    expect(
      appliesToBalance(txn({ review_status: "reviewed", status: "pending" })),
    ).toBe(false);
  });

  it("regular non-excluded hits budgets", () => {
    expect(hitsBudget(txn({ type: "regular", review_status: "reviewed" }))).toBe(
      true,
    );
    expect(hitsBudget(txn({ type: "regular", review_status: "excluded" }))).toBe(
      false,
    );
    expect(hitsBudget(txn({ type: "income", review_status: "reviewed" }))).toBe(
      false,
    );
  });

  it("needs_review does not hit budgets", () => {
    expect(hitsBudget(txn({ review_status: "needs_review" }))).toBe(false);
    expect(
      hitsBudget(txn({ status: "pending", review_status: "reviewed" })),
    ).toBe(false);
  });

  it("signed amounts", () => {
    expect(signedAmountAccount(txn({ type: "regular", is_refund: false }))).toBe(
      -100,
    );
    expect(signedAmountAccount(txn({ type: "regular", is_refund: true }))).toBe(
      100,
    );
    expect(signedAmountAccount(txn({ type: "income" }))).toBe(100);
  });
});

describe("fingerprint", () => {
  it("is stable for same semantic fields", () => {
    const a = transactionFingerprint({
      account_id: "a1",
      amount: 50,
      currency: "usd",
      type: "regular",
      posted_at: "2026-09-01T15:00:00Z",
      note: " Cafe ",
    });
    const b = transactionFingerprint({
      account_id: "a1",
      amount: 50,
      currency: "USD",
      type: "regular",
      posted_at: "2026-09-01T99:00:00Z",
      note: "cafe",
    });
    expect(a).toBe(b);
  });
});
