/**
 * Web category create/rename via Worker category_upsert (never expo-sqlite on Pages).
 */
import { isWebRuntime } from "../db/runtime";
import type { LocalDb } from "../db/types";
import { webSyncOrEnqueue } from "./webSyncWrite";

const DEFAULT_API_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://copilot-clone-api.maurodaprotis.workers.dev";

export type CategoryUpsertInput = {
  id?: string;
  name: string;
  group_id?: string;
  emoji?: string;
  color?: string;
  is_income_category?: boolean;
  exclude_from_budget?: boolean;
  archived?: boolean;
  sort_order?: number;
};

export async function upsertCategory(
  input: CategoryUpsertInput,
  options?: {
    apiUrl?: string;
    userId?: string;
    fetchImpl?: typeof fetch;
    dbOverride?: LocalDb;
  },
): Promise<{ id: string; outboxId: string; queued?: boolean }> {
  const id = input.id ?? crypto.randomUUID();
  const isIncome = !!input.is_income_category;
  const payload = {
    op: "category_upsert" as const,
    id,
    name: input.name.trim(),
    group_id: input.group_id ?? (isIncome ? "grp-income" : "grp-other"),
    emoji: input.emoji ?? (isIncome ? "💵" : "💸"),
    color: input.color ?? (isIncome ? "#10B981" : "#94a3b8"),
    is_income_category: isIncome,
    exclude_from_budget:
      input.exclude_from_budget == null ? isIncome : !!input.exclude_from_budget,
    archived: !!input.archived,
    sort_order: input.sort_order ?? 100,
  };

  if (!options?.dbOverride && isWebRuntime()) {
    const result = await webSyncOrEnqueue({
      payload,
      entity_type: "category",
      entity_id: id,
      apiUrl: options?.apiUrl,
      userId: options?.userId,
      fetchImpl: options?.fetchImpl,
    });
    return { id, outboxId: result.outboxId, queued: result.queued };
  }

  // Native / tests: write local + outbox (or direct API when no db).
  if (!options?.dbOverride) {
    const result = await webSyncOrEnqueue({
      payload,
      entity_type: "category",
      entity_id: id,
      apiUrl: options?.apiUrl ?? DEFAULT_API_URL,
      userId: options?.userId,
      fetchImpl: options?.fetchImpl,
    });
    return { id, outboxId: result.outboxId, queued: result.queued };
  }

  const db = options.dbOverride;
  const now = new Date().toISOString();
  const outboxId = crypto.randomUUID();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO categories (
         id, group_id, name, emoji, color,
         exclude_from_budget, is_income_category, archived, sort_order
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         group_id = excluded.group_id,
         name = excluded.name,
         emoji = excluded.emoji,
         color = excluded.color,
         exclude_from_budget = excluded.exclude_from_budget,
         is_income_category = excluded.is_income_category,
         archived = excluded.archived,
         sort_order = excluded.sort_order`,
      id,
      payload.group_id,
      payload.name,
      payload.emoji,
      payload.color,
      payload.exclude_from_budget ? 1 : 0,
      payload.is_income_category ? 1 : 0,
      payload.archived ? 1 : 0,
      payload.sort_order,
    );
    await db.runAsync(
      `INSERT INTO outbox (id, entity_type, entity_id, payload, created_at, attempts, last_error)
       VALUES (?, 'category', ?, ?, ?, 0, NULL)`,
      outboxId,
      id,
      JSON.stringify(payload),
      now,
    );
  });
  return { id, outboxId, queued: false };
}
