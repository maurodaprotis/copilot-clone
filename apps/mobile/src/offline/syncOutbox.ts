import { getDb } from "../db/client";

export type SyncTransport = (items: unknown[]) => Promise<{ ok: boolean }>;

/**
 * Push pending outbox rows via transport (mock DO call in tests).
 * On success, deletes outbox rows and marks transactions reviewed.
 */
export async function syncOutbox(
  transport: SyncTransport,
): Promise<{ pushed: number }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    entity_id: string;
    payload: string;
  }>("SELECT id, entity_id, payload FROM outbox ORDER BY created_at ASC");

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

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(`DELETE FROM outbox WHERE id = ?`, row.id);
      await db.runAsync(
        `UPDATE transactions SET review_status = 'reviewed', updated_at = ? WHERE id = ?`,
        new Date().toISOString(),
        row.entity_id,
      );
    }
  });

  return { pushed: rows.length };
}
