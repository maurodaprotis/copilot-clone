import { describe, expect, it } from "vitest";
import { normalizeReviewStatus } from "@copilot-clone/domain";

/** Mirrors Transactions screen filter chip: Not excluded. */
function matchesNotExcluded(reviewStatus: string): boolean {
  return normalizeReviewStatus(reviewStatus) !== "excluded";
}

describe("Transactions Not excluded filter chip", () => {
  it("hides excluded, keeps reviewed / needs_review", () => {
    expect(matchesNotExcluded("excluded")).toBe(false);
    expect(matchesNotExcluded("reviewed")).toBe(true);
    expect(matchesNotExcluded("needs_review")).toBe(true);
    expect(matchesNotExcluded("pending")).toBe(true); // legacy → needs_review
  });
});
