import { describe, expect, it } from "vitest";
import {
  applyNameRuleHistorically,
  applyNameRuleToTransaction,
  assertBalancedSplit,
  ClientError,
  computeCategorySpent,
  equalSplitAmounts,
  hitsBudget,
  isBalancedSplit,
  nameRuleMatches,
  normalizeNamePattern,
  resolveNameRule,
  splitBudgetContributions,
  tagsForTransaction,
  withTagAssigned,
  withTagRemoved,
  type Category,
  type NameRule,
  type SplitLeg,
  type Tag,
  type Transaction,
  type TransactionTag,
} from "../src/index.js";

function txn(partial: Partial<Transaction> = {}): Transaction {
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
    posted_at: "2026-09-04T12:00:00.000Z",
    name: "Starbucks Downtown",
    note: null,
    transfer_pair_id: null,
    fingerprint: null,
    ...partial,
  };
}

const dining: Category = {
  id: "cat-dining",
  group_id: "g",
  name: "Dining",
  emoji: "🍽",
  color: "#fbbf24",
  exclude_from_budget: false,
  is_income_category: false,
  archived: false,
  sort_order: 1,
};

const groceries: Category = {
  ...dining,
  id: "cat-groceries",
  name: "Groceries",
};

describe("Name Rules", () => {
  it("normalizes whitespace/case", () => {
    expect(normalizeNamePattern("  Star  Bucks ")).toBe("star bucks");
  });

  it("exact and contains match", () => {
    expect(
      nameRuleMatches({ match_type: "exact", pattern: "Starbucks Downtown" }, "starbucks downtown"),
    ).toBe(true);
    expect(
      nameRuleMatches({ match_type: "exact", pattern: "Starbucks" }, "Starbucks Downtown"),
    ).toBe(false);
    expect(
      nameRuleMatches({ match_type: "contains", pattern: "starbucks" }, "Cafe Starbucks #12"),
    ).toBe(true);
  });

  it("last-write-wins among matches", () => {
    const rules: NameRule[] = [
      {
        id: "r1",
        match_type: "contains",
        pattern: "starbucks",
        category_id: "cat-old",
        apply_historically: true,
        updated_at: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "r2",
        match_type: "contains",
        pattern: "star",
        category_id: "cat-dining",
        apply_historically: true,
        updated_at: "2026-09-04T00:00:00.000Z",
      },
    ];
    expect(resolveNameRule(rules, "Starbucks Downtown")?.category_id).toBe(
      "cat-dining",
    );
    const applied = applyNameRuleToTransaction(txn(), rules);
    expect(applied.category_id).toBe("cat-dining");
    expect(applied.review_status).toBe("reviewed");
  });

  it("apply historically stubs by default", () => {
    const rule: NameRule = {
      id: "r1",
      match_type: "contains",
      pattern: "starbucks",
      category_id: "cat-dining",
      apply_historically: true,
      updated_at: "2026-09-04T00:00:00.000Z",
    };
    expect(applyNameRuleHistorically({ rule, transactions: [txn()] })).toEqual({
      applied: 0,
      stub: true,
      matched_ids: [],
    });
    const real = applyNameRuleHistorically({
      rule,
      transactions: [txn(), txn({ id: "t2", name: "Other" })],
      apply: true,
    });
    expect(real.stub).toBe(false);
    expect(real.matched_ids).toEqual(["t1"]);
  });
});

describe("Tags", () => {
  it("assign/remove and list without budget impact", () => {
    const tags: Tag[] = [
      { id: "tag-biz", name: "Business", color: "#3366ff" },
      { id: "tag-tax", name: "Tax", color: "#cc0000" },
    ];
    let links: TransactionTag[] = [];
    links = withTagAssigned(links, "t1", "tag-biz");
    links = withTagAssigned(links, "t1", "tag-tax");
    links = withTagAssigned(links, "t1", "tag-biz");
    expect(tagsForTransaction("t1", links, tags).map((t) => t.id).sort()).toEqual([
      "tag-biz",
      "tag-tax",
    ]);
    links = withTagRemoved(links, "t1", "tag-tax");
    expect(tagsForTransaction("t1", links, tags).map((t) => t.id)).toEqual([
      "tag-biz",
    ]);
    expect(hitsBudget(txn({ category_id: "cat-dining" }), dining)).toBe(true);
  });
});

describe("Splits", () => {
  it("rejects unbalanced and accepts balanced", () => {
    expect(isBalancedSplit(100, [{ amount: 40 }, { amount: 50 }])).toBe(false);
    expect(isBalancedSplit(100, [{ amount: 40 }, { amount: 60 }])).toBe(true);
    expect(() => assertBalancedSplit(100, [{ amount: 1 }])).toThrow(/Unbalanced/);
    try {
      assertBalancedSplit(100, [{ amount: 40 }, { amount: 50 }]);
      expect.unreachable("expected unbalanced_split ClientError");
    } catch (err) {
      expect(err).toBeInstanceOf(ClientError);
      const ce = err as ClientError;
      expect(ce.code).toBe("unbalanced_split");
      expect(ce.status).toBe(400);
      expect(ce.toJSON()).toEqual({
        error: "unbalanced_split",
        message: ce.message,
      });
      expect(ce.message).toMatch(/Unbalanced split/);
    }
    expect(equalSplitAmounts(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it("budgets use legs not parent; needs_review parent contributes 0", () => {
    const parent = txn({
      id: "tp",
      category_id: "cat-dining",
      is_split_parent: true,
      amount: 100,
      amount_reporting: 100,
      review_status: "reviewed",
    });
    const legs: SplitLeg[] = [
      {
        id: "l1",
        transaction_id: "tp",
        category_id: "cat-dining",
        amount: 40,
        year_month_override: null,
      },
      {
        id: "l2",
        transaction_id: "tp",
        category_id: "cat-groceries",
        amount: 60,
        year_month_override: null,
      },
    ];
    expect(hitsBudget(parent, dining)).toBe(false);
    const contrib = splitBudgetContributions({
      parent,
      legs,
      categories: [dining, groceries],
    });
    expect(contrib).toEqual([
      { category_id: "cat-dining", year_month: "2026-09", amount_reporting: 40 },
      {
        category_id: "cat-groceries",
        year_month: "2026-09",
        amount_reporting: 60,
      },
    ]);
    expect(
      computeCategorySpent({
        transactions: [parent],
        category_id: "cat-dining",
        year_month: "2026-09",
        category: dining,
        split_legs: legs,
        categories: [dining, groceries],
      }),
    ).toBe(40);
    expect(
      computeCategorySpent({
        transactions: [parent],
        category_id: "cat-groceries",
        year_month: "2026-09",
        category: groceries,
        split_legs: legs,
        categories: [dining, groceries],
      }),
    ).toBe(60);

    const inbox = { ...parent, review_status: "needs_review" as const };
    expect(
      splitBudgetContributions({ parent: inbox, legs, categories: [dining] }),
    ).toEqual([]);
  });
});
