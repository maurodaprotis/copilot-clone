# Preview — Cash Flow + Accounts (+ Categories/Budgets)

## URLs

- Worker API: https://copilot-clone-api.maurodaprotis.workers.dev
- Health: GET /health
- Sync: POST /sync — upsert | review | budget_upsert | **account_upsert**
- Categories: GET /categories?month=YYYY-MM
- Spending: GET /dashboard/spending?month=YYYY-MM
- **Cash Flow:** GET /cash-flow?month=YYYY-MM
- **Accounts:** GET /accounts

## Naming

- review_status: needs_review | reviewed | excluded (NOT pending)
- pending is TxnStatus, separate from ReviewStatus

## Click-test (Paul)

1. **Cash Flow** tab: Income / Spend / Net for selected month (USD). Prior-month comparison shown. needs_review, pending, transfers omitted; refunds net against spend.
2. **More → Accounts:** list by type with account-ccy + USD balances; Net Worth total; + Add / tap row to edit; include_in_net_worth toggle.
3. Categories / Dashboard still work as before (budgets + spending line).

No rebalance UI. No Plaid/Postgres.

## Accounts notes

- AccountType: credit_card | depository | investment | loan | other | real_estate
- Default manual cash seed: `other` (`acc-cash-ars`)
- `current_balance` is persisted live balance (updated on review/upsert); sync carries it via account_upsert / GET /accounts
