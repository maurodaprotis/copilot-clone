import { API_URL } from "../config";
import { getApiUserId } from "./userId";
import { applyRemoteAccountsSnapshot } from "../offline/accounts";
import type { Account } from "@copilot-clone/domain";

export async function pullAccountsFromApi(options?: {
  apiUrl?: string;
  userId?: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const apiUrl = options?.apiUrl ?? API_URL;
  const userId = options?.userId ?? getApiUserId();
  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const res = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/accounts`, {
      headers: { "x-user-id": userId },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      rows?: { account: Account }[];
    };
    await applyRemoteAccountsSnapshot({ rows: data.rows ?? [] });
    return true;
  } catch {
    return false;
  }
}
