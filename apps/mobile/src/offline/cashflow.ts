import {
  computeCashFlowRangePayload,
  computeCashFlowWithPrior,
  currentYearMonth,
  normalizeReviewStatus,
  parseCashFlowRangeKey,
  type CashFlowRangeKey,
  type Transaction,
} from "@copilot-clone/domain";
import type { LocalDb } from "../db/types";
import type { LocalTransaction } from "./queries";

function toDomainTxn(row: LocalTransaction): Transaction {
  return {
    id: row.id,
    account_id: row.account_id,
    category_id: row.category_id,
    amount: row.amount,
    currency: row.currency,
    amount_account: row.amount_account,
    amount_reporting: row.amount_reporting,
    type: row.type as Transaction["type"],
    is_refund: row.is_refund === 1,
    review_status: normalizeReviewStatus(row.review_status),
    status: "posted",
    posted_at: row.posted_at,
    note: row.note,
    transfer_pair_id: null,
    fingerprint: row.fingerprint,
  };
}

async function loadTxns(dbOverride?: LocalDb): Promise<Transaction[]> {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<LocalTransaction>(
    "SELECT * FROM transactions",
  );
  return rows.map(toDomainTxn);
}

export async function getCashFlowOverview(
  yearMonth = currentYearMonth(),
  dbOverride?: LocalDb,
) {
  const transactions = await loadTxns(dbOverride);
  return computeCashFlowWithPrior({
    transactions,
    year_month: yearMonth,
    reporting_currency: "USD",
  });
}

export async function getCashFlowRangeOverview(
  opts: {
    range?: CashFlowRangeKey | string;
    include_excluded?: boolean;
    comparison?: boolean;
  } = {},
  dbOverride?: LocalDb,
) {
  const transactions = await loadTxns(dbOverride);
  return computeCashFlowRangePayload({
    transactions,
    range: parseCashFlowRangeKey(opts.range ?? "mtd"),
    include_excluded: opts.include_excluded === true,
    comparison_enabled: opts.comparison !== false,
    reporting_currency: "USD",
  });
}
