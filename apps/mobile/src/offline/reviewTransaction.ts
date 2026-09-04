import type { LocalDb } from "../db/types";

/**
 * Mark a transaction reviewed locally and queue a sync of the review status.
 */
export async function reviewTransaction(
  transactionId: string,
  dbOverride?: LocalDb,
): Promise<{ outboxId: string }> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const now = new Date().toISOString();
  const outboxId = crypto.randomUUID();

  const existing = await db.getFirstAsync<{
    id: string;
    review_status: string;
  }>("SELECT id, review_status FROM transactions WHERE id = ?", transactionId);

  if (!existing) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions SET review_status = ?, synced = 0, updated_at = ? WHERE id = ?`,
      "reviewed",
      now,
      transactionId,
    );

    const payload = JSON.stringify({
      op: "review",
      id: transactionId,
      review_status: "reviewed",
      updated_at: now,
    });

    await db.runAsync(
      `INSERT INTO outbox (id, entity_type, entity_id, payload, created_at, attempts, last_error)
       VALUES (?, 'transaction_review', ?, ?, ?, 0, NULL)`,
      outboxId,
      transactionId,
      payload,
      now,
    );
  });

  return { outboxId };
}
