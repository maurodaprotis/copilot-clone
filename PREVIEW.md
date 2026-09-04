# Preview -- offline to To Review to sync

## URLs

- Worker API: https://copilot-clone-api.maurodaprotis.workers.dev
- Health: GET /health
- Sync: POST /sync (header x-user-id: demo-user)
- DO store: GET /transactions

## API smoke

pnpm --filter @copilot-clone/api smoke -- https://copilot-clone-api.maurodaprotis.workers.dev

Expect: pending upsert, idempotent re-push, review op -> reviewed.

## Mobile web

export EXPO_PUBLIC_API_URL=https://copilot-clone-api.maurodaprotis.workers.dev
pnpm --filter @copilot-clone/mobile web

1. Transactions: Add offline (local SQLite + outbox, pending).
2. Dashboard: appears under To Review.
3. Sync now: outbox clears; still needs_review.
4. Review: leaves To Review; syncs review to UserDO.
5. curl transactions endpoint with x-user-id demo-user

Expo web is not on Pages yet; use local web + Worker URL.
