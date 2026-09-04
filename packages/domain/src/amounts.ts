import { fx_convert } from "./fx.js";
import type { RateBook } from "./types.js";

/**
 * Derive amount_account and amount_reporting for a transaction.
 * Example: USD 50 expense on ARS account with USD->ARS rate 1400
 * → amount_account 70000, amount_reporting 50 (reporting USD).
 */
export function deriveAmounts(input: {
  amount: number;
  currency: string;
  account_currency: string;
  reporting_currency: string;
  on_date: string;
  rate_book: RateBook;
}): {
  amount_account: number;
  amount_reporting: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  const toAccount = fx_convert(
    input.amount,
    input.currency,
    input.account_currency,
    input.on_date,
    input.rate_book,
  );
  if (toAccount.warning) warnings.push(toAccount.warning);

  const toReporting = fx_convert(
    input.amount,
    input.currency,
    input.reporting_currency,
    input.on_date,
    input.rate_book,
  );
  if (toReporting.warning) warnings.push(toReporting.warning);

  return {
    amount_account: toAccount.amount,
    amount_reporting: toReporting.amount,
    warnings,
  };
}
