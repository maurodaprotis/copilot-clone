import * as SQLite from "expo-sqlite";
import { CLIENT_SCHEMA } from "@copilot-clone/db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("copilot.db");
      await db.execAsync(CLIENT_SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}
