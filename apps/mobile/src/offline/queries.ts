import { normalizeReviewStatus } from "@copilot-clone/domain";
import { isWebRuntime } from "../db/runtime";
import type { LocalDb } from "../db/types";
import { getApiUserId } from "../sync/userId";

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

// Avoid importing ../config (expo-constants) so vitest/node stays RN-free.

const DEFAULT_API_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://copilot-clone-api.maurodaprotis.workers.dev";

function normalizeTxn(row: LocalTransaction): LocalTransaction {
  return {
    ...row,
    review_status: normalizeReviewStatus(row.review_status),
  };
}

function mapApiTxn(raw: Record<string, unknown>): LocalTransaction {
  return normalizeTxn({
    id: String(raw.id),
    account_id: String(raw.account_id),
    category_id: raw.category_id == null ? null : String(raw.category_id),
    amount: Number(raw.amount),
    currency: String(raw.currency),
    amount_account: Number(raw.amount_account ?? raw.amount ?? 0),
    amount_reporting: Number(raw.amount_reporting ?? raw.amount ?? 0),
    type: String(raw.type ?? "regular"),
    is_refund: Number(raw.is_refund ?? 0) ? 1 : 0,
    review_status: String(raw.review_status ?? "needs_review"),
    posted_at: String(raw.posted_at ?? ""),
    note: raw.note == null ? (raw.name == null ? null : String(raw.name)) : String(raw.note),
    fingerprint: raw.fingerprint == null ? null : String(raw.fingerprint),
    synced: Number(raw.synced ?? 1) ? 1 : 0,
    created_at: String(raw.created_at ?? raw.posted_at ?? ""),
    updated_at: String(raw.updated_at ?? raw.posted_at ?? ""),
  });
}

async function fetchTransactionsFromApi(options?: {
  apiUrl?: string;
  userId?: string;
  fetchImpl?: typeof fetch;
}): Promise<LocalTransaction[] | null> {
  const apiUrl = options?.apiUrl ?? DEFAULT_API_URL;
  const userId = options?.userId ?? getApiUserId();
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/transactions`, {
      headers: { "x-user-id": userId },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { transactions?: Record<string, unknown>[] };
    if (!Array.isArray(data.transactions)) return null;
    return data.transactions.map(mapApiTxn);
  } catch {
    return null;
  }
}

/** needs_review transactions for Dashboard To Review + Transactions inbox. */
export async function listToReview(
  dbOverride?: LocalDb,
): Promise<LocalTransaction[]> {
  if (!dbOverride && isWebRuntime()) {
    const remote = await fetchTransactionsFromApi();
    if (!remote) return [];
    return remote.filter((t) =>
      ["needs_review", "pending"].includes(t.review_status),
    );
  }
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
  if (!dbOverride && isWebRuntime()) {
    const remote = await fetchTransactionsFromApi();
    return remote ?? [];
  }
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<LocalTransaction>(
    `SELECT * FROM transactions ORDER BY posted_at DESC`,
  );
  return rows.map(normalizeTxn);
}

export async function countOutbox(dbOverride?: LocalDb): Promise<number> {
  if (!dbOverride && isWebRuntime()) {
    const { countWebOutbox } = await import("./webOutbox");
    return countWebOutbox();
  }
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM outbox",
  );
  return row?.c ?? 0;
}

export const __test = {
  fetchTransactionsFromApi,
  mapApiTxn,
};
