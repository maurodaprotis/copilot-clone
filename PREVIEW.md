# Preview -- offline to To Review to sync

## URLs

- Worker API: https://copilot-clone-api.maurodaprotis.workers.dev
- Health: GET /health
- Sync: POST /sync (header x-user-id: demo-user)
- DO store: GET /transactions

## Naming

- review_status: needs_review | reviewed | excluded (NOT pending)
- pending is TxnStatus (bank pending vs posted), separate from ReviewStatus
- Legacy DO/client rows with review_status pending normalize to needs_review on read/write

## FX seed

UserDO and mobile client seed USD/ARS rate 1400 (as_of demo + recent) on first access so USD to ARS convert does not warn.

## API smoke

pnpm --filter @copilot-clone/api smoke -- https://copilot-clone-api.maurodaprotis.workers.dev

Expect: needs_review upsert, seeded FX (amount_account 70000), idempotent re-push, review op -> reviewed.

## Mobile web

export EXPO_PUBLIC_API_URL=https://copilot-clone-api.maurodaprotis.workers.dev
pnpm --filter @copilot-clone/mobile web

1. Transactions: Add offline (local Sqlite + outbox, needs_review).
2. Dashboard: appears under To Review.
3. Sync now: outbox clears; still needs_review.
4. Review: leaves To Review; syncs review to UserDO.
5. curl transactions endpoint with x-user-id demo-user - expect review_status needs_review until reviewed.

Expo web is not on Pages yet; use local web + Worker URL.
