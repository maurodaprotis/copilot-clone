import { afterEach, describe, expect, it } from "vitest";
import {
  __resetWebOutboxForTests,
  countWebOutbox,
  drainWebOutbox,
  enqueueWebOutbox,
  listWebOutbox,
} from "../src/offline/webOutbox";
import { postSyncItems, webSyncOrEnqueue } from "../src/offline/webSyncWrite";
import { __test as budgetTest } from "../src/offline/budgets";

afterEach(() => {
  __resetWebOutboxForTests();
});

describe("web outbox (localStorage / memory)", () => {
  it("enqueues and drains on successful transport", async () => {
    enqueueWebOutbox({
      entity_type: "budget",
      entity_id: "cat-dining:2026-09",
      payload: { op: "budget_upsert", category_id: "cat-dining" },
    });
    expect(countWebOutbox()).toBe(1);

    const pushed = await drainWebOutbox(async (items) => {
      expect(items).toHaveLength(1);
      return { ok: true, saved: ["ok"] };
    });
    expect(pushed.pushed).toBe(1);
    expect(countWebOutbox()).toBe(0);
  });

  it("keeps rows and bumps attempts when transport fails", async () => {
    enqueueWebOutbox({
      entity_type: "transaction",
      entity_id: "t1",
      payload: { op: "upsert", id: "t1" },
    });
    const result = await drainWebOutbox(async () => ({ ok: false }));
    expect(result.pushed).toBe(0);
    expect(countWebOutbox()).toBe(1);
    expect(listWebOutbox()[0]!.attempts).toBe(1);
  });
});

describe("webSyncOrEnqueue", () => {
  it("returns web-api id when POST /sync succeeds", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: true, saved: ["x"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const result = await webSyncOrEnqueue({
      payload: { op: "budget_upsert", category_id: "c" },
      entity_type: "budget",
      entity_id: "c:2026-09",
      apiUrl: "https://example.test",
      userId: "demo-user",
      fetchImpl,
    });
    expect(result.queued).toBe(false);
    expect(result.outboxId).toBe("web-api:c:2026-09");
    expect(countWebOutbox()).toBe(0);
  });

  it("queues localStorage outbox when fetch throws", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("offline");
    };
    const result = await webSyncOrEnqueue({
      payload: { op: "upsert", id: "txn-1" },
      entity_type: "transaction",
      entity_id: "txn-1",
      apiUrl: "https://example.test",
      userId: "demo-user",
      fetchImpl,
    });
    expect(result.queued).toBe(true);
    expect(countWebOutbox()).toBe(1);
    expect(listWebOutbox()[0]!.payload).toMatchObject({ id: "txn-1" });
  });

  it("postSyncItems reports !ok without throwing", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: false, message: "nope" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const result = await postSyncItems([{ op: "upsert" }], {
      apiUrl: "https://example.test",
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nope/);
  });
});

describe("setBudgetViaApi queues on failure", () => {
  it("does not throw when Worker returns not ok — enqueues instead", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: false, message: "nope" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const result = await budgetTest.setBudgetViaApi(
      {
        category_id: "cat-dining",
        year_month: "2026-09",
        budgeted_amount: 1,
      },
      { apiUrl: "https://example.test", userId: "demo-user", fetchImpl },
    );
    expect(result.queued).toBe(true);
    expect(countWebOutbox()).toBe(1);
  });
});
