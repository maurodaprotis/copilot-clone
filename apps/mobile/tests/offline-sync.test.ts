import { describe, expect, it } from "vitest";
import { createMemoryDb } from "../src/db/memory";
import { addExpenseOffline } from "../src/offline/addExpenseOffline";
import { listToReview, countOutbox } from "../src/offline/queries";
import { reviewTransaction } from "../src/offline/reviewTransaction";
import { syncOutbox } from "../src/offline/syncOutbox";

describe("offline → To Review → sync", () => {
  it("adds needs_review expense to To Review and outbox", async () => {
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
    expect(toReview).toHaveLength(1);
    expect(toReview[0]!.id).toBe(transactionId);
    expect(toReview[0]!.review_status).toBe("needs_review");
    expect(toReview[0]!.synced).toBe(0);
    expect(await countOutbox(db)).toBe(1);
  });

  it("sync clears outbox, marks synced, keeps needs_review", async () => {
    const db = createMemoryDb();
    await addExpenseOffline(
      {
        id: "txn-1",
        account_id: "acc-cash-ars",
        amount: 12,
        currency: "USD",
        account_currency: "ARS",
        reporting_currency: "USD",
        note: "Almuerzo",
        posted_at: "2026-09-04T12:00:00.000Z",
      },
      db,
    );

    const remoteStore: unknown[] = [];
    const pushed = await syncOutbox(async (items) => {
      remoteStore.push(...items);
      return { ok: true, saved: items.map((i) => (i as { id: string }).id) };
    }, db);

    expect(pushed.pushed).toBe(1);
    expect(await countOutbox(db)).toBe(0);
    expect(remoteStore).toHaveLength(1);

    const toReview = await listToReview(db);
    expect(toReview).toHaveLength(1);
    expect(toReview[0]!.review_status).toBe("needs_review");
    expect(toReview[0]!.synced).toBe(1);
  });

  it("review marks reviewed locally and queues sync", async () => {
    const db = createMemoryDb();
    const { transactionId } = await addExpenseOffline(
      {
        account_id: "acc-cash-ars",
        amount: 9,
        currency: "USD",
        account_currency: "ARS",
        reporting_currency: "USD",
      },
      db,
    );

    await syncOutbox(async () => ({ ok: true }), db);
    expect(await listToReview(db)).toHaveLength(1);

    await reviewTransaction(transactionId, db);
    expect(await listToReview(db)).toHaveLength(0);
    expect(await countOutbox(db)).toBe(1);

    const remote: unknown[] = [];
    await syncOutbox(async (items) => {
      remote.push(...items);
      return { ok: true };
    }, db);

    expect(remote[0]).toMatchObject({
      op: "review",
      id: transactionId,
      review_status: "reviewed",
    });
    expect(await countOutbox(db)).toBe(0);
  });

  it("failed transport increments attempts and keeps outbox", async () => {
    const db = createMemoryDb();
    await addExpenseOffline(
      {
        account_id: "acc-cash-ars",
        amount: 3,
        currency: "USD",
        account_currency: "ARS",
        reporting_currency: "USD",
      },
      db,
    );

    const result = await syncOutbox(async () => ({ ok: false }), db);
    expect(result.pushed).toBe(0);
    expect(await countOutbox(db)).toBe(1);
    const rows = await db.getAllAsync<{ attempts: number }>(
      "SELECT id, entity_id, payload FROM outbox ORDER BY created_at ASC",
    );
    // attempts updated via separate query — check via table
    const outboxRow = [...db._tables.outbox.values()][0]!;
    expect(outboxRow.attempts).toBe(1);
    void rows;
  });
});
