import { describe, expect, it } from "vitest";
import { createMemoryDb } from "../src/db/memory";
import {
  applyRemoteAccountsSnapshot,
  listLocalAccounts,
  upsertAccountLocal,
  __test,
} from "../src/offline/accounts";

describe("accounts web API helpers", () => {
  it("upsertAccountViaApi posts account_upsert with x-user-id", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true, saved: ["acc-1"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await __test.upsertAccountViaApi(
      {
        id: "acc-1",
        name: "Galicia USD",
        currency: "usd",
        type: "depository",
        current_balance: 100,
        include_in_net_worth: true,
      },
      {
        apiUrl: "https://example.test",
        userId: "demo-user",
        fetchImpl,
      },
    );

    expect(result.id).toBe("acc-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://example.test/sync");
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers["x-user-id"]).toBe("demo-user");
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body.items[0]).toMatchObject({
      op: "account_upsert",
      id: "acc-1",
      name: "Galicia USD",
      currency: "USD",
      type: "depository",
      current_balance: 100,
    });
  });

  it("fetchAccountsOverviewFromApi returns rows", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          rows: [
            {
              account: {
                id: "a1",
                name: "Cash",
                currency: "USD",
                type: "other",
                is_archived: false,
                include_in_net_worth: true,
                current_balance: 10,
              },
              balance_account: 10,
              balance_reporting: 10,
              nw_contribution_reporting: 10,
            },
          ],
          net_worth_reporting: 10,
          on_date: "2026-09-04",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const overview = await __test.fetchAccountsOverviewFromApi({
      apiUrl: "https://example.test",
      userId: "demo-user",
      fetchImpl,
    });
    expect(overview?.rows).toHaveLength(1);
    expect(overview?.net_worth_reporting).toBe(10);
  });
});

describe("accounts native sqlite path (memory db)", () => {
  it("upsertAccountLocal writes account + outbox", async () => {
    const db = createMemoryDb();
    const { id, outboxId } = await upsertAccountLocal(
      {
        name: "Brokerage",
        currency: "USD",
        type: "investment",
        current_balance: 50,
      },
      db,
    );
    expect(id).toBeTruthy();
    expect(outboxId).toBeTruthy();
    const accounts = await listLocalAccounts(db);
    expect(accounts.some((a) => a.id === id && a.name === "Brokerage")).toBe(
      true,
    );
    const outbox = await db.getAllAsync<{ payload: string }>(
      "SELECT payload FROM outbox",
    );
    expect(outbox).toHaveLength(1);
    expect(JSON.parse(outbox[0]!.payload).op).toBe("account_upsert");
  });

  it("applyRemoteAccountsSnapshot mirrors rows", async () => {
    const db = createMemoryDb();
    await applyRemoteAccountsSnapshot(
      {
        rows: [
          {
            account: {
              id: "remote-1",
              name: "Remote",
              currency: "ARS",
              type: "other",
              is_archived: false,
              include_in_net_worth: true,
              current_balance: 5,
            },
            balance_account: 5,
          },
        ],
      },
      db,
    );
    const accounts = await listLocalAccounts(db);
    expect(accounts).toEqual([
      expect.objectContaining({ id: "remote-1", name: "Remote", currency: "ARS" }),
    ]);
  });
});
