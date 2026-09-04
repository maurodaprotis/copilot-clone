import {
  computeCashFlowWithPrior,
  currentYearMonth,
  normalizeReviewStatus,
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

export async function getCashFlowOverview(
  yearMonth = currentYearMonth(),
  dbOverride?: LocalDb,
) {
  const db = dbOverride ?? (await (await import("../db/client")).getDb());
  const rows = await db.getAllAsync<LocalTransaction>(
    "SELECT * FROM transactions",
  );
  return computeCashFlowWithPrior({
    transactions: rows.map(toDomainTxn),
    year_month: yearMonth,
    reporting_currency: "USD",
  });
}
