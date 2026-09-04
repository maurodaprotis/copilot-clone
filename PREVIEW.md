# Preview — Rules / Tags / Splits (+ Cash Flow / Accounts / Budgets)

## URLs

- Worker API: https://copilot-clone-api.maurodaprotis.workers.dev
- Health: GET /health
- Sync: POST /sync — upsert | review | budget_upsert | account_upsert | **rule_upsert** | **tag_upsert** | **tag_assign** | **tag_unassign** | **split_set**
- Categories: GET /categories?month=YYYY-MM
- Spending: GET /dashboard/spending?month=YYYY-MM
- Cash Flow: GET /cash-flow?month=YYYY-MM
- Accounts: GET /accounts
- **Rules:** GET /rules
- **Tags:** GET /tags
- **Splits:** GET /splits?transaction_id=

## Naming

- review_status: needs_review | reviewed | excluded (NOT pending)
- pending is TxnStatus, separate from ReviewStatus
- Name Rules match txn `name` (falls back to `note`); do **not** auto-mark reviewed

## Click-test (Paul)

1. **More → Name Rules:** create contains/exact pattern → category; Sync. New expenses whose name/note matches get that category on create/sync (still `needs_review`). Historic apply is stubbed.
2. **More → Tags:** add a tag. **Transactions** → tap a row → toggle tags on/off (no budget impact).
3. **Transactions** → tap row → equal 2-way split → Save. Budgets count legs only (parent not double-counted). Unbalanced splits rejected.
4. Categories / Dashboard / Cash Flow / Accounts still work; needs_review preserved.

No rebalance UI. No Plaid/Postgres.

## Accounts notes

- AccountType: credit_card | depository | investment | loan | other | real_estate
- Default manual cash seed: `other` (`acc-cash-ars`)
- `current_balance` is persisted live balance (updated on review/upsert); sync carries it via account_upsert / GET /accounts
