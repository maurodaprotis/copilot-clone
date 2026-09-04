# Preview — Settings / FX / Bank CSV Import

## URLs

- Worker API: https://copilot-clone-api.maurodaprotis.workers.dev
- Health: GET /health
- **Settings:** GET|POST /settings — reporting_currency (USD default), default_fx_series (official|parallel|custom), timezone/locale stubs
- **FX:** GET /fx?rate_book= · POST /fx `{base,quote,as_of,rate,rate_book}` · POST /fx/delete
- **Imports:** POST /imports `{csv_text,account_id}` → mapping → POST /imports/:id/mapping → ready_review → POST /imports/:id/commit → needs_review · POST /imports/:id/undo soft-delete stub
- Sync / Categories / Cash Flow / Accounts / Rules / Tags / Splits unchanged

## Naming

- review_status: needs_review | reviewed | excluded (NOT pending)
- AccountType: credit_card | depository | investment | loan | other | real_estate
- FxRate.rate_book: official | parallel | custom
- ImportJob status: uploaded | parsing | mapping | ready_review | committed | failed

## Click-test (Paul)

### Settings + FX
1. **More → Settings:** reporting currency USD (default); switch default FX series official/parallel/custom; edit timezone/locale stubs.
2. Add manual FX: base USD / quote ARS / as_of today / rate / rate_book=parallel → Save FX rate.

### Bank CSV import
1. **More → Import CSV:** paste CSV (sample pre-filled) or debit+credit columns.
2. Pick account → **1. Upload / parse** → confirm mapping → **2. Apply mapping**.
3. **3. Commit → needs_review** → open **Transactions** / To Review; re-import skips duplicates via fingerprint.
4. Optional **Undo** soft-deletes created txns.

No Plaid/Postgres. needs_review preserved.
