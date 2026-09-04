import {
  buildCategoryBudgetRows,
  budgetPaceByDay,
  cumulativeSpendByDay,
  currentYearMonth,
  normalizeReviewStatus,
  totalEffectiveBudget,
  type BudgetMonth,
  type Category,
  type CategoryGroup,
  type Transaction,
} from "@copilot-clone/domain";
import type { LocalDb } from "../db/types";
import type { LocalTransaction } from "./queries";

function toDomainTxn(row: LocalTransaction): Transaction {
  return {
    id: row.id,
    account_id: row.account_id,
    category_id: row.category_id,
    amount: row.amount,
    currency: row.currency,
    amount_account: row.amount_account,
    amount_reporting: row.amount_reporting,
    type: row.type as Transaction["type"],
    is_refund: row.is_refund === 1,
    review_status: normalizeReviewStatus(row.review_status),
    status: "posted",
    posted_at: row.posted_at,
    note: row.note,
    transfer_pair_id: null,
    fingerprint: row.fingerprint,
  };
}

export async function listCategoryGroups(
  dbOverride?: LocalDb,
): Promise<CategoryGroup[]> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    sort_order: number;
    is_system: number;
  }>("SELECT * FROM category_groups ORDER BY sort_order ASC");
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sort_order: r.sort_order,
    is_system: r.is_system === 1,
  }));
}

export async function listCategories(dbOverride?: LocalDb): Promise<Category[]> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<{
    id: string;
    group_id: string;
    name: string;
    emoji: string;
    color: string;
    exclude_from_budget: number;
    is_income_category: number;
    archived: number;
    sort_order: number;
  }>("SELECT * FROM categories ORDER BY sort_order ASC");
  return rows.map((r) => ({
    id: r.id,
    group_id: r.group_id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    exclude_from_budget: r.exclude_from_budget === 1,
    is_income_category: r.is_income_category === 1,
    archived: r.archived === 1,
    sort_order: r.sort_order,
  }));
}

export async function listBudgetMonths(
  yearMonth: string,
  dbOverride?: LocalDb,
): Promise<BudgetMonth[]> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<{
    category_id: string;
    year_month: string;
    budgeted_amount: number;
    rollover_mode: string;
    rollover_from_prior: number;
  }>("SELECT * FROM budget_months WHERE year_month = ?", yearMonth);
  return rows.map((r) => ({
    category_id: r.category_id,
    year_month: r.year_month,
    budgeted_amount: r.budgeted_amount,
    rollover_mode: (r.rollover_mode || "off") as BudgetMonth["rollover_mode"],
    rollover_from_prior: r.rollover_from_prior,
  }));
}

export async function getCategoryBudgetOverview(
  yearMonth = currentYearMonth(),
  dbOverride?: LocalDb,
) {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const [groups, categories, budgets, txnRows] = await Promise.all([
    listCategoryGroups(db),
    listCategories(db),
    listBudgetMonths(yearMonth, db),
    db.getAllAsync<LocalTransaction>("SELECT * FROM transactions"),
  ]);
  const transactions = txnRows.map(toDomainTxn);
  const rows = buildCategoryBudgetRows({
    categories,
    budgets,
    transactions,
    year_month: yearMonth,
  });
  return {
    year_month: yearMonth,
    reporting_currency: "USD",
    groups,
    rows,
    totals: {
      budgeted: totalEffectiveBudget(rows),
      spent: rows
        .filter((r) => !r.category.exclude_from_budget)
        .reduce((s, r) => s + r.spent, 0),
      remaining: rows
        .filter((r) => !r.category.exclude_from_budget)
        .reduce((s, r) => s + r.remaining, 0),
    },
  };
}

export async function getSpendingLine(
  yearMonth = currentYearMonth(),
  dbOverride?: LocalDb,
) {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const overview = await getCategoryBudgetOverview(yearMonth, db);
  const txnRows = await db.getAllAsync<LocalTransaction>(
    "SELECT * FROM transactions",
  );
  const transactions = txnRows.map(toDomainTxn);
  const categories = overview.rows.map((r) => r.category);
  const cumulative = cumulativeSpendByDay({
    transactions,
    year_month: yearMonth,
    categories,
  });
  const pace = budgetPaceByDay(overview.totals.budgeted, yearMonth);
  return {
    year_month: yearMonth,
    reporting_currency: "USD",
    total_budget: overview.totals.budgeted,
    cumulative_spend: cumulative,
    budget_pace: pace,
    spent_mtd: cumulative[cumulative.length - 1] ?? 0,
  };
}

/**
 * Edit budget for a category/month locally and enqueue UserDO sync.
 */
export async function setBudgetAmount(
  input: {
    category_id: string;
    year_month: string;
    budgeted_amount: number;
    rollover_mode?: string;
    rollover_from_prior?: number;
  },
  dbOverride?: LocalDb,
): Promise<{ outboxId: string }> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const now = new Date().toISOString();
  const outboxId = crypto.randomUUID();
  const mode = input.rollover_mode ?? "off";
  const rollover = input.rollover_from_prior ?? 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO budget_months (
        category_id, year_month, budgeted_amount, rollover_mode, rollover_from_prior
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(category_id, year_month) DO UPDATE SET
        budgeted_amount = excluded.budgeted_amount,
        rollover_mode = excluded.rollover_mode,
        rollover_from_prior = excluded.rollover_from_prior`,
      input.category_id,
      input.year_month,
      input.budgeted_amount,
      mode,
      rollover,
    );

    const payload = JSON.stringify({
      op: "budget_upsert",
      category_id: input.category_id,
      year_month: input.year_month,
      budgeted_amount: input.budgeted_amount,
      rollover_mode: mode,
      rollover_from_prior: rollover,
      updated_at: now,
    });

    await db.runAsync(
      `INSERT INTO outbox (id, entity_type, entity_id, payload, created_at, attempts, last_error)
       VALUES (?, 'budget', ?, ?, ?, 0, NULL)`,
      outboxId,
      `${input.category_id}:${input.year_month}`,
      payload,
      now,
    );
  });

  return { outboxId };
}

/**
 * Apply authoritative categories/budgets snapshot from UserDO (pull after sync).
 */
export async function applyRemoteCategoriesSnapshot(
  snapshot: {
    groups: CategoryGroup[];
    categories: Category[];
    budgets: BudgetMonth[];
  },
  dbOverride?: LocalDb,
): Promise<void> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  await db.withTransactionAsync(async () => {
    for (const g of snapshot.groups) {
      await db.runAsync(
        `INSERT OR REPLACE INTO category_groups (id, name, sort_order, is_system)
         VALUES (?, ?, ?, ?)`,
        g.id,
        g.name,
        g.sort_order,
        g.is_system ? 1 : 0,
      );
    }
    for (const c of snapshot.categories) {
      await db.runAsync(
        `INSERT OR REPLACE INTO categories (
          id, group_id, name, emoji, color,
          exclude_from_budget, is_income_category, archived, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id,
        c.group_id,
        c.name,
        c.emoji,
        c.color,
        c.exclude_from_budget ? 1 : 0,
        c.is_income_category ? 1 : 0,
        c.archived ? 1 : 0,
        c.sort_order,
      );
    }
    for (const b of snapshot.budgets) {
      await db.runAsync(
        `INSERT OR REPLACE INTO budget_months (
          category_id, year_month, budgeted_amount, rollover_mode, rollover_from_prior
        ) VALUES (?, ?, ?, ?, ?)`,
        b.category_id,
        b.year_month,
        b.budgeted_amount,
        b.rollover_mode,
        b.rollover_from_prior,
      );
    }
  });
}
