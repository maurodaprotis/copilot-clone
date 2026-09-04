import type { Recurring, RecurringCadence, RecurringKind } from "@copilot-clone/domain";
import {
  DEFAULT_UPCOMING_WITHIN_DAYS,
  upcomingRecurrings,
} from "@copilot-clone/domain";
import { API_URL, DEMO_USER_ID } from "../config";
import type { LocalDb } from "../db/types";

async function dbOr(dbOverride?: LocalDb): Promise<LocalDb> {
  return dbOverride ?? (await (await import("../db/client")).getDb());
}

async function enqueue(
  db: LocalDb,
  entity_type: string,
  entity_id: string,
  payload: unknown,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO outbox (id, entity_type, entity_id, payload, created_at, attempts, last_error)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`,
    id,
    entity_type,
    entity_id,
    JSON.stringify(payload),
    now,
  );
  return id;
}

function mapRow(r: {
  id: string;
  name: string;
  kind: string;
  cadence: string;
  expected_amount: number;
  currency: string;
  category_id: string | null;
  account_id: string | null;
  next_expected_date: string;
  active: number;
  updated_at: string;
}): Recurring {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as RecurringKind,
    cadence: r.cadence as RecurringCadence,
    expected_amount: Number(r.expected_amount),
    currency: r.currency,
    category_id: r.category_id,
    account_id: r.account_id,
    next_expected_date: r.next_expected_date.slice(0, 10),
    active: Number(r.active) === 1,
    updated_at: r.updated_at,
  };
}

export async function listRecurringsLocal(
  dbOverride?: LocalDb,
): Promise<Recurring[]> {
  const db = await dbOr(dbOverride);
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    kind: string;
    cadence: string;
    expected_amount: number;
    currency: string;
    category_id: string | null;
    account_id: string | null;
    next_expected_date: string;
    active: number;
    updated_at: string;
  }>("SELECT * FROM recurrings ORDER BY next_expected_date ASC, name ASC");
  return rows.map(mapRow);
}

export async function listUpcomingLocal(
  withinDays = DEFAULT_UPCOMING_WITHIN_DAYS,
  dbOverride?: LocalDb,
): Promise<Recurring[]> {
  const all = await listRecurringsLocal(dbOverride);
  return upcomingRecurrings(all, { within_days: withinDays });
}

export async function upsertRecurringLocal(
  input: {
    id?: string;
    name: string;
    kind: RecurringKind;
    cadence: RecurringCadence;
    expected_amount: number;
    currency: string;
    category_id?: string | null;
    account_id?: string | null;
    next_expected_date: string;
    active?: boolean;
  },
  dbOverride?: LocalDb,
): Promise<string> {
  const db = await dbOr(dbOverride);
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const active = input.active === false ? 0 : 1;
  await db.runAsync(
    `INSERT INTO recurrings (
       id, name, kind, cadence, expected_amount, currency,
       category_id, account_id, next_expected_date, active, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       kind = excluded.kind,
       cadence = excluded.cadence,
       expected_amount = excluded.expected_amount,
       currency = excluded.currency,
       category_id = excluded.category_id,
       account_id = excluded.account_id,
       next_expected_date = excluded.next_expected_date,
       active = excluded.active,
       updated_at = excluded.updated_at`,
    id,
    input.name,
    input.kind,
    input.cadence,
    Number(input.expected_amount),
    input.currency.toUpperCase(),
    input.category_id ?? null,
    input.account_id ?? null,
    input.next_expected_date.slice(0, 10),
    active,
    now,
  );
  await enqueue(db, "recurring", id, {
    op: "recurring_upsert",
    id,
    name: input.name,
    kind: input.kind,
    cadence: input.cadence,
    expected_amount: Number(input.expected_amount),
    currency: input.currency.toUpperCase(),
    category_id: input.category_id ?? null,
    account_id: input.account_id ?? null,
    next_expected_date: input.next_expected_date.slice(0, 10),
    active: active === 1,
    updated_at: now,
  });
  return id;
}

export async function pullRecurringsFromApi(
  withinDays = DEFAULT_UPCOMING_WITHIN_DAYS,
): Promise<{ recurrings: Recurring[]; upcoming: Recurring[] }> {
  const url = `${API_URL.replace(/\/$/, "")}/recurrings?within_days=${withinDays}`;
  const res = await fetch(url, { headers: { "x-user-id": DEMO_USER_ID } });
  if (!res.ok) throw new Error(`GET /recurrings ${res.status}`);
  const data = (await res.json()) as {
    recurrings?: Recurring[];
    upcoming?: Recurring[];
  };
  const recurrings = data.recurrings ?? [];
  try {
    const db = await dbOr();
    for (const r of recurrings) {
      await db.runAsync(
        `INSERT INTO recurrings (
           id, name, kind, cadence, expected_amount, currency,
           category_id, account_id, next_expected_date, active, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           kind = excluded.kind,
           cadence = excluded.cadence,
           expected_amount = excluded.expected_amount,
           currency = excluded.currency,
           category_id = excluded.category_id,
           account_id = excluded.account_id,
           next_expected_date = excluded.next_expected_date,
           active = excluded.active,
           updated_at = excluded.updated_at`,
        r.id,
        r.name,
        r.kind,
        r.cadence,
        Number(r.expected_amount),
        r.currency,
        r.category_id,
        r.account_id,
        r.next_expected_date.slice(0, 10),
        r.active ? 1 : 0,
        r.updated_at,
      );
    }
  } catch {
    // web SQLite may no-op; still return API payload
  }
  return {
    recurrings,
    upcoming: data.upcoming ?? upcomingRecurrings(recurrings, { within_days: withinDays }),
  };
}
