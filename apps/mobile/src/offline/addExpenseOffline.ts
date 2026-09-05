import {
  deriveAmounts,
  seedRateBook,
  transactionFingerprint,
  type RateBook,
} from "@copilot-clone/domain";
import { isWebRuntime } from "../db/runtime";
import type { LocalDb } from "../db/types";
import { webSyncOrEnqueue } from "./webSyncWrite";

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
  /** regular (expense) or income — defaults to regular. */
  type?: "regular" | "income";
};

async function upsertTxnViaApi(
  input: AddExpenseOfflineInput & {
    id: string;
    posted_at: string;
    fingerprint: string;
    type: "regular" | "income";
  },
  options?: {
    apiUrl?: string;
    userId?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<{ transactionId: string; outboxId: string; queued: boolean }> {
  const payload = {
    op: "upsert" as const,
    id: input.id,
    account_id: input.account_id,
    category_id: input.category_id ?? null,
    amount: input.amount,
    currency: input.currency,
    type: input.type,
    is_refund: false,
    review_status: "needs_review",
    posted_at: input.posted_at,
    note: input.note ?? null,
    txn_name: input.note ?? null,
    fingerprint: input.fingerprint,
    account_currency: input.account_currency,
    reporting_currency: input.reporting_currency,
  };

  const result = await webSyncOrEnqueue({
    payload,
    entity_type: "transaction",
    entity_id: input.id,
    apiUrl: options?.apiUrl,
    userId: options?.userId,
    fetchImpl: options?.fetchImpl,
  });
  return {
    transactionId: input.id,
    outboxId: result.outboxId,
    queued: result.queued,
  };
}

/**
 * Insert a needs_review expense/income.
 * - Web / Pages: POST upsert to Worker; on network fail queue web outbox (never expo-sqlite).
 * - Native: local SQLite + outbox enqueue.
 * ReviewStatus is needs_review | reviewed (NOT pending — that is TxnStatus).
 */
export async function addExpenseOffline(
  input: AddExpenseOfflineInput,
  dbOverride?: LocalDb,
): Promise<{ transactionId: string; outboxId: string; queued?: boolean }> {
  const id = input.id ?? crypto.randomUUID();
  const posted_at = input.posted_at ?? new Date().toISOString();
  const txnType = input.type ?? "regular";
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
    type: txnType,
    posted_at,
    note: input.note,
  });

  // Pages / web: never touch expo-sqlite — push upsert (or queue web outbox).
  if (!dbOverride && isWebRuntime()) {
    return upsertTxnViaApi({
      ...input,
      id,
      posted_at,
      fingerprint,
      type: txnType,
    });
  }

  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const now = new Date().toISOString();
  const outboxId = crypto.randomUUID();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transactions (
        id, account_id, category_id, amount, currency,
        amount_account, amount_reporting, type, is_refund,
        review_status, posted_at, name, note, transfer_pair_id, fingerprint,
        is_split_parent, synced, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'needs_review', ?, ?, ?, NULL, ?, 0, 0, ?, ?)`,
      id,
      input.account_id,
      input.category_id ?? null,
      input.amount,
      input.currency.toUpperCase(),
      amounts.amount_account,
      amounts.amount_reporting,
      txnType,
      posted_at,
      input.note ?? null,
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
      type: txnType,
      is_refund: false,
      review_status: "needs_review",
      posted_at,
      note: input.note ?? null,
      txn_name: input.note ?? null,
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

  return { transactionId: id, outboxId, queued: false };
}

/** Test/helper export: direct API upsert (used by smoke tests). */
export const __test = {
  upsertTxnViaApi,
};
