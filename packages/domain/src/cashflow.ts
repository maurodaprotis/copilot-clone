import { yearMonthFromIso } from "./budget.js";
import { appliesToBalance } from "./balance.js";
import {
  normalizeReviewStatus,
  type Category,
  type Transaction,
} from "./types.js";

function isExcluded(txn: Transaction): boolean {
  if (txn.is_excluded === true) return true;
  return normalizeReviewStatus(txn.review_status) === "excluded";
}

/** YYYY-MM-DD from ISO timestamp (UTC date). */
export function dateFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!));
}

function addDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

function daysBetweenInclusive(start: string, end: string): number {
  const a = parseYmd(start).getTime();
  const b = parseYmd(end).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

function inDateRange(iso: string, start: string, end: string): boolean {
  const d = dateFromIso(iso);
  return d >= start && d <= end;
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

/** Spend from excluded txns only (for Excluded Transactions section). */
export function cashFlowExcludedSpendDelta(txn: Transaction): number {
  if (txn.type !== "regular") return 0;
  if (!appliesToBalance(txn)) return 0;
  if (!isExcluded(txn)) return 0;
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

// --- Help Center ranges (Phase 4) -----------------------------------------

/**
 * Copilot Help Center date ranges for Cash Flow.
 * Cash Flow only looks at what happened up until today (no future / unpaid recurrings).
 */
export type CashFlowRangeKey =
  | "ytd"
  | "mtd"
  | "last_12_months"
  | "last_3_months"
  | "last_4_weeks";

export const CASH_FLOW_RANGE_KEYS: CashFlowRangeKey[] = [
  "ytd",
  "mtd",
  "last_12_months",
  "last_3_months",
  "last_4_weeks",
];

export const CASH_FLOW_RANGE_LABELS: Record<CashFlowRangeKey, string> = {
  ytd: "Year-to-date",
  mtd: "Month-to-date",
  last_12_months: "Last 12 months",
  last_3_months: "Last 3 months",
  last_4_weeks: "Last 4 weeks",
};

/** Short labels for segmented control. */
export const CASH_FLOW_RANGE_SHORT: Record<CashFlowRangeKey, string> = {
  ytd: "YTD",
  mtd: "MTD",
  last_12_months: "12M",
  last_3_months: "3M",
  last_4_weeks: "4W",
};

export function parseCashFlowRangeKey(
  raw: string | null | undefined,
): CashFlowRangeKey {
  const v = (raw ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (v === "ytd" || v === "year_to_date") return "ytd";
  if (v === "mtd" || v === "month_to_date" || v === "1m") return "mtd";
  if (v === "last_12_months" || v === "12m" || v === "1y") return "last_12_months";
  if (v === "last_3_months" || v === "3m") return "last_3_months";
  if (v === "last_4_weeks" || v === "4w") return "last_4_weeks";
  return "mtd";
}

export type CashFlowDateWindow = {
  key: CashFlowRangeKey;
  label: string;
  start: string;
  end: string;
  prior_start: string;
  prior_end: string;
};

/**
 * Resolve Help Center range windows.
 * MTD comparison uses the same day-of-month in the prior month (Help Center note).
 */
export function resolveCashFlowWindow(
  key: CashFlowRangeKey,
  now = new Date(),
): CashFlowDateWindow {
  const today = toYmd(now);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const day = now.getUTCDate();
  const label = CASH_FLOW_RANGE_LABELS[key];

  if (key === "mtd") {
    const start = `${y}-${pad2(m + 1)}-01`;
    const end = today;
    // Prior month same day-of-month clamped
    const priorMonthDate = new Date(Date.UTC(y, m - 1, 1));
    const py = priorMonthDate.getUTCFullYear();
    const pm = priorMonthDate.getUTCMonth();
    const lastDayPrior = new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();
    const priorDay = Math.min(day, lastDayPrior);
    const prior_start = `${py}-${pad2(pm + 1)}-01`;
    const prior_end = `${py}-${pad2(pm + 1)}-${pad2(priorDay)}`;
    return { key, label, start, end, prior_start, prior_end };
  }

  if (key === "ytd") {
    const start = `${y}-01-01`;
    const end = today;
    // Prior year Jan 1 → same month/day
    const prior_start = `${y - 1}-01-01`;
    const lastDayPriorYear = new Date(Date.UTC(y - 1, m + 1, 0)).getUTCDate();
    const priorDay = Math.min(day, lastDayPriorYear);
    const prior_end = `${y - 1}-${pad2(m + 1)}-${pad2(priorDay)}`;
    return { key, label, start, end, prior_start, prior_end };
  }

  if (key === "last_4_weeks") {
    const end = today;
    const start = addDays(end, -27); // 28 days inclusive
    const len = daysBetweenInclusive(start, end);
    const prior_end = addDays(start, -1);
    const prior_start = addDays(prior_end, -(len - 1));
    return { key, label, start, end, prior_start, prior_end };
  }

  // last_3_months / last_12_months: rolling calendar months ending today
  const months = key === "last_3_months" ? 3 : 12;
  const end = today;
  const startMonth = new Date(Date.UTC(y, m - (months - 1), 1));
  const start = toYmd(startMonth);
  const len = daysBetweenInclusive(start, end);
  const prior_end = addDays(start, -1);
  const prior_start = addDays(prior_end, -(len - 1));
  return { key, label, start, end, prior_start, prior_end };
}

export type CashFlowRangeTotals = {
  income: number;
  spend: number;
  net: number;
  excluded_spend: number;
  reporting_currency: string;
};

export function computeCashFlowRangeTotals(input: {
  transactions: Transaction[];
  start: string;
  end: string;
  reporting_currency?: string;
  include_excluded?: boolean;
}): CashFlowRangeTotals {
  const opts = { include_excluded: input.include_excluded === true };
  let income = 0;
  let spend = 0;
  let excluded_spend = 0;
  for (const txn of input.transactions) {
    if (!inDateRange(txn.posted_at, input.start, input.end)) continue;
    income += cashFlowIncomeDelta(txn, opts);
    spend += cashFlowSpendDelta(txn, opts);
    excluded_spend += cashFlowExcludedSpendDelta(txn);
  }
  return {
    income,
    spend,
    net: income - spend,
    excluded_spend,
    reporting_currency: input.reporting_currency ?? "USD",
  };
}

export type CashFlowCategoryBreakdown = {
  category_id: string | null;
  name: string;
  emoji: string;
  color: string;
  amount: number;
};

/**
 * Spending by category for the range (stacked-bar / View More).
 * When include_excluded is false, excluded spend is omitted here and
 * returned separately via excluded_spend total.
 */
export function cashFlowSpendByCategory(input: {
  transactions: Transaction[];
  categories?: Category[];
  start: string;
  end: string;
  include_excluded?: boolean;
}): CashFlowCategoryBreakdown[] {
  const opts = { include_excluded: input.include_excluded === true };
  const byId = new Map<string | null, number>();
  for (const txn of input.transactions) {
    if (!inDateRange(txn.posted_at, input.start, input.end)) continue;
    const delta = cashFlowSpendDelta(txn, opts);
    if (delta === 0) continue;
    const key = txn.category_id;
    byId.set(key, (byId.get(key) ?? 0) + delta);
  }
  const catMap = new Map((input.categories ?? []).map((c) => [c.id, c]));
  const rows: CashFlowCategoryBreakdown[] = [];
  for (const [category_id, amount] of byId) {
    if (Math.abs(amount) < 0.0001) continue;
    const cat = category_id ? catMap.get(category_id) : undefined;
    rows.push({
      category_id,
      name: cat?.name ?? (category_id ? "Unknown" : "Uncategorized"),
      emoji: cat?.emoji ?? "📦",
      color: cat?.color ?? "#94A3B8",
      amount,
    });
  }
  rows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return rows;
}


/** Excluded spend by category (View More → Excluded Transactions). */
export function cashFlowExcludedByCategory(input: {
  transactions: Transaction[];
  categories?: Category[];
  start: string;
  end: string;
}): CashFlowCategoryBreakdown[] {
  const byId = new Map<string | null, number>();
  for (const txn of input.transactions) {
    if (!inDateRange(txn.posted_at, input.start, input.end)) continue;
    const delta = cashFlowExcludedSpendDelta(txn);
    if (delta === 0) continue;
    const key = txn.category_id;
    byId.set(key, (byId.get(key) ?? 0) + delta);
  }
  const catMap = new Map((input.categories ?? []).map((c) => [c.id, c]));
  const rows: CashFlowCategoryBreakdown[] = [];
  for (const [category_id, amount] of byId) {
    if (Math.abs(amount) < 0.0001) continue;
    const cat = category_id ? catMap.get(category_id) : undefined;
    rows.push({
      category_id,
      name: cat?.name ?? (category_id ? "Unknown" : "Uncategorized"),
      emoji: cat?.emoji ?? "📦",
      color: cat?.color ?? "#94A3B8",
      amount,
    });
  }
  rows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return rows;
}

export type CashFlowExcludedTxnRow = {
  id: string;
  name: string;
  posted_at: string;
  amount: number;
  category_id: string | null;
  category_name: string;
  category_emoji: string;
};

/** Individual excluded regular txns in range (Help Center Excluded Transactions). */
export function cashFlowExcludedTransactions(input: {
  transactions: Transaction[];
  categories?: Category[];
  start: string;
  end: string;
}): CashFlowExcludedTxnRow[] {
  const catMap = new Map((input.categories ?? []).map((c) => [c.id, c]));
  const rows: CashFlowExcludedTxnRow[] = [];
  for (const txn of input.transactions) {
    if (!inDateRange(txn.posted_at, input.start, input.end)) continue;
    const delta = cashFlowExcludedSpendDelta(txn);
    if (delta === 0) continue;
    const cat = txn.category_id ? catMap.get(txn.category_id) : undefined;
    rows.push({
      id: txn.id,
      name: txn.name?.trim() || txn.note?.trim() || "Excluded transaction",
      posted_at: txn.posted_at,
      amount: delta,
      category_id: txn.category_id,
      category_name: cat?.name ?? (txn.category_id ? "Unknown" : "Uncategorized"),
      category_emoji: cat?.emoji ?? "📦",
    });
  }
  rows.sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  return rows;
}

export type CashFlowRangeSeriesPoint = {
  /** Bucket label (YYYY-MM or week start YYYY-MM-DD). */
  key: string;
  label: string;
  income: number;
  spend: number;
  net: number;
  /** Category stack for spend (optional density). */
  by_category?: CashFlowCategoryBreakdown[];
};

function monthLabelShort(ym: string): string {
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return names[m - 1]!;
}

/** Monthly series within [start, end] (oldest → newest). */
export function cashFlowMonthlySeriesInRange(input: {
  transactions: Transaction[];
  start: string;
  end: string;
  reporting_currency?: string;
  include_excluded?: boolean;
  categories?: Category[];
}): CashFlowRangeSeriesPoint[] {
  const startYm = input.start.slice(0, 7);
  const endYm = input.end.slice(0, 7);
  const out: CashFlowRangeSeriesPoint[] = [];
  let ym = startYm;
  // safety cap
  for (let i = 0; i < 24; i++) {
    const monthStart = `${ym}-01`;
    const nextYm = shiftYearMonth(ym, 1);
    const monthEndExclusive = `${nextYm}-01`;
    const bucketStart = monthStart < input.start ? input.start : monthStart;
    const lastDay = addDays(monthEndExclusive, -1);
    const bucketEnd = lastDay > input.end ? input.end : lastDay;
    if (bucketStart <= bucketEnd) {
      const totals = computeCashFlowRangeTotals({
        transactions: input.transactions,
        start: bucketStart,
        end: bucketEnd,
        reporting_currency: input.reporting_currency,
        include_excluded: input.include_excluded,
      });
      out.push({
        key: ym,
        label: monthLabelShort(ym),
        income: totals.income,
        spend: totals.spend,
        net: totals.net,
        by_category: cashFlowSpendByCategory({
          transactions: input.transactions,
          categories: input.categories,
          start: bucketStart,
          end: bucketEnd,
          include_excluded: input.include_excluded,
        }),
      });
    }
    if (ym === endYm) break;
    ym = nextYm;
  }
  return out;
}

/** Four weekly buckets for last_4_weeks (oldest → newest). */
export function cashFlowWeeklySeriesInRange(input: {
  transactions: Transaction[];
  start: string;
  end: string;
  reporting_currency?: string;
  include_excluded?: boolean;
  categories?: Category[];
}): CashFlowRangeSeriesPoint[] {
  const out: CashFlowRangeSeriesPoint[] = [];
  for (let w = 0; w < 4; w++) {
    const bucketStart = addDays(input.start, w * 7);
    const bucketEnd =
      w === 3 ? input.end : addDays(bucketStart, 6);
    const totals = computeCashFlowRangeTotals({
      transactions: input.transactions,
      start: bucketStart,
      end: bucketEnd,
      reporting_currency: input.reporting_currency,
      include_excluded: input.include_excluded,
    });
    out.push({
      key: bucketStart,
      label: `W${w + 1}`,
      income: totals.income,
      spend: totals.spend,
      net: totals.net,
      by_category: cashFlowSpendByCategory({
        transactions: input.transactions,
        categories: input.categories,
        start: bucketStart,
        end: bucketEnd,
        include_excluded: input.include_excluded,
      }),
    });
  }
  return out;
}

export type CashFlowRangePayload = {
  range: CashFlowRangeKey;
  range_label: string;
  start: string;
  end: string;
  prior_start: string;
  prior_end: string;
  include_excluded: boolean;
  comparison_enabled: boolean;
  income: number;
  spend: number;
  net: number;
  excluded_spend: number;
  reporting_currency: string;
  prior: CashFlowRangeTotals;
  income_delta: number;
  spend_delta: number;
  net_delta: number;
  net_delta_pct: number | null;
  series: CashFlowRangeSeriesPoint[];
  spending_by_category: CashFlowCategoryBreakdown[];
  excluded_by_category: CashFlowCategoryBreakdown[];
  excluded_transactions: CashFlowExcludedTxnRow[];
  /** Legacy month fields for older clients */
  year_month: string;
};

export function computeCashFlowRangePayload(input: {
  transactions: Transaction[];
  categories?: Category[];
  range: CashFlowRangeKey;
  include_excluded?: boolean;
  comparison_enabled?: boolean;
  reporting_currency?: string;
  now?: Date;
}): CashFlowRangePayload {
  const window = resolveCashFlowWindow(input.range, input.now ?? new Date());
  const include_excluded = input.include_excluded === true;
  const comparison_enabled = input.comparison_enabled !== false;
  const currency = input.reporting_currency ?? "USD";

  const current = computeCashFlowRangeTotals({
    transactions: input.transactions,
    start: window.start,
    end: window.end,
    reporting_currency: currency,
    include_excluded,
  });
  const prior = computeCashFlowRangeTotals({
    transactions: input.transactions,
    start: window.prior_start,
    end: window.prior_end,
    reporting_currency: currency,
    include_excluded,
  });

  const net_delta = current.net - prior.net;
  const net_delta_pct =
    prior.net === 0 ? null : (net_delta / Math.abs(prior.net)) * 100;

  const seriesInput = {
    transactions: input.transactions,
    start: window.start,
    end: window.end,
    reporting_currency: currency,
    include_excluded,
    categories: input.categories,
  };
  const series =
    input.range === "last_4_weeks"
      ? cashFlowWeeklySeriesInRange(seriesInput)
      : cashFlowMonthlySeriesInRange(seriesInput);

  const spending_by_category = cashFlowSpendByCategory({
    transactions: input.transactions,
    categories: input.categories,
    start: window.start,
    end: window.end,
    include_excluded,
  });
  const excluded_by_category = cashFlowExcludedByCategory({
    transactions: input.transactions,
    categories: input.categories,
    start: window.start,
    end: window.end,
  });
  const excluded_transactions = cashFlowExcludedTransactions({
    transactions: input.transactions,
    categories: input.categories,
    start: window.start,
    end: window.end,
  });

  return {
    range: window.key,
    range_label: window.label,
    start: window.start,
    end: window.end,
    prior_start: window.prior_start,
    prior_end: window.prior_end,
    include_excluded,
    comparison_enabled,
    income: current.income,
    spend: current.spend,
    net: current.net,
    excluded_spend: current.excluded_spend,
    reporting_currency: currency,
    prior,
    income_delta: current.income - prior.income,
    spend_delta: current.spend - prior.spend,
    net_delta,
    net_delta_pct,
    series,
    spending_by_category,
    excluded_by_category,
    excluded_transactions,
    year_month: window.end.slice(0, 7),
  };
}
