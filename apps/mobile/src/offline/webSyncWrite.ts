/**
 * Web write helper: try POST /sync first; on network / !ok, enqueue web outbox.
 * Never uses expo-sqlite. Add/Save always succeed from the caller's perspective
 * when the payload is valid (queued offline if needed).
 */

import { enqueueWebOutbox } from "./webOutbox";

const DEFAULT_API_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://copilot-clone-api.maurodaprotis.workers.dev";
const DEFAULT_USER_ID = "demo-user";

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
  const userId = options.userId ?? DEFAULT_USER_ID;
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
  return { ok: true, saved: data.saved };
}

/**
 * POST one sync item; if the network/API fails, queue in localStorage outbox.
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
      return { outboxId: `web-api:${input.entity_id}`, queued: false };
    }
  } catch {
    // offline / DNS / CORS — queue
  }

  const row = enqueueWebOutbox({
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    payload: input.payload,
  });
  return { outboxId: row.id, queued: true };
}
