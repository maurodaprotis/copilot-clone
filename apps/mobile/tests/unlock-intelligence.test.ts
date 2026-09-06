import { describe, expect, it } from "vitest";
import {
  computeUnlockCount,
  unlockIntelligenceCopy,
} from "../src/lib/unlockIntelligence";

describe("unlockIntelligenceCopy (#34 nit)", () => {
  it("never returns All caught up when inbox / unlock count is 0", () => {
    const copy = unlockIntelligenceCopy(0);
    expect(copy.title).toBe("Unlock intelligence");
    expect(copy.title.toLowerCase()).not.toContain("all caught up");
    expect(copy.body.toLowerCase()).not.toContain("all caught up");
  });

  it("uses count copy when unlockCount > 0", () => {
    expect(unlockIntelligenceCopy(1).title).toBe(
      "1 transaction to unlock intelligence",
    );
    expect(unlockIntelligenceCopy(16).title).toBe(
      "16 transactions to unlock intelligence",
    );
  });

  it("computeUnlockCount prefers the larger of inbox vs uncategorized", () => {
    expect(
      computeUnlockCount({ inboxCount: 0, uncategorizedRegularCount: 3 }),
    ).toBe(3);
    expect(
      computeUnlockCount({ inboxCount: 5, uncategorizedRegularCount: 2 }),
    ).toBe(5);
    expect(
      computeUnlockCount({ inboxCount: 0, uncategorizedRegularCount: 0 }),
    ).toBe(0);
  });
});
