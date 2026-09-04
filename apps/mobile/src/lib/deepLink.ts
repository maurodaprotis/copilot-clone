import * as Linking from "expo-linking";
import { addExpenseOffline } from "../offline/addExpenseOffline";

/**
 * Handle scheme URLs like:
 * copilotclone://expense?amount=50&currency=USD&account_id=acc1&account_currency=ARS&reporting_currency=USD
 */
export async function handleIncomingUrl(url: string): Promise<boolean> {
  const parsed = Linking.parse(url);
  if (!url.includes("expense")) return false;
  const q = parsed.queryParams ?? {};
  const amount = Number(q.amount);
  const currency = String(q.currency ?? "ARS");
  const account_id = String(q.account_id ?? "");
  const account_currency = String(q.account_currency ?? currency);
  const reporting_currency = String(q.reporting_currency ?? "USD");
  if (!account_id || !Number.isFinite(amount) || amount <= 0) return false;

  await addExpenseOffline({
    account_id,
    amount,
    currency,
    account_currency,
    reporting_currency,
    note: q.note ? String(q.note) : null,
  });
  return true;
}

export function expenseDeepLink(params: {
  amount: number;
  currency: string;
  account_id: string;
  account_currency: string;
  reporting_currency: string;
  note?: string;
}): string {
  const queryParams: Record<string, string> = {
    amount: String(params.amount),
    currency: params.currency,
    account_id: params.account_id,
    account_currency: params.account_currency,
    reporting_currency: params.reporting_currency,
  };
  if (params.note) queryParams.note = params.note;
  return Linking.createURL("expense", { queryParams });
}
