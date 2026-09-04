import type { FxRate, FxSeries, RateBook } from "./types.js";

export const DEMO_USD_ARS_RATE = 1400;
export const DEMO_FX_AS_OF = "2026-09-01";
export const DEMO_FX_SERIES: FxSeries = "parallel";

export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function seedFxRates(now: Date = new Date()): FxRate[] {
  const recent = todayIsoDate(now);
  const dates = recent === DEMO_FX_AS_OF ? [DEMO_FX_AS_OF] : [DEMO_FX_AS_OF, recent];
  return dates.map((on_date) => ({
    from: "USD",
    to: "ARS",
    on_date,
    rate: DEMO_USD_ARS_RATE,
    rate_book: DEMO_FX_SERIES,
    source: "manual" as const,
  }));
}

export function seedRateBook(now: Date = new Date()): RateBook {
  const book: RateBook = {};
  for (const row of seedFxRates(now)) {
    book[`${row.from}:${row.to}:${row.on_date}`] = row.rate;
  }
  return book;
}

export const SEED_RATE_BOOK: RateBook = seedRateBook(
  new Date(`${DEMO_FX_AS_OF}T00:00:00.000Z`),
);
