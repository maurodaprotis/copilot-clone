import { yearMonthFromIso } from "./budget.js";
import { appliesToBalance } from "./balance.js";
import {
  normalizeReviewStatus,
  type Transaction,
} from "./types.js";

function isExcluded(txn: Transaction): boolean {
  if (txn.is_excluded === true) return true;
  return normalizeReviewStatus(txn.review_status) === "excluded";
}

/** Income contribution (reporting currency). Positive for income. */
export function cashFlowIncomeDelta(
  txn: Transaction,
  opts?: { include_excluded?: boolean },
): number {
  if (txn.type !== "income") return 0;
  if (!appliesToBalance(txn)) return 0;
  if (!opts?.include_excluded && isExcluded(txn)) return 0;
  return txn.amount_reporting;
}

/**
 * Spend contribution (reporting currency).
 * Spend is positive; refunds net negative against spend (CF2).
 */
export function cashFlowSpendDelta(
  txn: Transaction,
  opts?: { include_excluded?: boolean },
): number {
  if (txn.type !== "regular") return 0;
  if (!appliesToBalance(txn)) return 0;
  if (!opts?.include_excluded && isExcluded(txn)) return 0;
  const amt = txn.amount_reporting;
  return txn.is_refund ? -amt : amt;
}

export type CashFlowSummary = {
  year_month: string;
  income: number;
  spend: number;
  net: number;
  reporting_currency: string;
};

export function computeCashFlow(input: {
  transactions: Transaction[];
  year_month: string;
  reporting_currency?: string;
  include_excluded?: boolean;
}): CashFlowSummary {
  const opts = { include_excluded: input.include_excluded === true };
  let income = 0;
  let spend = 0;
  for (const txn of input.transactions) {
    if (yearMonthFromIso(txn.posted_at) !== input.year_month) continue;
    // Transfers omitted (CF3)
    income += cashFlowIncomeDelta(txn, opts);
    spend += cashFlowSpendDelta(txn, opts);
  }
  return {
    year_month: input.year_month,
    income,
    spend,
    net: income - spend,
    reporting_currency: input.reporting_currency ?? "USD",
  };
}

/** Shift YYYY-MM by delta months (can be negative). */
export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function priorYearMonth(yearMonth: string): string {
  return shiftYearMonth(yearMonth, -1);
}

export type CashFlowComparison = CashFlowSummary & {
  prior: CashFlowSummary;
  income_delta: number;
  spend_delta: number;
  net_delta: number;
  net_delta_pct: number | null;
};

export function computeCashFlowWithPrior(input: {
  transactions: Transaction[];
  year_month: string;
  reporting_currency?: string;
  include_excluded?: boolean;
}): CashFlowComparison {
  const current = computeCashFlow(input);
  const priorYm = priorYearMonth(input.year_month);
  const prior = computeCashFlow({ ...input, year_month: priorYm });
  const net_delta = current.net - prior.net;
  const net_delta_pct =
    prior.net === 0 ? null : (net_delta / Math.abs(prior.net)) * 100;
  return {
    ...current,
    prior,
    income_delta: current.income - prior.income,
    spend_delta: current.spend - prior.spend,
    net_delta,
    net_delta_pct,
  };
}

export type CashFlowSeriesPoint = CashFlowSummary;

/** Last `months` calendar months ending at year_month (inclusive), oldest → newest. */
export function cashFlowSeries(input: {
  transactions: Transaction[];
  year_month: string;
  months?: number;
  reporting_currency?: string;
  include_excluded?: boolean;
}): CashFlowSeriesPoint[] {
  const n = Math.max(1, Math.min(input.months ?? 6, 24));
  const out: CashFlowSeriesPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ym = shiftYearMonth(input.year_month, -i);
    out.push(
      computeCashFlow({
        transactions: input.transactions,
        year_month: ym,
        reporting_currency: input.reporting_currency,
        include_excluded: input.include_excluded,
      }),
    );
  }
  return out;
}
