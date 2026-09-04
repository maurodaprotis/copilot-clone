import * as SQLite from "expo-sqlite";
import { CLIENT_SCHEMA, seedBudgetRows, seedCategoryGroupRows, seedCategoryRows } from "@copilot-clone/db";
import { currentYearMonth } from "@copilot-clone/domain";
import {
  DEMO_ACCOUNT_CURRENCY,
  DEMO_ACCOUNT_ID,
} from "../config";
import type { LocalDb } from "./types";

let dbPromise: Promise<LocalDb> | null = null;

async function seedDefaults(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO accounts (id, name, currency, type, is_archived)
     VALUES (?, ?, ?, 'cash', 0)`,
    DEMO_ACCOUNT_ID,
    "Cash ARS",
    DEMO_ACCOUNT_CURRENCY,
  );

  for (const g of seedCategoryGroupRows()) {
    await db.runAsync(
      `INSERT OR IGNORE INTO category_groups (id, name, sort_order, is_system)
       VALUES (?, ?, ?, ?)`,
      g.id,
      g.name,
      g.sort_order,
      g.is_system,
    );
  }
  for (const c of seedCategoryRows()) {
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
      c.exclude_from_budget,
      c.is_income_category,
      c.archived,
      c.sort_order,
    );
  }
  for (const b of seedBudgetRows(currentYearMonth())) {
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

export async function getDb(): Promise<LocalDb> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("copilot.db");
      await db.execAsync(CLIENT_SCHEMA);
      // Best-effort migrate older scaffold DBs missing synced column.
      try {
        await db.execAsync(
          "ALTER TABLE transactions ADD COLUMN synced INTEGER NOT NULL DEFAULT 0",
        );
      } catch {
        // column already exists
      }
      await seedDefaults(db);
      return db as unknown as LocalDb;
    })();
  }
  return dbPromise;
}

/** Test-only: replace the singleton (used by vitest memory db). */
export function setDbForTests(db: LocalDb | null): void {
  dbPromise = db ? Promise.resolve(db) : null;
}
