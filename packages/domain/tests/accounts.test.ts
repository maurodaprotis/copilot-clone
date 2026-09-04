import { describe, expect, it } from "vitest";
import {
  buildAccountBalanceRows,
  computeAccountBalance,
  netWorthContributionAccountCcy,
  type Account,
  type RateBook,
  type Transaction,
} from "../src/index.js";

function account(partial: Partial<Account>): Account {
  return {
    id: "a1",
    name: "Cash",
    currency: "USD",
    type: "cash",
    is_archived: false,
    include_in_net_worth: true,
    current_balance: 0,
    ...partial,
  };
}

function txn(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    account_id: "a1",
    category_id: null,
    amount: 100,
    currency: "USD",
    amount_account: 100,
    amount_reporting: 100,
    type: "regular",
    is_refund: false,
    review_status: "reviewed",
    status: "posted",
    posted_at: "2026-09-01T00:00:00Z",
    note: null,
    transfer_pair_id: null,
    fingerprint: null,
    ...partial,
  };
}

describe("account balances + NW", () => {
  it("adds opening balance and signed txns", () => {
    const a = account({ current_balance: 1000 });
    const balance = computeAccountBalance(a, [
      txn({ type: "regular", amount_account: 200 }),
      txn({ type: "income", amount_account: 50 }),
      txn({ review_status: "needs_review", amount_account: 999 }),
    ]);
    // 1000 - 200 + 50
    expect(balance).toBe(850);
  });

  it("credit balances reduce NW", () => {
    expect(
      netWorthContributionAccountCcy(account({ type: "credit" }), 500),
    ).toBe(-500);
    expect(
      netWorthContributionAccountCcy(
        account({ include_in_net_worth: false }),
        500,
      ),
    ).toBe(0);
  });

  it("builds reporting NW with FX", () => {
    const book: RateBook = { "USD:ARS:2026-09-01": 1400 };
    // Invert: ARS→USD = 1/1400
    const cash = account({
      id: "cash",
      name: "Cash ARS",
      currency: "ARS",
      type: "cash",
      current_balance: 140_000,
    });
    const card = account({
      id: "cc",
      name: "Visa",
      currency: "USD",
      type: "credit",
      current_balance: 50,
    });
    const { rows, net_worth_reporting } = buildAccountBalanceRows({
      accounts: [cash, card],
      transactions: [],
      reporting_currency: "USD",
      on_date: "2026-09-01",
      rate_book: book,
    });
    expect(rows).toHaveLength(2);
    // 140000 ARS / 1400 = 100 USD; credit -50
    expect(net_worth_reporting).toBeCloseTo(50, 5);
  });
});
