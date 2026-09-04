import * as SQLite from "expo-sqlite";
import { ACCOUNTS_MIGRATE_SQL, CLIENT_SCHEMA, seedBudgetRows, seedCategoryGroupRows, seedCategoryRows } from "@copilot-clone/db";
import { currentYearMonth, seedFxRates } from "@copilot-clone/domain";
import {
  DEMO_ACCOUNT_CURRENCY,
  DEMO_ACCOUNT_ID,
} from "../config";
import type { LocalDb } from "./types";

let dbPromise: Promise<LocalDb> | null = null;

async function seedDefaults(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO accounts (
       id, name, currency, type, is_archived, include_in_net_worth, current_balance
     ) VALUES (?, ?, ?, 'other', 0, 1, 0)`,
    DEMO_ACCOUNT_ID,
    "Cash ARS",
    DEMO_ACCOUNT_CURRENCY,
  );

  for (const row of seedFxRates()) {
    await db.runAsync(
      `INSERT OR IGNORE INTO fx_rates (from_currency, to_currency, on_date, rate)
       VALUES (?, ?, ?, ?)`,
      row.from,
      row.to,
      row.on_date,
      row.rate,
    );
  }

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


async function migrateReviewStatus(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `UPDATE transactions SET review_status = 'needs_review'
     WHERE review_status = 'pending'`,
  );
}


async function migrateAccountTypes(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(`UPDATE accounts SET type = 'other' WHERE type = 'cash'`);
  await db.runAsync(`UPDATE accounts SET type = 'depository' WHERE type = 'bank'`);
  await db.runAsync(`UPDATE accounts SET type = 'credit_card' WHERE type = 'credit'`);
}

async function migrateAccountBalances(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY)`,
  );
  const done = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM _migrations WHERE id = 'acct_bal_v2' LIMIT 1`,
  );
  if (done) return;

  const {
    recomputeBalanceFromOpeningAndTxns,
    normalizeReviewStatus,
  } = await import("@copilot-clone/domain");

  const accounts = await db.getAllAsync<{
    id: string;
    current_balance: number;
  }>("SELECT id, current_balance FROM accounts");
  const txns = await db.getAllAsync<{
    id: string;
    account_id: string;
    amount_account: number;
    amount_reporting: number;
    amount: number;
    currency: string;
    type: string;
    is_refund: number;
    review_status: string;
    posted_at: string;
    category_id: string | null;
    note: string | null;
    fingerprint: string | null;
  }>("SELECT * FROM transactions");

  const domainTxns = txns.map((row) => ({
    id: row.id,
    account_id: row.account_id,
    category_id: row.category_id,
    amount: Number(row.amount),
    currency: row.currency,
    amount_account: Number(row.amount_account),
    amount_reporting: Number(row.amount_reporting),
    type: row.type as "regular" | "income" | "transfer",
    is_refund: Number(row.is_refund) === 1,
    review_status: normalizeReviewStatus(row.review_status),
    status: "posted" as const,
    posted_at: row.posted_at,
    note: row.note,
    transfer_pair_id: null,
    fingerprint: row.fingerprint,
  }));

  for (const a of accounts) {
    const bal = recomputeBalanceFromOpeningAndTxns(
      { id: a.id, current_balance: Number(a.current_balance ?? 0) },
      domainTxns,
    );
    await db.runAsync(
      `UPDATE accounts SET current_balance = ? WHERE id = ?`,
      bal,
      a.id,
    );
  }
  await db.runAsync(
    `INSERT OR IGNORE INTO _migrations (id) VALUES ('acct_bal_v2')`,
  );
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
      for (const sql of ACCOUNTS_MIGRATE_SQL) {
        try {
          await db.execAsync(sql);
        } catch {
          // column already exists
        }
      }
      await migrateReviewStatus(db);
      await migrateAccountTypes(db);
      await seedDefaults(db);
      await migrateAccountBalances(db);
      return db as unknown as LocalDb;
    })();
  }
  return dbPromise;
}

/** Test-only: replace the singleton (used by vitest memory db). */
export function setDbForTests(db: LocalDb | null): void {
  dbPromise = db ? Promise.resolve(db) : null;
}
