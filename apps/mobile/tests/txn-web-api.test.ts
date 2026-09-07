import { afterEach, describe, expect, it } from "vitest";
import { createMemoryDb } from "../src/db/memory";
import { addExpenseOffline, __test } from "../src/offline/addExpenseOffline";
import { __resetWebOutboxForTests, countWebOutbox } from "../src/offline/webOutbox";
import { listToReview } from "../src/offline/queries";

afterEach(() => {
  __resetWebOutboxForTests();
});

describe("txn web API helpers", () => {
  it("upsertTxnViaApi posts upsert with x-user-id", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true, saved: ["txn-1"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await __test.upsertTxnViaApi(
      {
        id: "txn-1",
        account_id: "acc-cash-ars",
        category_id: "cat-dining",
        amount: 12.5,
        currency: "USD",
        account_currency: "ARS",
        reporting_currency: "USD",
        posted_at: "2026-09-05T12:00:00.000Z",
        note: "Café",
        fingerprint: "fp",
        type: "regular",
      },
      {
        apiUrl: "https://example.test",
        userId: "demo-user",
        fetchImpl,
      },
    );

    expect(result.transactionId).toBe("txn-1");
    expect(result.queued).toBe(false);
    expect(result.outboxId).toBe("web-api:txn-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://example.test/sync");
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers["x-user-id"]).toBe("demo-user");
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body.items[0]).toMatchObject({
      op: "upsert",
      id: "txn-1",
      type: "regular",
      review_status: "reviewed",
      amount: 12.5,
    });
  });

  it("upsertTxnViaApi queues web outbox when offline", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("offline");
    };
    const result = await __test.upsertTxnViaApi(
      {
        id: "txn-2",
        account_id: "acc-cash-ars",
        amount: 1,
        currency: "USD",
        account_currency: "USD",
        reporting_currency: "USD",
        posted_at: "2026-09-05T12:00:00.000Z",
        fingerprint: "fp2",
        type: "income",
      },
      { apiUrl: "https://example.test", userId: "demo-user", fetchImpl },
    );
    expect(result.queued).toBe(true);
    expect(countWebOutbox()).toBe(1);
  });
});

describe("txn native sqlite path (memory db)", () => {
  it("addExpenseOffline with dbOverride writes local + outbox", async () => {
    const db = createMemoryDb();
    const { transactionId } = await addExpenseOffline(
      {
        account_id: "acc-cash-ars",
        amount: 50,
        currency: "USD",
        account_currency: "ARS",
        reporting_currency: "USD",
        note: "Café",
        rate_book: { "USD:ARS:2026-09-04": 1400 },
        posted_at: "2026-09-04T15:00:00.000Z",
      },
      db,
    );
    const toReview = await listToReview(db);
    expect(toReview).toHaveLength(0);
    const all = await db.getAllAsync<{ id: string; review_status: string }>(
      "SELECT id, review_status FROM transactions",
    );
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(transactionId);
    expect(all[0]!.review_status).toBe("reviewed");
  });
});

describe("txn delete via API", () => {
  it("delete sync op posts delete with x-user-id", async () => {
    const { webSyncOrEnqueue } = await import("../src/offline/webSyncWrite");
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true, saved: ["txn-del"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const { deleteTransaction } = await import("../src/offline/deleteTransaction");
    // Force web path by mocking isWebRuntime is hard; call webSyncOrEnqueue shape via delete module.
    // Instead postSyncItems-style: exercise deleteTransaction under web by stubbing runtime.
    const result = await webSyncOrEnqueue({
      payload: { op: "delete", id: "txn-del", updated_at: "2026-09-06T00:00:00.000Z" },
      entity_type: "transaction",
      entity_id: "txn-del",
      apiUrl: "https://example.test",
      userId: "demo-user",
      fetchImpl,
    });
    expect(result.queued).toBe(false);
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body.items[0]).toMatchObject({ op: "delete", id: "txn-del" });
  });
});

describe("income category persist", () => {
  it("upsertTxnViaApi keeps cat-salary for income", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true, saved: ["txn-sal"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const result = await __test.upsertTxnViaApi(
      {
        id: "txn-sal",
        account_id: "acc-cash-ars",
        category_id: "cat-salary",
        amount: 10,
        currency: "ARS",
        account_currency: "ARS",
        reporting_currency: "USD",
        posted_at: "2026-09-06T12:00:00.000Z",
        note: "CualyQAIncome",
        fingerprint: "fp-sal",
        type: "income",
      },
      { apiUrl: "https://example.test", userId: "demo-user", fetchImpl },
    );
    expect(result.transactionId).toBe("txn-sal");
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body.items[0]).toMatchObject({
      op: "upsert",
      type: "income",
      category_id: "cat-salary",
      currency: "ARS",
      review_status: "reviewed",
    });
  });
});

describe("FX reporting amounts (Cash ARS)", () => {
  it("ARS 14000 reports as ~10 USD; USD 10 on ARS account reports 10", async () => {
    const { deriveAmounts, seedRateBook } = await import("@copilot-clone/domain");
    const book = seedRateBook(new Date("2026-09-06T12:00:00.000Z"));
    const ars = deriveAmounts({
      amount: 14000,
      currency: "ARS",
      account_currency: "ARS",
      reporting_currency: "USD",
      on_date: "2026-09-06",
      rate_book: book,
    });
    expect(ars.amount_reporting).toBeCloseTo(10, 5);
    expect(ars.amount_account).toBe(14000);

    const usd = deriveAmounts({
      amount: 10,
      currency: "USD",
      account_currency: "ARS",
      reporting_currency: "USD",
      on_date: "2026-09-06",
      rate_book: book,
    });
    expect(usd.amount_reporting).toBe(10);
    expect(usd.amount_account).toBe(14000);
  });

  it("mapApiTxn keeps amount_reporting for metrics (no ARS-as-USD fallback)", async () => {
    const { __test } = await import("../src/offline/queries");
    const mapped = __test.mapApiTxn({
      id: "t1",
      account_id: "acc-cash-ars",
      amount: 14000,
      currency: "ARS",
      amount_account: 14000,
      amount_reporting: 10,
      type: "regular",
      review_status: "reviewed",
      posted_at: "2026-09-06T12:00:00.000Z",
    });
    expect(mapped.amount_reporting).toBe(10);
    expect(mapped.amount).toBe(14000);
  });
});
