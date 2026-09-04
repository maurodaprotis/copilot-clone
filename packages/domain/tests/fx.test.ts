import { describe, expect, it } from "vitest";
import { deriveAmounts, fx_convert } from "../src/index.js";
import type { RateBook } from "../src/index.js";

describe("fx_convert", () => {
  const book: RateBook = {
    "USD:ARS:2026-09-01": 1400,
    "EUR:USD:2026-08-01": 1.1,
  };

  it("same currency returns amount unchanged", () => {
    const r = fx_convert(100, "USD", "usd", "2026-09-01", book);
    expect(r.amount).toBe(100);
    expect(r.rate).toBe(1);
    expect(r.used_fallback).toBe(false);
  });

  it("direct rate", () => {
    const r = fx_convert(50, "USD", "ARS", "2026-09-01", book);
    expect(r.amount).toBe(70000);
    expect(r.rate).toBe(1400);
  });

  it("invert rate", () => {
    const r = fx_convert(1400, "ARS", "USD", "2026-09-01", book);
    expect(r.amount).toBeCloseTo(1, 10);
    expect(r.rate).toBeCloseTo(1 / 1400, 10);
  });

  it("fallback earlier date with warning", () => {
    const r = fx_convert(10, "EUR", "USD", "2026-09-04", book);
    expect(r.amount).toBeCloseTo(11, 10);
    expect(r.used_fallback).toBe(true);
    expect(r.warning).toMatch(/fallback/i);
  });

  it("missing rate warns and leaves amount", () => {
    const r = fx_convert(10, "GBP", "JPY", "2026-09-04", book);
    expect(r.amount).toBe(10);
    expect(r.rate).toBeNull();
    expect(r.warning).toMatch(/No FX rate/);
  });
});

describe("deriveAmounts Argentina-first case", () => {
  it("USD expense on ARS account with rate 1400 → account 70000, reporting USD 50", () => {
    const book: RateBook = {
      "USD:ARS:2026-09-01": 1400,
    };
    const result = deriveAmounts({
      amount: 50,
      currency: "USD",
      account_currency: "ARS",
      reporting_currency: "USD",
      on_date: "2026-09-01",
      rate_book: book,
    });
    expect(result.amount_account).toBe(70000);
    expect(result.amount_reporting).toBe(50);
  });
});
