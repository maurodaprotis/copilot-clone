import { describe, expect, it } from "vitest";
import {
  advanceNextExpectedDate,
  amountWithinTolerance,
  matchReviewedTxnToRecurring,
  recurringNameMatches,
  rollForwardAfterMatch,
  upcomingRecurrings,
  type Recurring,
  type Transaction,
} from "../src/index.js";

function txn(partial: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    account_id: "acc-1",
    category_id: "cat-utilities",
    amount: 50,
    currency: "USD",
    amount_account: 50,
    amount_reporting: 50,
    type: "regular",
    is_refund: false,
    review_status: "reviewed",
    status: "posted",
    posted_at: "2026-09-04T12:00:00.000Z",
    name: "Netflix",
    note: null,
    transfer_pair_id: null,
    fingerprint: null,
    ...partial,
  };
}

function rec(partial: Partial<Recurring> = {}): Recurring {
  return {
    id: "r1",
    name: "Netflix",
    kind: "expense",
    cadence: "monthly",
    expected_amount: 50,
    currency: "USD",
    category_id: "cat-utilities",
    account_id: "acc-1",
    next_expected_date: "2026-09-05",
    active: true,
    updated_at: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

describe("recurrings cadence", () => {
  it("advances monthly / weekly / yearly", () => {
    expect(advanceNextExpectedDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(advanceNextExpectedDate("2026-09-04", "weekly")).toBe("2026-09-11");
    expect(advanceNextExpectedDate("2026-09-04", "yearly")).toBe("2027-09-04");
  });

  it("rolls forward after match past txn day", () => {
    expect(
      rollForwardAfterMatch(
        { next_expected_date: "2026-09-01", cadence: "monthly" },
        "2026-09-04T12:00:00.000Z",
      ),
    ).toBe("2026-10-04");
  });
});

describe("recurrings matching", () => {
  it("matches name + amount within tolerance", () => {
    expect(recurringNameMatches("Netflix Subscription", "NETFLIX")).toBe(true);
    expect(amountWithinTolerance(50, 51)).toBe(true);
    const m = matchReviewedTxnToRecurring(txn({ amount: 51, name: "Netflix #1" }), [
      rec(),
      rec({ id: "r2", name: "Spotify", expected_amount: 10 }),
    ]);
    expect(m?.recurring.id).toBe("r1");
  });

  it("ignores needs_review and inactive", () => {
    expect(
      matchReviewedTxnToRecurring(txn({ review_status: "needs_review" }), [rec()]),
    ).toBeNull();
    expect(
      matchReviewedTxnToRecurring(txn(), [rec({ active: false })]),
    ).toBeNull();
  });
});

describe("upcoming bills", () => {
  it("filters active within N days by next_expected_date", () => {
    const list = upcomingRecurrings(
      [
        rec({ id: "soon", next_expected_date: "2026-09-10" }),
        rec({ id: "far", next_expected_date: "2026-10-20" }),
        rec({ id: "past", next_expected_date: "2026-08-01" }),
        rec({ id: "off", next_expected_date: "2026-09-08", active: false }),
      ],
      { within_days: 14, as_of: "2026-09-04" },
    );
    expect(list.map((r) => r.id)).toEqual(["soon"]);
  });
});
