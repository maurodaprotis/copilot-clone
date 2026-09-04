import { API_URL, DEMO_USER_ID } from "../config";
import type { SyncTransport } from "../offline/syncOutbox";

export type CreateApiTransportOptions = {
  apiUrl?: string;
  userId?: string;
  fetchImpl?: typeof fetch;
};

/** Real HTTP transport: POST /sync → Worker → UserDO. */
export function createApiTransport(
  options: CreateApiTransportOptions = {},
): SyncTransport {
  const apiUrl = options.apiUrl ?? API_URL;
  const userId = options.userId ?? DEMO_USER_ID;
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (items) => {
    const res = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      return { ok: false };
    }
    const data = (await res.json()) as { ok?: boolean; saved?: string[] };
    return { ok: Boolean(data.ok), saved: data.saved };
  };
}
