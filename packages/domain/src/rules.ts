import type { NameRule, Transaction } from "./types.js";

/** Collapse whitespace + lowercase for Name Rule matching (NR1). */
export function normalizeNamePattern(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Merchant/payee used for rules: name, else note. */
export function transactionMatchName(txn: Pick<Transaction, "name" | "note">): string {
  if (txn.name != null && String(txn.name).trim() !== "") return String(txn.name);
  return txn.note ?? "";
}

export function nameRuleMatches(
  rule: Pick<NameRule, "match_type" | "pattern">,
  txnName: string,
): boolean {
  const hay = normalizeNamePattern(txnName);
  const needle = normalizeNamePattern(rule.pattern);
  if (!needle) return false;
  if (rule.match_type === "exact") return hay === needle;
  return hay.includes(needle);
}

/**
 * Last-write-wins: newest updated_at wins among matching rules.
 * Returns the winning rule or null.
 */
export function resolveNameRule(
  rules: NameRule[],
  txnName: string,
): NameRule | null {
  const matches = rules
    .filter((r) => nameRuleMatches(r, txnName))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return matches[0] ?? null;
}

/** Apply winning Name Rule category onto a txn (does not change review_status). */
export function applyNameRuleToTransaction<T extends Transaction>(
  txn: T,
  rules: NameRule[],
): T {
  const winner = resolveNameRule(rules, transactionMatchName(txn));
  if (!winner) return txn;
  return { ...txn, category_id: winner.category_id };
}

export type ApplyHistoricallyResult = {
  /** Stub: always 0 unless apply=true and matches provided. */
  applied: number;
  stub: boolean;
  matched_ids: string[];
};

/**
 * Optional historic retag. P0 ships as a stub when `apply` is false (default).
 * When apply=true, returns matching txn ids (caller persists).
 */
export function applyNameRuleHistorically(input: {
  rule: NameRule;
  transactions: Transaction[];
  /** When false (default), returns stub without scanning. */
  apply?: boolean;
}): ApplyHistoricallyResult {
  if (!input.apply) {
    return { applied: 0, stub: true, matched_ids: [] };
  }
  const matched = input.transactions.filter((t) =>
    nameRuleMatches(input.rule, transactionMatchName(t)),
  );
  return {
    applied: matched.length,
    stub: false,
    matched_ids: matched.map((t) => t.id),
  };
}
