import type { BudgetMonth, Category, CategoryGroup } from "./types.js";
import { priorYearMonth, shiftYearMonth } from "./cashflow.js";

/** Copilot-like seed taxonomy (en); IDs stable for demo sync. */
export const SEED_CATEGORY_GROUPS: CategoryGroup[] = [
  { id: "grp-income", name: "Income", sort_order: 0, is_system: true },
  { id: "grp-living", name: "Living", sort_order: 1, is_system: true },
  { id: "grp-lifestyle", name: "Lifestyle", sort_order: 2, is_system: true },
  { id: "grp-bills", name: "Bills", sort_order: 3, is_system: true },
  { id: "grp-other", name: "Other", sort_order: 4, is_system: true },
];

export const SEED_CATEGORIES: Category[] = [
  {
    id: "cat-salary",
    group_id: "grp-income",
    name: "Salary",
    emoji: "💵",
    color: "#10B981",
    exclude_from_budget: true,
    is_income_category: true,
    archived: false,
    sort_order: 1,
  },
  {
    id: "cat-groceries",
    group_id: "grp-living",
    name: "Groceries",
    emoji: "🛒",
    color: "#34d399",
    exclude_from_budget: false,
    is_income_category: false,
    archived: false,
    sort_order: 1,
  },
  {
    id: "cat-dining",
    group_id: "grp-living",
    name: "Restaurants",
    emoji: "🍽",
    color: "#fbbf24",
    exclude_from_budget: false,
    is_income_category: false,
    archived: false,
    sort_order: 2,
  },
  {
    id: "cat-transport",
    group_id: "grp-living",
    name: "Transportation",
    emoji: "🚗",
    color: "#60a5fa",
    exclude_from_budget: false,
    is_income_category: false,
    archived: false,
    sort_order: 3,
  },
  {
    id: "cat-shopping",
    group_id: "grp-lifestyle",
    name: "Shopping",
    emoji: "🛍",
    color: "#f472b6",
    exclude_from_budget: false,
    is_income_category: false,
    archived: false,
    sort_order: 1,
  },
  {
    id: "cat-entertainment",
    group_id: "grp-lifestyle",
    name: "Entertainment",
    emoji: "🎬",
    color: "#a78bfa",
    exclude_from_budget: false,
    is_income_category: false,
    archived: false,
    sort_order: 2,
  },
  {
    id: "cat-health",
    group_id: "grp-lifestyle",
    name: "Health",
    emoji: "💊",
    color: "#2dd4bf",
    exclude_from_budget: false,
    is_income_category: false,
    archived: false,
    sort_order: 3,
  },
  {
    id: "cat-housing",
    group_id: "grp-bills",
    name: "Housing",
    emoji: "🏠",
    color: "#94a3b8",
    exclude_from_budget: false,
    is_income_category: false,
    archived: false,
    sort_order: 1,
  },
  {
    id: "cat-utilities",
    group_id: "grp-bills",
    name: "Utilities",
    emoji: "💡",
    color: "#fcd34d",
    exclude_from_budget: false,
    is_income_category: false,
    archived: false,
    sort_order: 2,
  },
  {
    id: "cat-interest",
    group_id: "grp-other",
    name: "Interest",
    emoji: "📈",
    color: "#fb7185",
    exclude_from_budget: false,
    is_income_category: false,
    archived: false,
    sort_order: 1,
  },
  {
    id: "cat-work",
    group_id: "grp-other",
    name: "Work Expenses",
    emoji: "💼",
    color: "#64748b",
    exclude_from_budget: true,
    is_income_category: false,
    archived: false,
    sort_order: 2,
  },
];

/** Default demo budgets (USD reporting) keyed by category id. */
export const SEED_BUDGET_AMOUNTS_USD: Record<string, number> = {
  "cat-salary": 0,
  "cat-groceries": 400,
  "cat-dining": 200,
  "cat-transport": 150,
  "cat-shopping": 150,
  "cat-entertainment": 100,
  "cat-health": 80,
  "cat-housing": 1200,
  "cat-utilities": 120,
  "cat-interest": 0,
  "cat-work": 0,
};

export function seedBudgetMonths(yearMonth: string): BudgetMonth[] {
  return SEED_CATEGORIES.map((c) => ({
    category_id: c.id,
    year_month: yearMonth,
    budgeted_amount: SEED_BUDGET_AMOUNTS_USD[c.id] ?? 0,
    rollover_mode: "off" as const,
    rollover_from_prior: 0,
  }));
}

export function currentYearMonth(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export type DemoTxnSeed = {
  id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  amount_account: number;
  amount_reporting: number;
  type: "regular" | "income" | "transfer";
  is_refund: number;
  review_status: "reviewed" | "needs_review" | "excluded";
  posted_at: string;
  name: string;
  note: string | null;
  fingerprint: string;
};

/**
 * Copilot-like demo ledger for web preview (Pages).
 * USD reporting amounts; stable IDs so re-seed is idempotent via INSERT OR IGNORE.
 */
export function seedDemoTransactions(opts?: {
  accountId?: string;
  yearMonth?: string;
}): DemoTxnSeed[] {
  const accountId = opts?.accountId ?? "acc-cash-ars";
  const ym = opts?.yearMonth ?? currentYearMonth();
  const prior = priorYearMonth(ym);
  const prior2 = shiftYearMonth(ym, -2);

  const mk = (
    id: string,
    partial: {
      category_id: string | null;
      amount_reporting: number;
      type: "regular" | "income" | "transfer";
      posted_at: string;
      name: string;
      is_refund?: number;
      review_status?: DemoTxnSeed["review_status"];
    },
  ): DemoTxnSeed => ({
    id,
    account_id: accountId,
    category_id: partial.category_id,
    amount: partial.amount_reporting,
    currency: "USD",
    amount_account: partial.amount_reporting,
    amount_reporting: partial.amount_reporting,
    type: partial.type,
    is_refund: partial.is_refund ?? 0,
    review_status: partial.review_status ?? "reviewed",
    posted_at: partial.posted_at,
    name: partial.name,
    note: null,
    fingerprint: `demo:${id}`,
  });

  const day = (month: string, d: number) =>
    `${month}-${String(d).padStart(2, "0")}T12:00:00.000Z`;

  return [
    // Current month — income + spend across categories
    mk("demo-txn-pay-cur", {
      category_id: "cat-salary",
      amount_reporting: 5200,
      type: "income",
      posted_at: day(ym, 1),
      name: "Paycheck",
    }),
    mk("demo-txn-groc-1", {
      category_id: "cat-groceries",
      amount_reporting: 186,
      type: "regular",
      posted_at: day(ym, 3),
      name: "Whole Foods",
    }),
    mk("demo-txn-groc-2", {
      category_id: "cat-groceries",
      amount_reporting: 94,
      type: "regular",
      posted_at: day(ym, 12),
      name: "Trader Joe's",
    }),
    mk("demo-txn-dine-1", {
      category_id: "cat-dining",
      amount_reporting: 68,
      type: "regular",
      posted_at: day(ym, 5),
      name: "Café Palermo",
    }),
    mk("demo-txn-dine-2", {
      category_id: "cat-dining",
      amount_reporting: 42,
      type: "regular",
      posted_at: day(ym, 18),
      name: "Dinner out",
    }),
    mk("demo-txn-trans-1", {
      category_id: "cat-transport",
      amount_reporting: 55,
      type: "regular",
      posted_at: day(ym, 7),
      name: "Uber",
    }),
    mk("demo-txn-shop-1", {
      category_id: "cat-shopping",
      amount_reporting: 120,
      type: "regular",
      posted_at: day(ym, 9),
      name: "Fake Hardware",
    }),
    mk("demo-txn-ent-1", {
      category_id: "cat-entertainment",
      amount_reporting: 45,
      type: "regular",
      posted_at: day(ym, 10),
      name: "Netflix",
    }),
    mk("demo-txn-health-1", {
      category_id: "cat-health",
      amount_reporting: 32,
      type: "regular",
      posted_at: day(ym, 14),
      name: "Pharmacy",
    }),
    mk("demo-txn-house-1", {
      category_id: "cat-housing",
      amount_reporting: 1200,
      type: "regular",
      posted_at: day(ym, 2),
      name: "Rent",
    }),
    mk("demo-txn-util-1", {
      category_id: "cat-utilities",
      amount_reporting: 98,
      type: "regular",
      posted_at: day(ym, 8),
      name: "Electric",
    }),
    // Prior month
    mk("demo-txn-pay-prior", {
      category_id: "cat-salary",
      amount_reporting: 5100,
      type: "income",
      posted_at: day(prior, 1),
      name: "Paycheck",
    }),
    mk("demo-txn-groc-p1", {
      category_id: "cat-groceries",
      amount_reporting: 210,
      type: "regular",
      posted_at: day(prior, 6),
      name: "Whole Foods",
    }),
    mk("demo-txn-dine-p1", {
      category_id: "cat-dining",
      amount_reporting: 88,
      type: "regular",
      posted_at: day(prior, 11),
      name: "Restaurants",
    }),
    mk("demo-txn-house-p1", {
      category_id: "cat-housing",
      amount_reporting: 1200,
      type: "regular",
      posted_at: day(prior, 2),
      name: "Rent",
    }),
    mk("demo-txn-util-p1", {
      category_id: "cat-utilities",
      amount_reporting: 110,
      type: "regular",
      posted_at: day(prior, 9),
      name: "Electric",
    }),
    mk("demo-txn-ent-p1", {
      category_id: "cat-entertainment",
      amount_reporting: 60,
      type: "regular",
      posted_at: day(prior, 15),
      name: "Concert",
    }),
    mk("demo-txn-shop-p1", {
      category_id: "cat-shopping",
      amount_reporting: 75,
      type: "regular",
      posted_at: day(prior, 20),
      name: "Amazon",
    }),
    // Two months ago (for chart density)
    mk("demo-txn-pay-p2", {
      category_id: "cat-salary",
      amount_reporting: 5000,
      type: "income",
      posted_at: day(prior2, 1),
      name: "Paycheck",
    }),
    mk("demo-txn-spend-p2a", {
      category_id: "cat-groceries",
      amount_reporting: 240,
      type: "regular",
      posted_at: day(prior2, 8),
      name: "Groceries",
    }),
    mk("demo-txn-spend-p2b", {
      category_id: "cat-housing",
      amount_reporting: 1200,
      type: "regular",
      posted_at: day(prior2, 2),
      name: "Rent",
    }),
    mk("demo-txn-spend-p2c", {
      category_id: "cat-dining",
      amount_reporting: 150,
      type: "regular",
      posted_at: day(prior2, 16),
      name: "Dining",
    }),
    mk("demo-txn-spend-p2d", {
      category_id: "cat-utilities",
      amount_reporting: 105,
      type: "regular",
      posted_at: day(prior2, 10),
      name: "Utilities",
    }),
  ];
}
