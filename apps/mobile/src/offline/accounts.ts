import { isWebRuntime } from "../db/runtime";
import {
  buildAccountBalanceRows,
  normalizeAccountType,
  normalizeReviewStatus,
  type Account,
  type AccountBalanceRow,
  type RateBook,
  type Transaction,
} from "@copilot-clone/domain";
import type { LocalDb } from "../db/types";
import type { LocalTransaction } from "./queries";
import { webSyncOrEnqueue } from "./webSyncWrite";

// Avoid importing ../config (expo-constants) so vitest/node stays RN-free.
const DEFAULT_API_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://copilot-clone-api.maurodaprotis.workers.dev";
const DEFAULT_USER_ID = "demo-user";


function toDomainTxn(row: LocalTransaction): Transaction {
  return {
    id: row.id,
    account_id: row.account_id,
    category_id: row.category_id,
    amount: row.amount,
    currency: row.currency,
    amount_account: row.amount_account,
    amount_reporting: row.amount_reporting,
    type: row.type as Transaction["type"],
    is_refund: row.is_refund === 1,
    review_status: normalizeReviewStatus(row.review_status),
    status: "posted",
    posted_at: row.posted_at,
    note: row.note,
    transfer_pair_id: null,
    fingerprint: row.fingerprint,
  };
}

export type LocalAccount = {
  id: string;
  name: string;
  currency: string;
  type: string;
  is_archived: number;
  include_in_net_worth: number;
  current_balance: number;
};

function toDomainAccount(row: LocalAccount): Account {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    type: normalizeAccountType(row.type),
    is_archived: row.is_archived === 1,
    include_in_net_worth: Number(row.include_in_net_worth ?? 1) === 1,
    current_balance: Number(row.current_balance ?? 0),
  };
}

async function loadRateBook(db: LocalDb): Promise<RateBook> {
  const rows = await db.getAllAsync<{
    from_currency: string;
    to_currency: string;
    on_date: string;
    rate: number;
  }>("SELECT from_currency, to_currency, on_date, rate FROM fx_rates");
  const book: RateBook = {};
  for (const r of rows) {
    book[`${r.from_currency}:${r.to_currency}:${r.on_date}`] = r.rate;
  }
  return book;
}

type AccountsOverview = {
  rows: AccountBalanceRow[];
  net_worth_reporting: number;
  reporting_currency?: string;
  on_date: string;
};

async function fetchAccountsOverviewFromApi(options?: {
  apiUrl?: string;
  userId?: string;
  fetchImpl?: typeof fetch;
}): Promise<AccountsOverview | null> {
  const apiUrl = options?.apiUrl ?? DEFAULT_API_URL;
  const userId = options?.userId ?? DEFAULT_USER_ID;
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/accounts`, {
      headers: { "x-user-id": userId },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      rows?: AccountBalanceRow[];
      net_worth_reporting?: number;
      reporting_currency?: string;
      on_date?: string;
    };
    if (!Array.isArray(data.rows)) return null;
    return {
      rows: data.rows,
      net_worth_reporting: Number(data.net_worth_reporting ?? 0),
      reporting_currency: data.reporting_currency,
      on_date: data.on_date ?? new Date().toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}

async function upsertAccountViaApi(
  input: {
    id?: string;
    name: string;
    currency: string;
    type: Account["type"];
    include_in_net_worth?: boolean;
    current_balance?: number;
    is_archived?: boolean;
  },
  options?: {
    apiUrl?: string;
    userId?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<{ id: string; outboxId: string }> {
  const apiUrl = options?.apiUrl ?? DEFAULT_API_URL;
  const userId = options?.userId ?? DEFAULT_USER_ID;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const includeNw = input.include_in_net_worth === false ? false : true;
  const balance = Number(input.current_balance ?? 0);
  const archived = Boolean(input.is_archived);
  const payload = {
    op: "account_upsert" as const,
    id,
    name: input.name,
    currency: input.currency.toUpperCase(),
    type: normalizeAccountType(input.type),
    is_archived: archived,
    include_in_net_worth: includeNw,
    current_balance: balance,
    updated_at: now,
  };

  const result = await webSyncOrEnqueue({
    payload,
    entity_type: "account",
    entity_id: id,
    apiUrl,
    userId,
    fetchImpl,
  });
  return { id, outboxId: result.outboxId };
}

export async function listLocalAccounts(
  dbOverride?: LocalDb,
): Promise<Account[]> {
  if (!dbOverride && isWebRuntime()) {
    const overview = await fetchAccountsOverviewFromApi();
    if (overview) return overview.rows.map((r) => r.account);
    return [];
  }
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<LocalAccount>(
    "SELECT * FROM accounts ORDER BY type ASC, name ASC",
  );
  return rows.map(toDomainAccount);
}

export async function getAccountsOverview(dbOverride?: LocalDb) {
  if (!dbOverride && isWebRuntime()) {
    const remote = await fetchAccountsOverviewFromApi();
    if (remote) return remote;
    return {
      rows: [] as AccountBalanceRow[],
      net_worth_reporting: 0,
      on_date: new Date().toISOString().slice(0, 10),
    };
  }

  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const [accounts, txnRows, rateBook] = await Promise.all([
    listLocalAccounts(db),
    db.getAllAsync<LocalTransaction>("SELECT * FROM transactions"),
    loadRateBook(db),
  ]);
  const on_date = new Date().toISOString().slice(0, 10);
  const built = buildAccountBalanceRows({
    accounts,
    transactions: txnRows.map(toDomainTxn),
    reporting_currency: "USD",
    on_date,
    rate_book: rateBook,
  });
  return { ...built, on_date };
}

export async function upsertAccountLocal(
  input: {
    id?: string;
    name: string;
    currency: string;
    type: Account["type"];
    include_in_net_worth?: boolean;
    current_balance?: number;
    is_archived?: boolean;
  },
  dbOverride?: LocalDb,
): Promise<{ id: string; outboxId: string }> {
  // Pages / web: never touch expo-sqlite — push account_upsert straight to Worker.
  if (!dbOverride && isWebRuntime()) {
    return upsertAccountViaApi(input);
  }

  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const outboxId = crypto.randomUUID();
  const includeNw = input.include_in_net_worth === false ? 0 : 1;
  const balance = Number(input.current_balance ?? 0);
  const archived = input.is_archived ? 1 : 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO accounts (
         id, name, currency, type, is_archived, include_in_net_worth, current_balance
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         currency = excluded.currency,
         type = excluded.type,
         is_archived = excluded.is_archived,
         include_in_net_worth = excluded.include_in_net_worth,
         current_balance = excluded.current_balance`,
      id,
      input.name,
      input.currency.toUpperCase(),
      normalizeAccountType(input.type),
      archived,
      includeNw,
      balance,
    );

    const payload = JSON.stringify({
      op: "account_upsert",
      id,
      name: input.name,
      currency: input.currency.toUpperCase(),
      type: normalizeAccountType(input.type),
      is_archived: archived === 1,
      include_in_net_worth: includeNw === 1,
      current_balance: balance,
      updated_at: now,
    });

    await db.runAsync(
      `INSERT INTO outbox (id, entity_type, entity_id, payload, created_at, attempts, last_error)
       VALUES (?, 'account', ?, ?, ?, 0, NULL)`,
      outboxId,
      id,
      payload,
      now,
    );
  });

  return { id, outboxId };
}

export async function applyRemoteAccountsSnapshot(
  snapshot: {
    rows: {
      account: Account;
      balance_account?: number;
      balance_reporting?: number;
    }[];
  },
  dbOverride?: LocalDb,
): Promise<void> {
  // Web list/create already use the Worker API; skip local mirror.
  if (!dbOverride && isWebRuntime()) return;

  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  await db.withTransactionAsync(async () => {
    for (const row of snapshot.rows) {
      const a = row.account;
      const balance =
        row.balance_account != null
          ? Number(row.balance_account)
          : Number(a.current_balance ?? 0);
      await db.runAsync(
        `INSERT OR REPLACE INTO accounts (
           id, name, currency, type, is_archived, include_in_net_worth, current_balance
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        a.id,
        a.name,
        a.currency,
        normalizeAccountType(a.type),
        a.is_archived ? 1 : 0,
        a.include_in_net_worth ? 1 : 0,
        balance,
      );
    }
  });
}

/** Test/helper export: direct API upsert (used by smoke tests). */
export const __test = {
  upsertAccountViaApi,
  fetchAccountsOverviewFromApi,
};
