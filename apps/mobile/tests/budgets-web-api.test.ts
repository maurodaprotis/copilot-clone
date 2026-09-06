import { describe, expect, it } from "vitest";
import { createMemoryDb } from "../src/db/memory";
import {
  applyRemoteCategoriesSnapshot,
  getCategoryBudgetOverview,
  monthsForBudgetScope,
  setBudgetAmount,
  __test,
} from "../src/offline/budgets";
import {
  SEED_CATEGORIES,
  SEED_CATEGORY_GROUPS,
  seedBudgetMonths,
} from "@copilot-clone/domain";

describe("budgets web API helpers", () => {
  it("setBudgetViaApi posts budget_upsert with x-user-id", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true, saved: ["cat-dining:2026-09"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await __test.setBudgetViaApi(
      {
        category_id: "cat-dining",
        year_month: "2026-09",
        budgeted_amount: 250,
        rollover_mode: "off",
      },
      {
        apiUrl: "https://example.test",
        userId: "demo-user",
        fetchImpl,
      },
    );

    expect(result.outboxId).toBe("web-api:cat-dining:2026-09");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://example.test/sync");
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers["x-user-id"]).toBe("demo-user");
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body.items[0]).toMatchObject({
      op: "budget_upsert",
      category_id: "cat-dining",
      year_month: "2026-09",
      budgeted_amount: 250,
      rollover_mode: "off",
    });
  });

  it("setBudgetViaApi queues web outbox when Worker returns not ok", async () => {
    const { countWebOutbox, __resetWebOutboxForTests } = await import(
      "../src/offline/webOutbox"
    );
    __resetWebOutboxForTests();
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: false, message: "nope" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const result = await __test.setBudgetViaApi(
      {
        category_id: "cat-dining",
        year_month: "2026-09",
        budgeted_amount: 1,
      },
      { apiUrl: "https://example.test", userId: "demo-user", fetchImpl },
    );
    expect(result.queued).toBe(true);
    expect(countWebOutbox()).toBe(1);
    __resetWebOutboxForTests();
  });
});


  it("setBudgetViaApi all_months posts multiple budget_upsert items", async () => {
    const calls: { body: string }[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls.push({ body: String(init?.body ?? "") });
      return new Response(
        JSON.stringify({
          ok: true,
          saved: Array.from({ length: 25 }, (_, i) => `cat-dining:m${i}`),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const result = await __test.setBudgetViaApi(
      {
        category_id: "cat-dining",
        year_month: "2026-09",
        budgeted_amount: 150,
        apply_to: "all_months",
      },
      {
        apiUrl: "https://example.test",
        userId: "demo-user",
        fetchImpl,
      },
    );

    expect(result.queued).toBeFalsy();
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0]!.body);
    expect(body.items).toHaveLength(monthsForBudgetScope("2026-09", "all_months").length);
    expect(body.items[0]).toMatchObject({
      op: "budget_upsert",
      category_id: "cat-dining",
      budgeted_amount: 150,
    });
    expect(body.items.some((i: { year_month: string }) => i.year_month === "2026-09")).toBe(
      true,
    );
    expect(body.items.some((i: { year_month: string }) => i.year_month === "2025-09")).toBe(
      true,
    );
  });

  it("monthsForBudgetScope month vs all_months", () => {
    expect(monthsForBudgetScope("2026-09", "month")).toEqual(["2026-09"]);
    expect(monthsForBudgetScope("2026-09", "all_months")).toHaveLength(25);
  });

describe("budgets native sqlite path (memory db)", () => {
  it("setBudgetAmount with dbOverride still writes local + outbox", async () => {
    const db = createMemoryDb();
    const ym = "2026-09";
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

    await setBudgetAmount(
      { category_id: "cat-dining", year_month: ym, budgeted_amount: 444 },
      db,
    );
    const overview = await getCategoryBudgetOverview(ym, db);
    expect(
      overview.rows.find((r) => r.category.id === "cat-dining")?.budgeted_amount,
    ).toBe(444);
    const outbox = await db.getAllAsync<{ payload: string }>(
      "SELECT payload FROM outbox",
    );
    expect(outbox).toHaveLength(1);
    expect(JSON.parse(outbox[0]!.payload).op).toBe("budget_upsert");
  });

  it("applyRemoteCategoriesSnapshot mirrors with dbOverride", async () => {
    const db = createMemoryDb();
    await applyRemoteCategoriesSnapshot(
      {
        groups: [
          { id: "g1", name: "Food", sort_order: 1, is_system: false },
        ],
        categories: [
          {
            id: "c1",
            group_id: "g1",
            name: "Coffee",
            emoji: "☕",
            color: "#000",
            exclude_from_budget: false,
            is_income_category: false,
            archived: false,
            sort_order: 1,
          },
        ],
        budgets: [
          {
            category_id: "c1",
            year_month: "2026-09",
            budgeted_amount: 50,
            rollover_mode: "off",
            rollover_from_prior: 0,
          },
        ],
      },
      db,
    );
    const overview = await getCategoryBudgetOverview("2026-09", db);
    expect(overview.rows.some((r) => r.category.id === "c1")).toBe(true);
  });

  it("setBudgetAmount all_months writes many local budget rows", async () => {
    const db = createMemoryDb();
    const ym = "2026-09";
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
    await setBudgetAmount(
      {
        category_id: "cat-dining",
        year_month: ym,
        budgeted_amount: 150,
        apply_to: "all_months",
      },
      db,
    );
    const rows = await db.getAllAsync<{ year_month: string; budgeted_amount: number }>(
      "SELECT year_month, budgeted_amount FROM budget_months WHERE category_id = ?",
      "cat-dining",
    );
    expect(rows.length).toBe(25);
    expect(rows.every((r) => r.budgeted_amount === 150)).toBe(true);
  });

});
