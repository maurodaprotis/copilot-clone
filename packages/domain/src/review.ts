import type { ReviewStatus } from "./types.js";

/**
 * Scaffold stored To Review as review_status=pending.
 * Spec uses needs_review. Accept both; normalize to pending for existing UI/tests.
 */
export function normalizeReviewStatus(status: string | null | undefined): ReviewStatus {
  if (status === "reviewed" || status === "excluded") return status;
  // needs_review and unknown → pending (To Review)
  return "pending";
}

export function isNeedsReview(status: string | null | undefined): boolean {
  return status === "pending" || status === "needs_review" || !status;
}
