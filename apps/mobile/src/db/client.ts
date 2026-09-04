import * as SQLite from "expo-sqlite";
import { CLIENT_SCHEMA } from "@copilot-clone/db";
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
