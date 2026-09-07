import type { LocalTransaction } from "./queries";

/** Keep last occurrence per id (API order is newest-first). */
export function dedupeTransactionsById<T extends { id: string }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/**
 * Reporting-currency amount for metrics. Never sum amount + amount_reporting.
 * Prefer amount_reporting; only fall back to amount when currency is already
 * the reporting currency (USD) and amount_reporting is missing/NaN.
 */
export function reportingAmountForMetrics(
  txn: Pick<LocalTransaction, "amount" | "amount_reporting" | "currency">,
  reportingCurrency = "USD",
): number {
  const reporting = Number(txn.amount_reporting);
  if (Number.isFinite(reporting)) return reporting;
  const ccy = String(txn.currency || "").toUpperCase();
  if (ccy === reportingCurrency.toUpperCase()) {
    const amt = Number(txn.amount);
    return Number.isFinite(amt) ? amt : 0;
  }
  return 0;
}

export type PeriodMetrics = {
  spent: number;
  income: number;
  net: number;
  reporting: string;
};

/**
 * Sum Total spent / income / net once per txn id, reporting USD only.
 * Soft-deleted and excluded rows are skipped by the caller (or deleted_at).
 */
export function sumPeriodMetrics(
  txns: Array<
    Pick<
      LocalTransaction,
      | "id"
      | "amount"
      | "amount_reporting"
      | "currency"
      | "type"
      | "is_refund"
      | "review_status"
    > & { deleted_at?: string | null }
  >,
  reportingCurrency = "USD",
): PeriodMetrics {
  let spent = 0;
  let income = 0;
  for (const txn of dedupeTransactionsById(txns)) {
    if (txn.deleted_at) continue;
    if (txn.review_status === "excluded") continue;
    const amt = reportingAmountForMetrics(txn, reportingCurrency);
    if (txn.type === "income") income += amt;
    else if (txn.type === "transfer") continue;
    else if (txn.is_refund) spent -= amt;
    else spent += amt;
  }
  return {
    spent,
    income,
    net: income - spent,
    reporting: reportingCurrency,
  };
}
