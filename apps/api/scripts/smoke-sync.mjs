#!/usr/bin/env node
/**
 * Smoke: outbox-shaped payload → POST /sync → GET /transactions on UserDO.
 * Usage: node apps/api/scripts/smoke-sync.mjs [apiUrl]
 */
const apiUrl = (process.argv[2] || process.env.API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const userId = process.env.USER_ID || "paul-smoke";

const id = crypto.randomUUID();
const fingerprint = `acc-cash-ars|50.0000|USD|regular|2026-09-04|smoke cafe ${id}|`;

const item = {
  op: "upsert",
  id,
  account_id: "acc-cash-ars",
  category_id: null,
  amount: 50,
  currency: "USD",
  type: "regular",
  is_refund: false,
  review_status: "needs_review",
  posted_at: "2026-09-04T15:00:00.000Z",
  note: `smoke cafe ${id.slice(0, 8)}`,
  fingerprint,
  account_currency: "ARS",
  reporting_currency: "USD",
};

async function main() {
  console.log("API", apiUrl, "user", userId);

  const health = await fetch(`${apiUrl}/health`);
  console.log("health", health.status, await health.json());

  const syncRes = await fetch(`${apiUrl}/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ items: [item] }),
  });
  const syncBody = await syncRes.json();
  console.log("sync", syncRes.status, syncBody);
  if (!syncRes.ok || !syncBody.ok) {
    process.exitCode = 1;
    return;
  }

  const sampleFx = syncBody.sample_fx;
  if (!sampleFx || sampleFx.rate == null) {
    console.error("FAIL: expected seeded USD/ARS sample_fx with rate");
    process.exitCode = 1;
    return;
  }
  if (sampleFx.warning && /No FX rate/.test(sampleFx.warning)) {
    console.error("FAIL: USD->ARS still missing rate after seed", sampleFx);
    process.exitCode = 1;
    return;
  }
  console.log("sample_fx ok", { rate: sampleFx.rate, amount: sampleFx.amount, warning: sampleFx.warning ?? null });

  // Idempotent re-push same fingerprint / id
  const sync2 = await fetch(`${apiUrl}/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ items: [item] }),
  });
  console.log("sync idempotent", sync2.status, await sync2.json());

  const listRes = await fetch(`${apiUrl}/transactions`, {
    headers: { "x-user-id": userId },
  });
  const listBody = await listRes.json();
  const savedId = (syncBody.saved && syncBody.saved[0]) || id;
  const found = (listBody.transactions || []).find((t) => t.id === id || t.id === savedId);
  console.log("transactions count", (listBody.transactions || []).length);
  console.log("found", found ? { id: found.id, review_status: found.review_status, amount: found.amount, amount_account: found.amount_account } : null);

  if (!found || found.review_status !== "needs_review") {
    console.error("FAIL: expected needs_review txn in DO store", found && found.review_status);
    process.exitCode = 1;
    return;
  }

  if (Number(found.amount_account) !== 70000) {
    console.error("FAIL: expected amount_account 70000 from seeded FX, got", found.amount_account);
    process.exitCode = 1;
    return;
  }

  const reviewRes = await fetch(`${apiUrl}/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({
      items: [{ op: "review", id: found.id, review_status: "reviewed", updated_at: new Date().toISOString() }],
    }),
  });
  console.log("review", reviewRes.status, await reviewRes.json());

  const list2 = await (await fetch(`${apiUrl}/transactions`, { headers: { "x-user-id": userId } })).json();
  const after = (list2.transactions || []).find((t) => t.id === id);
  console.log("after review", after ? { review_status: after.review_status } : null);
  if (!after || after.review_status !== "reviewed") {
    console.error("FAIL: review not applied");
    process.exitCode = 1;
    return;
  }

  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
