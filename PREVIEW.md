# Preview -- Categories + Budgets + Dashboard spending line

## URLs

- Worker API: https://copilot-clone-api.maurodaprotis.workers.dev
- Health: GET /health
- Sync: POST /sync -- upsert | review | budget_upsert
- Categories: GET /categories?month=YYYY-MM
- Spending: GET /dashboard/spending?month=YYYY-MM

## Naming

- review_status: needs_review | reviewed | excluded (NOT pending)
- pending is TxnStatus, separate from ReviewStatus

## Click-test

1. Categories: spent/budget/remaining USD; tap to edit budget.
2. Transactions: add offline needs_review (no budget hit); Review then hits.
3. Dashboard spending line vs budget pace; pending excluded.

No rebalance UI. No Plaid/Postgres.
