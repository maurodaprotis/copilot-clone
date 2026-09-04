import { describe, expect, it } from "vitest";
import {
  SEED_CATEGORIES,
  SEED_CATEGORY_GROUPS,
  seedBudgetMonths,
} from "@copilot-clone/domain";
import { createMemoryDb } from "../src/db/memory";
import { addExpenseOffline } from "../src/offline/addExpenseOffline";
import {
  getCategoryBudgetOverview,
  setBudgetAmount,
} from "../src/offline/budgets";
import { reviewTransaction } from "../src/offline/reviewTransaction";
import { syncOutbox } from "../src/offline/syncOutbox";

async function seedCats(db: ReturnType<typeof createMemoryDb>, ym: string) {
  for (const g of SEED_CATEGORY_GROUPS) {
    await db.runAsync(
      `INSERT OR IGNORE INTO category_groups (id, name, sort_order, is_system)
       VALUES (?, ?, ?, ?)`,
      g.id,
      g.name,
      g.sort_order,
      g.is_system ? 1 : 0,
    );
  }
  for (const c of SEED_CATEGORIES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (
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
  for (const b of seedBudgetMonths(ym)) {
    await db.runAsync(
      `INSERT OR IGNORE INTO budget_months (
        category_id, year_month, budgeted_amount, rollover_mode, rollover_from_prior
      ) VALUES (?, ?, ?, ?, ?)`,
      b.category_id,
      b.year_month,
      b.budgeted_amount,
      b.rollover_mode,
      b.rollover_from_prior,
    );
  }
}

describe("local budgets + needs_review exclusion", () => {
  it("needs_review spend does not count; review then counts", async () => {
    const db = createMemoryDb();
    const ym = "2026-09";
    await seedCats(db, ym);

    const { transactionId } = await addExpenseOffline(
      {
        account_id: "acc-cash-ars",
        category_id: "cat-dining",
        amount: 40,
        currency: "USD",
        account_currency: "ARS",
        reporting_currency: "USD",
        posted_at: "2026-09-04T12:00:00.000Z",
        note: "Lunch",
      },
      db,
    );

    let overview = await getCategoryBudgetOverview(ym, db);
    const diningBefore = overview.rows.find(
      (r) => r.category.id === "cat-dining",
    )!;
    expect(diningBefore.spent).toBe(0);

    await reviewTransaction(transactionId, db);
    overview = await getCategoryBudgetOverview(ym, db);
    const diningAfter = overview.rows.find(
      (r) => r.category.id === "cat-dining",
    )!;
    expect(diningAfter.spent).toBe(40);
    expect(diningAfter.remaining).toBe(diningAfter.effective - 40);
  });

  it("setBudgetAmount updates local row and queues budget_upsert", async () => {
    const db = createMemoryDb();
    const ym = "2026-09";
    await seedCats(db, ym);

    await setBudgetAmount(
      { category_id: "cat-dining", year_month: ym, budgeted_amount: 333 },
      db,
    );

    const overview = await getCategoryBudgetOverview(ym, db);
    const dining = overview.rows.find((r) => r.category.id === "cat-dining")!;
    expect(dining.budgeted_amount).toBe(333);

    const remote: unknown[] = [];
    await syncOutbox(async (items) => {
      remote.push(...items);
      return { ok: true };
    }, db);

    expect(remote[0]).toMatchObject({
      op: "budget_upsert",
      category_id: "cat-dining",
      year_month: ym,
      budgeted_amount: 333,
    });
  });
});
