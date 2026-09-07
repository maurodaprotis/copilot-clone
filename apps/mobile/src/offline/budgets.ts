import {
  buildCategoryBudgetRows,
  budgetPaceByDay,
  cumulativeSpendByDay,
  currentYearMonth,
  shiftYearMonth,
  normalizeReviewStatus,
  totalEffectiveBudget,
  type BudgetMonth,
  type Category,
  type CategoryGroup,
  type Transaction,
} from "@copilot-clone/domain";
import { isWebRuntime } from "../db/runtime";
import type { LocalDb } from "../db/types";
import type { LocalTransaction } from "./queries";
import { webSyncOrEnqueue } from "./webSyncWrite";

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
  const transactions = txnRows.filter((r) => !(r as { deleted_at?: string | null }).deleted_at).map(toDomainTxn);
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
  const transactions = txnRows.filter((r) => !(r as { deleted_at?: string | null }).deleted_at).map(toDomainTxn);
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

/** Year-months for Copilot "all months" budget edit (±12 around center). */
export function monthsForBudgetScope(
  centerYearMonth: string,
  scope: "month" | "all_months",
): string[] {
  if (scope === "month") return [centerYearMonth];
  const out: string[] = [];
  for (let i = -12; i <= 12; i++) {
    out.push(shiftYearMonth(centerYearMonth, i));
  }
  return out;
}

async function setBudgetViaApi(
  input: {
    category_id: string;
    year_month: string;
    budgeted_amount: number;
    rollover_mode?: string;
    rollover_from_prior?: number;
    /** Copilot: apply same amount to many months ("all months"). */
    apply_to?: "month" | "all_months";
  },
  options?: {
    apiUrl?: string;
    userId?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<{ outboxId: string; queued?: boolean }> {
  const now = new Date().toISOString();
  const mode = input.rollover_mode ?? "off";
  const rollover = input.rollover_from_prior ?? 0;
  const scope = input.apply_to ?? "month";
  const months = monthsForBudgetScope(input.year_month, scope);

  const mkPayload = (ym: string) => ({
    op: "budget_upsert" as const,
    category_id: input.category_id,
    year_month: ym,
    budgeted_amount: input.budgeted_amount,
    rollover_mode: mode,
    rollover_from_prior: rollover,
    updated_at: now,
  });

  // Single month: keep webSyncOrEnqueue (existing outbox id + tests).
  if (months.length === 1) {
    const ym = months[0]!;
    return webSyncOrEnqueue({
      payload: mkPayload(ym),
      entity_type: "budget",
      entity_id: `${input.category_id}:${ym}`,
      apiUrl: options?.apiUrl,
      userId: options?.userId,
      fetchImpl: options?.fetchImpl,
    });
  }

  // All months: one batched POST /sync; enqueue each on failure.
  const { postSyncItems } = await import("./webSyncWrite");
  const { enqueueWebOutbox } = await import("./webOutbox");
  const payloads = months.map(mkPayload);
  try {
    const result = await postSyncItems(payloads, {
      apiUrl: options?.apiUrl,
      userId: options?.userId,
      fetchImpl: options?.fetchImpl,
    });
    if (result.ok) {
      return {
        outboxId: `web-api:${input.category_id}:all_months`,
        queued: false,
      };
    }
  } catch {
    // network — enqueue below
  }
  for (const payload of payloads) {
    enqueueWebOutbox({
      entity_type: "budget",
      entity_id: `${payload.category_id}:${payload.year_month}`,
      payload,
    });
  }
  return {
    outboxId: `web-queued:${input.category_id}:all_months`,
    queued: true,
  };
}

/**
 * Edit budget for a category/month.
 * - Web / Pages: POST budget_upsert to Worker; on fail queue web outbox (never expo-sqlite).
 * - Native: local SQLite + outbox enqueue.
 */
export async function setBudgetAmount(
  input: {
    category_id: string;
    year_month: string;
    budgeted_amount: number;
    rollover_mode?: string;
    rollover_from_prior?: number;
    /** Copilot budget edit: this month vs all months. */
    apply_to?: "month" | "all_months";
  },
  dbOverride?: LocalDb,
): Promise<{ outboxId: string }> {
  // Pages / web: never touch expo-sqlite — push budget_upsert straight to Worker.
  if (!dbOverride && isWebRuntime()) {
    return setBudgetViaApi(input);
  }

  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const now = new Date().toISOString();
  const outboxId = crypto.randomUUID();
  const mode = input.rollover_mode ?? "off";
  const rollover = input.rollover_from_prior ?? 0;
  const months = monthsForBudgetScope(
    input.year_month,
    input.apply_to ?? "month",
  );

  await db.withTransactionAsync(async () => {
    for (const ym of months) {
      await db.runAsync(
        `INSERT INTO budget_months (
          category_id, year_month, budgeted_amount, rollover_mode, rollover_from_prior
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(category_id, year_month) DO UPDATE SET
          budgeted_amount = excluded.budgeted_amount,
          rollover_mode = excluded.rollover_mode,
          rollover_from_prior = excluded.rollover_from_prior`,
        input.category_id,
        ym,
        input.budgeted_amount,
        mode,
        rollover,
      );

      const payload = JSON.stringify({
        op: "budget_upsert",
        category_id: input.category_id,
        year_month: ym,
        budgeted_amount: input.budgeted_amount,
        rollover_mode: mode,
        rollover_from_prior: rollover,
        updated_at: now,
      });

      await db.runAsync(
        `INSERT INTO outbox (id, entity_type, entity_id, payload, created_at, attempts, last_error)
         VALUES (?, 'budget', ?, ?, ?, 0, NULL)`,
        crypto.randomUUID(),
        `${input.category_id}:${ym}`,
        payload,
        now,
      );
    }
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
  // Web list/edit already use the Worker API; skip local mirror.
  if (!dbOverride && isWebRuntime()) return;

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

/** Test/helper export: direct API upsert (used by smoke tests). */
export const __test = {
  setBudgetViaApi,
};

