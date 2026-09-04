import { describe, expect, it } from "vitest";
import {
  applyCsvMapping, importFingerprint, parseCsvText, suggestCsvMapping,
  signedAmountToTxn, transactionFingerprint,
} from "../src/index.js";

describe("parseCsvText", () => {
  it("parses headers and quoted commas", () => {
    const csv = `date,description,amount\n2026-09-01,"Coffee, Inc",-4.50\n2026-09-02,Paycheck,1000`;
    const t = parseCsvText(csv);
    expect(t.headers).toEqual(["date", "description", "amount"]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toEqual(["2026-09-01", "Coffee, Inc", "-4.50"]);
  });
});

describe("suggestCsvMapping + apply", () => {
  it("maps amount column", () => {
    const csv = `Fecha,Detalle,Importe\n01/09/2026,Starbucks,-12.5\n02/09/2026,Salary,100`;
    const table = parseCsvText(csv);
    const mapping = suggestCsvMapping(table.headers);
    expect(mapping.amount).toBe("Importe");
    const rows = applyCsvMapping(table, mapping);
    expect(rows).toHaveLength(2);
    expect(signedAmountToTxn(rows[0]!.amount).type).toBe("regular");
    expect(signedAmountToTxn(rows[1]!.amount).type).toBe("income");
  });
  it("supports debit+credit columns", () => {
    const csv = `date,description,debit,credit\n2026-09-01,Store,40,\n2026-09-02,Deposit,,100`;
    const table = parseCsvText(csv);
    const mapping = suggestCsvMapping(table.headers);
    const rows = applyCsvMapping(table, mapping);
    expect(rows[0]!.amount).toBe(-40);
    expect(rows[1]!.amount).toBe(100);
  });
});

describe("importFingerprint", () => {
  it("stable idempotency key", () => {
    const a = importFingerprint({ account_id: "acc-1", date: "2026-09-01", amount: 12.5, description: "  Starbucks  ", currency: "ars" });
    const b = importFingerprint({ account_id: "acc-1", date: "2026-09-01T12:00:00Z", amount: -12.5, description: "starbucks", currency: "ARS" });
    expect(a).toBe(b);
  });
  it("transactionFingerprint still works", () => {
    expect(transactionFingerprint({ account_id: "a", amount: 1, currency: "USD", type: "regular", posted_at: "2026-09-01", note: "x" })).toContain("a|");
  });
});
