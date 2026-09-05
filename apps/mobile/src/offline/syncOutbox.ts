import { isWebRuntime } from "../db/runtime";
import type { LocalDb } from "../db/types";
import { drainWebOutbox } from "./webOutbox";

export type SyncTransport = (items: unknown[]) => Promise<{ ok: boolean; saved?: string[] }>;

/**
 * Push pending outbox rows via transport (HTTP in prod, mock in tests).
 * On success: deletes outbox rows and marks transactions synced=1.
 * Does NOT change review_status — needs_review stays in To Review until reviewed.
 *
 * Web / Pages: drains localStorage web outbox only (never expo-sqlite). Native
 * uses SQLite outbox. Account/budget/txn writes on web try POST /sync first and
 * enqueue the web outbox only when the network fails.
 */
export async function syncOutbox(
  transport: SyncTransport,
  dbOverride?: LocalDb,
): Promise<{ pushed: number }> {
  // Web: drain localStorage outbox and stop (Pages has no durable sqlite outbox).
  if (!dbOverride && isWebRuntime()) {
    return drainWebOutbox(transport);
  }

  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<{
    id: string;
    entity_type: string;
    entity_id: string;
    payload: string;
  }>("SELECT id, entity_type, entity_id, payload FROM outbox ORDER BY created_at ASC");

  if (rows.length === 0) return { pushed: 0 };

  const items = rows.map((r) => JSON.parse(r.payload));
  const result = await transport(items);
  if (!result.ok) {
    for (const row of rows) {
      await db.runAsync(
        `UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
        "transport failed",
        row.id,
      );
    }
    return { pushed: 0 };
  }

  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(`DELETE FROM outbox WHERE id = ?`, row.id);
      if (
        row.entity_type === "transaction" ||
        row.entity_type === "transaction_review"
      ) {
        await db.runAsync(
          `UPDATE transactions SET synced = 1, updated_at = ? WHERE id = ?`,
          now,
          row.entity_id,
        );
      }
    }
  });

  return { pushed: rows.length };
}
