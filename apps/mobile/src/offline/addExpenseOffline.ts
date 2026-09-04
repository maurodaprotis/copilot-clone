import {
  deriveAmounts,
  transactionFingerprint,
  type RateBook,
} from "@copilot-clone/domain";
import { getDb } from "../db/client";

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
 * Insert a pending expense locally and enqueue an outbox row for later sync.
 */
export async function addExpenseOffline(
  input: AddExpenseOfflineInput,
): Promise<{ transactionId: string; outboxId: string }> {
  const db = await getDb();
  const id = input.id ?? crypto.randomUUID();
  const posted_at = input.posted_at ?? new Date().toISOString();
  const rate_book = input.rate_book ?? {};
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
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 0, 'pending', ?, ?, NULL, ?, ?, ?)`,
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
      id,
      account_id: input.account_id,
      category_id: input.category_id ?? null,
      amount: input.amount,
      currency: input.currency,
      type: "regular",
      is_refund: false,
      review_status: "pending",
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
