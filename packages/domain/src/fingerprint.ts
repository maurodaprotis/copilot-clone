/**
 * Stable fingerprint for duplicate detection of imported / synced transactions.
 * Does not include id or review fields.
 */
export function transactionFingerprint(input: {
  account_id: string;
  amount: number;
  currency: string;
  type: string;
  posted_at: string;
  note?: string | null;
  transfer_pair_id?: string | null;
}): string {
  const parts = [
    input.account_id,
    input.amount.toFixed(4),
    input.currency.toUpperCase(),
    input.type,
    input.posted_at.slice(0, 10),
    (input.note ?? "").trim().toLowerCase(),
    input.transfer_pair_id ?? "",
  ];
  return parts.join("|");
}
