import type { NameRule, SplitLeg, Tag } from "@copilot-clone/domain";
import { assertBalancedSplit, equalSplitAmounts } from "@copilot-clone/domain";
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

export async function listNameRules(dbOverride?: LocalDb): Promise<NameRule[]> {
  const db = await dbOr(dbOverride);
  const rows = await db.getAllAsync<{
    id: string;
    match_type: string;
    pattern: string;
    category_id: string;
    apply_historically: number;
    updated_at: string;
  }>("SELECT * FROM name_rules ORDER BY updated_at DESC");
  return rows.map((r) => ({
    id: r.id,
    match_type: r.match_type as NameRule["match_type"],
    pattern: r.pattern,
    category_id: r.category_id,
    apply_historically: Number(r.apply_historically) === 1,
    updated_at: r.updated_at,
  }));
}

export async function upsertNameRuleLocal(
  input: {
    id?: string;
    match_type: "exact" | "contains";
    pattern: string;
    category_id: string;
    apply_historically?: boolean;
  },
  dbOverride?: LocalDb,
): Promise<string> {
  const db = await dbOr(dbOverride);
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO name_rules (id, match_type, pattern, category_id, apply_historically, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       match_type = excluded.match_type,
       pattern = excluded.pattern,
       category_id = excluded.category_id,
       apply_historically = excluded.apply_historically,
       updated_at = excluded.updated_at`,
    id,
    input.match_type,
    input.pattern,
    input.category_id,
    input.apply_historically === false ? 0 : 1,
    now,
  );
  await enqueue(db, "name_rule", id, {
    op: "rule_upsert",
    id,
    match_type: input.match_type,
    pattern: input.pattern,
    category_id: input.category_id,
    apply_historically: input.apply_historically !== false,
    updated_at: now,
  });
  return id;
}

export async function listTags(dbOverride?: LocalDb): Promise<Tag[]> {
  const db = await dbOr(dbOverride);
  const rows = await db.getAllAsync<{ id: string; name: string; color: string }>(
    "SELECT * FROM tags ORDER BY name ASC",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color }));
}

export async function upsertTagLocal(
  input: { id?: string; name: string; color?: string },
  dbOverride?: LocalDb,
): Promise<string> {
  const db = await dbOr(dbOverride);
  const id = input.id ?? crypto.randomUUID();
  const color = input.color ?? "#64748b";
  await db.runAsync(
    `INSERT INTO tags (id, name, color) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
    id,
    input.name,
    color,
  );
  await enqueue(db, "tag", id, { op: "tag_upsert", id, name: input.name, color });
  return id;
}

export async function listTxnTagIds(
  transactionId: string,
  dbOverride?: LocalDb,
): Promise<string[]> {
  const db = await dbOr(dbOverride);
  const rows = await db.getAllAsync<{ tag_id: string }>(
    "SELECT tag_id FROM transaction_tags WHERE transaction_id = ?",
    transactionId,
  );
  return rows.map((r) => r.tag_id);
}

export async function assignTagLocal(
  transactionId: string,
  tagId: string,
  dbOverride?: LocalDb,
): Promise<void> {
  const db = await dbOr(dbOverride);
  await db.runAsync(
    `INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`,
    transactionId,
    tagId,
  );
  await enqueue(db, "transaction_tag", `${transactionId}:${tagId}`, {
    op: "tag_assign",
    transaction_id: transactionId,
    tag_id: tagId,
  });
}

export async function unassignTagLocal(
  transactionId: string,
  tagId: string,
  dbOverride?: LocalDb,
): Promise<void> {
  const db = await dbOr(dbOverride);
  await db.runAsync(
    `DELETE FROM transaction_tags WHERE transaction_id = ? AND tag_id = ?`,
    transactionId,
    tagId,
  );
  await enqueue(db, "transaction_tag", `${transactionId}:${tagId}`, {
    op: "tag_unassign",
    transaction_id: transactionId,
    tag_id: tagId,
  });
}

export async function listSplitLegsLocal(
  transactionId: string,
  dbOverride?: LocalDb,
): Promise<SplitLeg[]> {
  const db = await dbOr(dbOverride);
  const rows = await db.getAllAsync<{
    id: string;
    transaction_id: string;
    category_id: string;
    amount: number;
    year_month_override: string | null;
  }>("SELECT * FROM split_legs WHERE transaction_id = ?", transactionId);
  return rows.map((r) => ({
    id: r.id,
    transaction_id: r.transaction_id,
    category_id: r.category_id,
    amount: Number(r.amount),
    year_month_override: r.year_month_override,
  }));
}

export async function setSplitLocal(
  input: {
    transaction_id: string;
    parent_amount: number;
    legs: Array<{
      id?: string;
      category_id: string;
      amount: number;
      year_month_override?: string | null;
    }>;
  },
  dbOverride?: LocalDb,
): Promise<void> {
  const db = await dbOr(dbOverride);
  assertBalancedSplit(
    input.parent_amount,
    input.legs.map((l) => ({ amount: l.amount })),
  );
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM split_legs WHERE transaction_id = ?`,
      input.transaction_id,
    );
    const persisted: Array<{
      id: string;
      category_id: string;
      amount: number;
      year_month_override: string | null;
    }> = [];
    for (const leg of input.legs) {
      const id = leg.id ?? crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO split_legs (id, transaction_id, category_id, amount, year_month_override)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        input.transaction_id,
        leg.category_id,
        leg.amount,
        leg.year_month_override ?? null,
      );
      persisted.push({
        id,
        category_id: leg.category_id,
        amount: leg.amount,
        year_month_override: leg.year_month_override ?? null,
      });
    }
    await db.runAsync(
      `UPDATE transactions SET is_split_parent = 1, updated_at = ?, synced = 0 WHERE id = ?`,
      now,
      input.transaction_id,
    );
    await enqueue(db, "split", input.transaction_id, {
      op: "split_set",
      transaction_id: input.transaction_id,
      legs: persisted,
    });
  });
}

export { equalSplitAmounts };
