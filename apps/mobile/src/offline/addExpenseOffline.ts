import {
  deriveAmounts,
  seedRateBook,
  transactionFingerprint,
  type RateBook,
} from "@copilot-clone/domain";
import type { LocalDb } from "../db/types";

export type AddExpenseOfflineInput = {
  id?: string;
  account_id: string;
  category_id?: string | null;
  amount: number;
  currency: string;
  account_currency: string;
  reporting_currency: string;
  posted_at?: string;
  note?: string | null;
  rate_book?: RateBook;
};

/**
 * Insert a needs_review expense locally and enqueue an outbox row.
 * ReviewStatus is needs_review | reviewed (NOT pending — that is TxnStatus).
 */
export async function addExpenseOffline(
  input: AddExpenseOfflineInput,
  dbOverride?: LocalDb,
): Promise<{ transactionId: string; outboxId: string }> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const id = input.id ?? crypto.randomUUID();
  const posted_at = input.posted_at ?? new Date().toISOString();
  // Prefer caller book; otherwise seeded USD/ARS so convert does not warn.
  const rate_book =
    input.rate_book && Object.keys(input.rate_book).length > 0
      ? input.rate_book
      : seedRateBook();
  const amounts = deriveAmounts({
    amount: input.amount,
    currency: input.currency,
    account_currency: input.account_currency,
    reporting_currency: input.reporting_currency,
    on_date: posted_at.slice(0, 10),
    rate_book,
  });
  const fingerprint = transactionFingerprint({
    account_id: input.account_id,
    amount: input.amount,
    currency: input.currency,
    type: "regular",
    posted_at,
    note: input.note,
  });
  const now = new Date().toISOString();
  const outboxId = crypto.randomUUID();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transactions (
        id, account_id, category_id, amount, currency,
        amount_account, amount_reporting, type, is_refund,
        review_status, posted_at, note, transfer_pair_id, fingerprint,
        synced, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 0, 'needs_review', ?, ?, NULL, ?, 0, ?, ?)`,
      id,
      input.account_id,
      input.category_id ?? null,
      input.amount,
      input.currency.toUpperCase(),
      amounts.amount_account,
      amounts.amount_reporting,
      posted_at,
      input.note ?? null,
      fingerprint,
      now,
      now,
    );

    const payload = JSON.stringify({
      op: "upsert",
      id,
      account_id: input.account_id,
      category_id: input.category_id ?? null,
      amount: input.amount,
      currency: input.currency,
      type: "regular",
      is_refund: false,
      review_status: "needs_review",
      posted_at,
      note: input.note ?? null,
      fingerprint,
      account_currency: input.account_currency,
      reporting_currency: input.reporting_currency,
    });

    await db.runAsync(
      `INSERT INTO outbox (id, entity_type, entity_id, payload, created_at, attempts, last_error)
       VALUES (?, 'transaction', ?, ?, ?, 0, NULL)`,
      outboxId,
      id,
      payload,
      now,
    );
  });

  return { transactionId: id, outboxId };
}
