import {
  SEED_CATEGORIES,
  SEED_CATEGORY_GROUPS,
  seedBudgetMonths,
  currentYearMonth,
} from "@copilot-clone/domain";

/** Parameterized seed rows for client / DO insert loops. */
export function seedCategoryGroupRows() {
  return SEED_CATEGORY_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    sort_order: g.sort_order,
    is_system: g.is_system ? 1 : 0,
  }));
}

export function seedCategoryRows() {
  return SEED_CATEGORIES.map((c) => ({
    id: c.id,
    group_id: c.group_id,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
    exclude_from_budget: c.exclude_from_budget ? 1 : 0,
    is_income_category: c.is_income_category ? 1 : 0,
    archived: c.archived ? 1 : 0,
    sort_order: c.sort_order,
  }));
}

export function seedBudgetRows(yearMonth = currentYearMonth()) {
  return seedBudgetMonths(yearMonth).map((b) => ({
    category_id: b.category_id,
    year_month: b.year_month,
    budgeted_amount: b.budgeted_amount,
    rollover_mode: b.rollover_mode,
    rollover_from_prior: b.rollover_from_prior,
  }));
}
