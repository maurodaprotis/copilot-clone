import { isWebRuntime } from "../db/runtime";
import type { LocalDb } from "../db/types";
import { webSyncOrEnqueue } from "./webSyncWrite";

/**
 * Soft-delete a transaction (sync op `delete`).
 * - Web / Pages: POST delete to Worker (queues web outbox offline).
 * - Native: soft-delete local row when deleted_at exists; else hard-delete + outbox.
 */
export async function deleteTransaction(
  transactionId: string,
  dbOverride?: LocalDb,
): Promise<{ outboxId: string; queued?: boolean }> {
  const now = new Date().toISOString();

  if (!dbOverride && isWebRuntime()) {
    const result = await webSyncOrEnqueue({
      payload: {
        op: "delete",
        id: transactionId,
        updated_at: now,
      },
      entity_type: "transaction",
      entity_id: transactionId,
    });
    return { outboxId: result.outboxId, queued: result.queued };
  }

  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const outboxId = crypto.randomUUID();

  await db.withTransactionAsync(async () => {
    // Prefer soft-delete so metrics queries that forget the filter still can exclude.
    try {
      await db.runAsync(
        `UPDATE transactions SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ?`,
        now,
        now,
        transactionId,
      );
    } catch {
      await db.runAsync(`DELETE FROM transactions WHERE id = ?`, transactionId);
    }

    const payload = JSON.stringify({
      op: "delete",
      id: transactionId,
      updated_at: now,
    });

    await db.runAsync(
      `INSERT INTO outbox (id, entity_type, entity_id, payload, created_at, attempts, last_error)
       VALUES (?, 'transaction', ?, ?, ?, 0, NULL)`,
      outboxId,
      transactionId,
      payload,
      now,
    );
  });

  return { outboxId, queued: false };
}
