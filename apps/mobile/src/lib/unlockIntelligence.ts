/**
 * Dashboard "unlock intelligence" tile copy.
 * Must NEVER fall back to Transactions-inbox "All caught up!" — the CTA stays
 * visible even when needs_review / Not reviewed count is 0 (Phase 2 / #34 nit).
 */
export function unlockIntelligenceCopy(unlockCount: number): {
  title: string;
  body: string;
} {
  if (unlockCount > 0) {
    return {
      title: `${unlockCount} transaction${unlockCount === 1 ? "" : "s"} to unlock intelligence`,
      body: "Confirm imported activity to sharpen insights.",
    };
  }
  return {
    title: "Unlock intelligence",
    body: "This unlock CTA stays available even when your Not reviewed list is empty. Import or sync bulk activity to populate it.",
  };
}

/** Count used for unlock badge — inbox needs_review plus uncategorized regulars. */
export function computeUnlockCount(input: {
  inboxCount: number;
  uncategorizedRegularCount: number;
}): number {
  return Math.max(input.inboxCount, input.uncategorizedRegularCount);
}
