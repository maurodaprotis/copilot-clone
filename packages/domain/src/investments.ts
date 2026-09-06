/**
 * Phase 4C Investments — Copilot web parity (no Goals, no Plaid required).
 * Demo Brokerage + VTI/AAPL skin; Worker can serve this payload as-is.
 */

export type InvestmentRangeKey = "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

export const INVESTMENT_RANGE_KEYS: InvestmentRangeKey[] = [
  "1W",
  "1M",
  "3M",
  "YTD",
  "1Y",
  "ALL",
];

export type InvestmentSecurityType = "ETF" | "Equity" | "Mutual Fund" | "Cash" | "Other";

export type InvestmentHolding = {
  id: string;
  symbol: string;
  name: string;
  type: InvestmentSecurityType;
  last_price: number;
  day_change_pct: number;
  quantity: number;
  my_equity: number;
  account_id: string;
  sparkline: number[];
};

export type InvestmentAccount = {
  id: string;
  name: string;
  mask: string;
  source: "Manual" | "Linked";
  balance: number;
  live_balance: boolean;
  hidden: boolean;
  closed: boolean;
  type: "investment";
};

export type InvestmentAllocationSlice = {
  type: InvestmentSecurityType;
  percent: number;
  amount: number;
};

export type InvestmentChartPoint = {
  t: string;
  value: number;
};

export type InvestmentsPayload = {
  live_balance_estimate: number;
  day_change_pct: number;
  range: InvestmentRangeKey;
  chart: InvestmentChartPoint[];
  top_movers: InvestmentHolding[];
  accounts: InvestmentAccount[];
  allocation: InvestmentAllocationSlice[];
  holdings: InvestmentHolding[];
  chart_settings: {
    display_balance: boolean;
    benchmark: "None" | string;
    live_balance: boolean;
    accounts_included: string[];
  };
  /** Explicit: Copilot web Investments has no Goals surface. */
  goals: never[];
};

const DEMO_ACCOUNT_ID = "acc-demo-brokerage";

function spark(seed: number, n = 12, drift = 0): number[] {
  const out: number[] = [];
  let v = 100 + seed;
  for (let i = 0; i < n; i++) {
    v += Math.sin((i + seed) * 0.7) * 1.4 + drift;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

function chartForRange(range: InvestmentRangeKey, endValue: number): InvestmentChartPoint[] {
  const days =
    range === "1W"
      ? 7
      : range === "1M"
        ? 30
        : range === "3M"
          ? 90
          : range === "YTD"
            ? 248
            : range === "1Y"
              ? 365
              : 520;
  const now = new Date();
  const points: InvestmentChartPoint[] = [];
  // Flat-ish history with a slight rise into live estimate (matches Copilot demo skin).
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const progress = 1 - i / Math.max(1, days);
    const value = endValue * (0.985 + progress * 0.015);
    points.push({
      t: d.toISOString().slice(0, 10),
      value: Math.round(value * 100) / 100,
    });
  }
  // Keep last point exact.
  if (points.length) points[points.length - 1]!.value = endValue;
  return points;
}

/** Demo payload matching Copilot web Investments (manual Demo Brokerage). */
export function buildDemoInvestmentsPayload(
  range: InvestmentRangeKey = "1W",
): InvestmentsPayload {
  const vtiPrice = 289.42;
  const aaplPrice = 227.15;
  // Target Copilot demo live balance ≈ $5,397 (70% ETF / 30% Equity).
  const live = 5397;
  const vtiEquity = Math.round(live * 0.7 * 100) / 100;
  const aaplEquity = Math.round((live - vtiEquity) * 100) / 100;
  const vtiQty = Math.round((vtiEquity / vtiPrice) * 10000) / 10000;
  const aaplQty = Math.round((aaplEquity / aaplPrice) * 10000) / 10000;

  const holdings: InvestmentHolding[] = [
    {
      id: "hold-vti",
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      type: "ETF",
      last_price: vtiPrice,
      day_change_pct: -0.32,
      quantity: vtiQty,
      my_equity: vtiEquity,
      account_id: DEMO_ACCOUNT_ID,
      sparkline: spark(3, 14, -0.15),
    },
    {
      id: "hold-aapl",
      symbol: "AAPL",
      name: "Apple Inc.",
      type: "Equity",
      last_price: aaplPrice,
      day_change_pct: -2.5,
      quantity: aaplQty,
      my_equity: aaplEquity,
      account_id: DEMO_ACCOUNT_ID,
      sparkline: spark(7, 14, -0.35),
    },
  ];

  const accounts: InvestmentAccount[] = [
    {
      id: DEMO_ACCOUNT_ID,
      name: "Demo Brokerage",
      mask: "5555",
      source: "Manual",
      balance: live,
      live_balance: true,
      hidden: false,
      closed: false,
      type: "investment",
    },
  ];

  const allocation: InvestmentAllocationSlice[] = [
    {
      type: "ETF",
      percent: 70,
      amount: Math.round(live * 0.7 * 100) / 100,
    },
    {
      type: "Equity",
      percent: 30,
      amount: Math.round(live * 0.3 * 100) / 100,
    },
  ];

  // Top movers sorted by |day change| then last price label default.
  const top_movers = [...holdings].sort(
    (a, b) => Math.abs(b.day_change_pct) - Math.abs(a.day_change_pct),
  );

  return {
    live_balance_estimate: live,
    day_change_pct: 0,
    range,
    chart: chartForRange(range, live),
    top_movers,
    accounts,
    allocation,
    holdings,
    chart_settings: {
      display_balance: true,
      benchmark: "None",
      live_balance: true,
      accounts_included: [DEMO_ACCOUNT_ID],
    },
    goals: [],
  };
}
