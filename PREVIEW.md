# Preview -- Categories + Budgets + Dashboard spending line

## URLs

- Worker API: https://copilot-clone-api.maurodaprotis.workers.dev
- Health: GET /health
- Sync: POST /sync (header x-user-id: demo-user)
- Categories: GET /categories?month=YYYY-MM
- Spending: GET /dashboard/spending?month=YYYY-MM
- Transactions: GET /transactions

## Click-test

1. Categories tab: spent/budget/remaining USD; edit budget.
2. Transactions: offline add pending (no budget hit); Review then hits.
3. Dashboard spending line vs budget pace; pending excluded.

No rebalance UI. No Plaid/Postgres.
