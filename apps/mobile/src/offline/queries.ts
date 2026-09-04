import { normalizeReviewStatus } from "@copilot-clone/domain";
import type { LocalDb } from "../db/types";

export type LocalTransaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  amount_account: number;
  amount_reporting: number;
  type: string;
  is_refund: number;
  review_status: string;
  posted_at: string;
  note: string | null;
  fingerprint: string | null;
  synced: number;
  created_at: string;
  updated_at: string;
};

function normalizeTxn(row: LocalTransaction): LocalTransaction {
  return {
    ...row,
    review_status: normalizeReviewStatus(row.review_status),
  };
}

/** needs_review transactions for Dashboard To Review + Transactions inbox. */
export async function listToReview(
  dbOverride?: LocalDb,
): Promise<LocalTransaction[]> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<LocalTransaction>(
    `SELECT * FROM transactions
     WHERE review_status IN ('needs_review', 'pending')
     ORDER BY posted_at DESC`,
  );
  return rows.map(normalizeTxn);
}

export async function listAllTransactions(
  dbOverride?: LocalDb,
): Promise<LocalTransaction[]> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<LocalTransaction>(
    `SELECT * FROM transactions ORDER BY posted_at DESC`,
  );
  return rows.map(normalizeTxn);
}

export async function countOutbox(dbOverride?: LocalDb): Promise<number> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM outbox",
  );
  return row?.c ?? 0;
}
