import { currentYearMonth } from "@copilot-clone/domain";
import { API_URL } from "../config";
import { isWebRuntime } from "../db/runtime";
import { listAllTransactions } from "../offline/queries";
import { pullAccountsFromApi } from "./pullAccounts";
import { pullCategoriesFromApi } from "./pullCategories";
import { getApiUserId } from "./userId";

/**
 * On web mount: pull demo-user API into local mirrors and warm GETs so
 * Dashboard / Transactions / Categories / Accounts populate without Sync.
 */
export async function prefetchWebApiData(): Promise<void> {
  if (!isWebRuntime()) return;
  const userId = getApiUserId();
  const base = API_URL.replace(/\/$/, "");
  const headers = { "x-user-id": userId };
  const month = encodeURIComponent(currentYearMonth());

  await Promise.allSettled([
    pullCategoriesFromApi({ userId }),
    pullAccountsFromApi({ userId }),
    // Web listAllTransactions hits GET /transactions (Pages has no durable sqlite).
    listAllTransactions(),
    fetch(`${base}/dashboard/spending?month=${month}`, { headers }),
    fetch(`${base}/cash-flow?range=mtd&comparison=true&include_excluded=false`, { headers }),
    fetch(`${base}/investments?range=1W`, { headers }),
  ]);
}
