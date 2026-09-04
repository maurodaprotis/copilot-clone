import type { BudgetMonth, Category, CategoryGroup } from "./types.js";

/** Copilot-like seed taxonomy (en); IDs stable for demo sync. */
export const SEED_CATEGORY_GROUPS: CategoryGroup[] = [
  { id: "grp-living", name: "Living", sort_order: 1, is_system: true },
  { id: "grp-lifestyle", name: "Lifestyle", sort_order: 2, is_system: true },
  { id: "grp-bills", name: "Bills", sort_order: 3, is_system: true },
  { id: "grp-other", name: "Other", sort_order: 4, is_system: true },
];

export const SEED_CATEGORIES: Category[] = [
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
