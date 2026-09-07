/**
 * Web write helper: try POST /sync first; on network / !ok, enqueue web outbox.
 * Never uses expo-sqlite. Add/Save always succeed from the caller's perspective
 * when the payload is valid (queued offline if needed).
 */

import { enqueueWebOutbox, removeWebOutboxForEntity } from "./webOutbox";
import { getApiUserId } from "../sync/userId";

const DEFAULT_API_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://copilot-clone-api.maurodaprotis.workers.dev";

export type PostSyncOptions = {
  apiUrl?: string;
  userId?: string;
  fetchImpl?: typeof fetch;
};

export async function postSyncItems(
  items: unknown[],
  options: PostSyncOptions = {},
): Promise<{ ok: boolean; saved?: string[]; error?: string }> {
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL;
  const userId = options.userId ?? getApiUserId();
  const fetchImpl = options.fetchImpl ?? fetch;

  const res = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: text || `sync failed (${res.status})` };
  }
  const data = (await res.json()) as {
    ok?: boolean;
    saved?: string[];
    error?: string;
    message?: string;
  };
  if (!data.ok) {
    return {
      ok: false,
      error: data.message || data.error || "sync not ok",
    };
  }
  const saved = Array.isArray(data.saved) ? data.saved : [];
  if (items.length > 0 && saved.length === 0) {
    return { ok: false, saved, error: "sync returned empty saved" };
  }
  return { ok: true, saved };
}

/**
 * POST one sync item; if the network/API fails, enqueue in localStorage outbox.
 * On success, drop any queued rows for the same entity (no double-apply on drain).
 */
export async function webSyncOrEnqueue(input: {
  payload: unknown;
  entity_type: string;
  entity_id: string;
  apiUrl?: string;
  userId?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ outboxId: string; queued: boolean }> {
  try {
    const result = await postSyncItems([input.payload], {
      apiUrl: input.apiUrl,
      userId: input.userId,
      fetchImpl: input.fetchImpl,
    });
    if (result.ok) {
      removeWebOutboxForEntity(input.entity_type, input.entity_id);
      return { outboxId: `web-api:${input.entity_id}`, queued: false };
    }
  } catch {
    // offline / DNS / CORS — enqueue
  }

  const row = enqueueWebOutbox({
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    payload: input.payload,
  });
  return { outboxId: row.id, queued: true };
}
