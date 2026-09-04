import {
  buildAccountBalanceRows,
  normalizeAccountType,
  normalizeReviewStatus,
  type Account,
  type RateBook,
  type Transaction,
} from "@copilot-clone/domain";
import type { LocalDb } from "../db/types";
import type { LocalTransaction } from "./queries";

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

export async function listLocalAccounts(
  dbOverride?: LocalDb,
): Promise<Account[]> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<LocalAccount>(
    "SELECT * FROM accounts ORDER BY type ASC, name ASC",
  );
  return rows.map(toDomainAccount);
}

export async function getAccountsOverview(dbOverride?: LocalDb) {
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
