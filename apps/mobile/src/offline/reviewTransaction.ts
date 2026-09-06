import {
  balanceDeltaForTxn,
  normalizeReviewStatus,
  type Transaction,
} from "@copilot-clone/domain";
import { isWebRuntime } from "../db/runtime";
import type { LocalDb } from "../db/types";
import { webSyncOrEnqueue } from "./webSyncWrite";

/**
 * Mark a transaction reviewed.
 * - Web / Pages: POST review op to Worker (queues web outbox offline). Never expo-sqlite.
 * - Native: local SQLite + outbox enqueue.
 * When review flips balance applicability, persist the delta on accounts.current_balance.
 */
export async function reviewTransaction(
  transactionId: string,
  dbOverride?: LocalDb,
): Promise<{ outboxId: string }> {
  const now = new Date().toISOString();

  if (!dbOverride && isWebRuntime()) {
    const result = await webSyncOrEnqueue({
      payload: {
        op: "review",
        id: transactionId,
        review_status: "reviewed",
        updated_at: now,
      },
      entity_type: "transaction_review",
      entity_id: transactionId,
    });
    return { outboxId: result.outboxId };
  }

  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const outboxId = crypto.randomUUID();

  const existing = await db.getFirstAsync<{
    id: string;
    account_id: string;
    amount: number;
    currency: string;
    amount_account: number;
    amount_reporting: number;
    type: string;
    is_refund: number;
    review_status: string;
    posted_at: string;
    category_id: string | null;
    note: string | null;
    fingerprint: string | null;
  }>("SELECT * FROM transactions WHERE id = ?", transactionId);

  if (!existing) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  const before: Transaction = {
    id: existing.id,
    account_id: existing.account_id,
    category_id: existing.category_id,
    amount: Number(existing.amount),
    currency: existing.currency,
    amount_account: Number(existing.amount_account),
    amount_reporting: Number(existing.amount_reporting),
    type: existing.type as Transaction["type"],
    is_refund: Number(existing.is_refund) === 1,
    review_status: normalizeReviewStatus(existing.review_status),
    status: "posted",
    posted_at: existing.posted_at,
    note: existing.note,
    transfer_pair_id: null,
    fingerprint: existing.fingerprint,
  };
  const after: Transaction = { ...before, review_status: "reviewed" };
  const delta = balanceDeltaForTxn(after) - balanceDeltaForTxn(before);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions SET review_status = ?, synced = 0, updated_at = ? WHERE id = ?`,
      "reviewed",
      now,
      transactionId,
    );

    if (delta !== 0) {
      await db.runAsync(
        `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
        delta,
        existing.account_id,
      );
    }

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
