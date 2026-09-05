import { API_URL } from "../config";
import { getApiUserId } from "./userId";
import { applyRemoteCategoriesSnapshot } from "../offline/budgets";
import { currentYearMonth } from "@copilot-clone/domain";

export async function pullCategoriesFromApi(options?: {
  apiUrl?: string;
  userId?: string;
  month?: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const apiUrl = options?.apiUrl ?? API_URL;
  const userId = options?.userId ?? getApiUserId();
  const month = options?.month ?? currentYearMonth();
  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const res = await fetchImpl(
      `${apiUrl.replace(/\/$/, "")}/categories?month=${encodeURIComponent(month)}`,
      { headers: { "x-user-id": userId } },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as {
      groups: Parameters<typeof applyRemoteCategoriesSnapshot>[0]["groups"];
      categories: Parameters<typeof applyRemoteCategoriesSnapshot>[0]["categories"];
      budgets: Parameters<typeof applyRemoteCategoriesSnapshot>[0]["budgets"];
    };
    await applyRemoteCategoriesSnapshot({
      groups: data.groups ?? [],
      categories: data.categories ?? [],
      budgets: data.budgets ?? [],
    });
    return true;
  } catch {
    return false;
  }
}
