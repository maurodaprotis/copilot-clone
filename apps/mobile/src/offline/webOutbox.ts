/**
 * Web / Cloudflare Pages outbox — localStorage (never expo-sqlite).
 * Used when POST /sync fails (offline / network) so Add/Save still succeed;
 * auto-drained when online, on focus, and after writes.
 */

export type WebOutboxItem = {
  id: string;
  entity_type: string;
  entity_id: string;
  payload: unknown;
  created_at: string;
  attempts: number;
  last_error: string | null;
};

const STORAGE_KEY = "copilot-clone:web-outbox:v1";

/** In-memory fallback for vitest / non-browser. */
let memoryStore: WebOutboxItem[] | null = null;

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage != null;
  } catch {
    return false;
  }
}

function readAll(): WebOutboxItem[] {
  if (canUseLocalStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as WebOutboxItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (!memoryStore) memoryStore = [];
  return memoryStore;
}

function writeAll(items: WebOutboxItem[]): void {
  if (canUseLocalStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return;
    } catch {
      // quota / private mode — fall through to memory
    }
  }
  memoryStore = items;
}

/** Test-only: wipe storage between cases. */
export function __resetWebOutboxForTests(): void {
  memoryStore = [];
  if (canUseLocalStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function listWebOutbox(): WebOutboxItem[] {
  return readAll().slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function countWebOutbox(): number {
  return readAll().length;
}

export function enqueueWebOutbox(input: {
  id?: string;
  entity_type: string;
  entity_id: string;
  payload: unknown;
}): WebOutboxItem {
  const item: WebOutboxItem = {
    id: input.id ?? crypto.randomUUID(),
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    payload: input.payload,
    created_at: new Date().toISOString(),
    attempts: 0,
    last_error: null,
  };
  const all = readAll();
  all.push(item);
  writeAll(all);
  return item;
}

export function removeWebOutboxIds(ids: string[]): void {
  if (ids.length === 0) return;
  const drop = new Set(ids);
  writeAll(readAll().filter((r) => !drop.has(r.id)));
}

export type WebDrainTransport = (
  items: unknown[],
) => Promise<{ ok: boolean; saved?: string[] }>;

/**
 * Push all pending web-outbox payloads via transport (POST /sync).
 * On success removes rows; on failure bumps attempts.
 */
export async function drainWebOutbox(
  transport: WebDrainTransport,
): Promise<{ pushed: number }> {
  const rows = listWebOutbox();
  if (rows.length === 0) return { pushed: 0 };

  const items = rows.map((r) => r.payload);
  let result: { ok: boolean; saved?: string[] };
  try {
    result = await transport(items);
  } catch {
    const next = readAll().map((r) =>
      rows.some((x) => x.id === r.id)
        ? {
            ...r,
            attempts: r.attempts + 1,
            last_error: "transport threw",
          }
        : r,
    );
    writeAll(next);
    return { pushed: 0 };
  }

  if (!result.ok) {
    const next = readAll().map((r) =>
      rows.some((x) => x.id === r.id)
        ? {
            ...r,
            attempts: r.attempts + 1,
            last_error: "transport failed",
          }
        : r,
    );
    writeAll(next);
    return { pushed: 0 };
  }

  removeWebOutboxIds(rows.map((r) => r.id));
  return { pushed: rows.length };
}

let autodrainBound = false;

/**
 * Bind window online + visibility/focus listeners to drain the web outbox.
 * Safe to call multiple times (idempotent). No-op outside the browser.
 */
export function ensureWebOutboxAutodrain(
  createTransport: () => WebDrainTransport,
): void {
  if (autodrainBound) return;
  if (typeof window === "undefined") return;
  autodrainBound = true;

  const run = () => {
    void drainWebOutbox(createTransport()).catch(() => undefined);
  };

  window.addEventListener("online", run);
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") run();
  });
}
