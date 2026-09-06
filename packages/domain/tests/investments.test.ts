import { describe, expect, it } from "vitest";
import { buildDemoInvestmentsPayload } from "../src/investments";

describe("buildDemoInvestmentsPayload", () => {
  it("returns Copilot-web-like demo without Goals", () => {
    const p = buildDemoInvestmentsPayload("1W");
    expect(p.live_balance_estimate).toBeGreaterThan(5000);
    expect(p.live_balance_estimate).toBeLessThan(5600);
    expect(p.accounts[0]?.name).toBe("Demo Brokerage");
    expect(p.accounts[0]?.mask).toBe("5555");
    expect(p.accounts[0]?.source).toBe("Manual");
    expect(p.allocation.map((a) => a.type).sort()).toEqual(["ETF", "Equity"]);
    expect(p.holdings.map((h) => h.symbol).sort()).toEqual(["AAPL", "VTI"]);
    expect(p.top_movers.length).toBe(2);
    expect(p.goals).toEqual([]);
    expect(p.chart_settings.benchmark).toBe("None");
    expect(p.chart_settings.live_balance).toBe(true);
  });
});
