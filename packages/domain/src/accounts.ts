import { appliesToBalance, signedAmountAccount } from "./balance.js";
import { fx_convert } from "./fx.js";
import type { Account, AccountType, RateBook, Transaction } from "./types.js";

/** Liability account types — balance is amount owed (reduces NW). */
export function isLiabilityAccount(account: Pick<Account, "type">): boolean {
  return account.type === "credit_card" || account.type === "loan";
}

/**
 * Authoritative balance in account currency = persisted `current_balance`.
 * Txn deltas must be applied to `current_balance` on write (see applyBalanceDelta).
 */
export function computeAccountBalance(
  account: Pick<Account, "id" | "current_balance">,
  _transactions?: Transaction[],
): number {
  return account.current_balance ?? 0;
}

/** Signed effect of one txn on account.current_balance (0 if not applicable). */
export function balanceDeltaForTxn(txn: Transaction): number {
  if (!appliesToBalance(txn)) return 0;
  return signedAmountAccount(txn);
}

/**
 * Legacy/repair: opening-style balance + applicable txn deltas.
 * Used once when migrating DBs that stored opening-only current_balance.
 */
export function recomputeBalanceFromOpeningAndTxns(
  account: Pick<Account, "id" | "current_balance">,
  transactions: Transaction[],
): number {
  let balance = account.current_balance ?? 0;
  for (const txn of transactions) {
    if (txn.account_id !== account.id) continue;
    balance += balanceDeltaForTxn(txn);
  }
  return balance;
}

/** Map legacy scaffold types → spec AccountType. */
export function normalizeAccountType(raw: string | null | undefined): AccountType {
  switch (raw) {
    case "credit_card":
    case "depository":
    case "investment":
    case "loan":
    case "other":
    case "real_estate":
      return raw;
    case "cash":
      return "other";
    case "bank":
      return "depository";
    case "credit":
      return "credit_card";
    default:
      return "other";
  }
}

/** Net-worth contribution in account currency (assets +, liabilities −). */
export function netWorthContributionAccountCcy(
  account: Pick<Account, "type" | "include_in_net_worth" | "is_archived">,
  balanceAccountCcy: number,
): number {
  if (account.is_archived) return 0;
  if (!account.include_in_net_worth) return 0;
  return isLiabilityAccount(account) ? -balanceAccountCcy : balanceAccountCcy;
}

export type AccountBalanceRow = {
  account: Account;
  balance_account: number;
  balance_reporting: number;
  nw_contribution_reporting: number;
};

export function buildAccountBalanceRows(input: {
  accounts: Account[];
  transactions: Transaction[];
  reporting_currency: string;
  on_date: string;
  rate_book: RateBook;
}): {
  rows: AccountBalanceRow[];
  net_worth_reporting: number;
  reporting_currency: string;
} {
  const rows: AccountBalanceRow[] = [];
  let net_worth_reporting = 0;

  for (const account of input.accounts) {
    if (account.is_archived) continue;
    const balance_account = computeAccountBalance(account, input.transactions);
    const converted = fx_convert(
      balance_account,
      account.currency,
      input.reporting_currency,
      input.on_date,
      input.rate_book,
    );
    const balance_reporting = converted.amount;
    const nw_account = netWorthContributionAccountCcy(account, balance_account);
    const nw_converted = fx_convert(
      nw_account,
      account.currency,
      input.reporting_currency,
      input.on_date,
      input.rate_book,
    );
    const nw_contribution_reporting = nw_converted.amount;
    net_worth_reporting += nw_contribution_reporting;
    rows.push({
      account,
      balance_account,
      balance_reporting,
      nw_contribution_reporting,
    });
  }

  // Group-friendly sort: type then name
  rows.sort((a, b) => {
    const t = a.account.type.localeCompare(b.account.type);
    if (t !== 0) return t;
    return a.account.name.localeCompare(b.account.name);
  });

  return {
    rows,
    net_worth_reporting,
    reporting_currency: input.reporting_currency,
  };
}

export const ACCOUNT_TYPES: AccountType[] = [
  "credit_card",
  "depository",
  "investment",
  "loan",
  "other",
  "real_estate",
];
