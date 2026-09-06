# Preview — Copilot Clone (web + API)

## Public URLs

- **Web (Expo on Cloudflare Pages):** https://copilot-clone.pages.dev
- **Worker API:** https://copilot-clone-api.maurodaprotis.workers.dev
- Health: GET /health

Web build is a static Expo Router export (`apps/mobile`) deployed with `wrangler pages deploy` to project `copilot-clone` (account `005a2bd41e7a63f88c945fd6fb7ba6a0`). It points at the Worker via `extra.apiUrl` / `EXPO_PUBLIC_API_URL`.

### Web limitations (Paul)

- **expo-sqlite in the browser:** static export succeeds, but there is **no `.wasm` shipped** in this build. Web never uses expo-sqlite for durable writes.
- **Web outbox (localStorage):** Add expense/income, budget Save, and account create try `POST /sync` first. If the network fails, the payload is queued in a **localStorage web outbox** and auto-drained on `online` / window focus / after write (and the Sync button). Happy path does **not** require tapping Sync. Native keeps SQLite + outbox.
- Screens that call the API (settings, FX, import, cash-flow, sync) work over HTTPS + CORS `*`.

### Categories / Cash Flow on Pages (demo seed)

- **Categories** reads `GET /categories?month=` for the demo user (`x-user-id: demo-user`) and renders groups + progress bars from the API payload (avoids broken expo-sqlite/wasm on static Pages). Local SQLite mirror is best-effort.
- **Categories → edit budget** on web POSTs `budget_upsert` via `POST /sync` (queues web outbox offline). Button label is **Save**. Native keeps SQLite + outbox. No `category_upsert` in the Worker yet — create/rename UI not wired on web.
- **Transactions → Add** on web POSTs txn `upsert` (expense or income); lists via `GET /transactions`. CTA is **Add** (offline is transparent).
- **Dashboard → Top categories** uses the same `GET /categories?month=` payload (top spent by `spent`, with bars/amounts); falls back to local SQLite when the API is empty/unavailable.
- **Investments** (Phase 4C / Copilot web): `GET /investments?range=1W|1M|3M|YTD|1Y|ALL` — Live balance estimate, Top movers, Accounts / Allocation / Holdings, Demo Brokerage manual (no Plaid). **No Goals**. Nav: sidebar Investments.
- **Cash Flow** (web intentional delta vs Copilot iOS/Mac-only): `GET /cash-flow?range=mtd|ytd|last_3_months|last_12_months|last_4_weeks&include_excluded=&comparison=` — Income / Spending / Net income, prior-range compare, excluded toggle, spending-by-category + Excluded Transactions. Legacy `?month=` still works. Bank CSV import kept (commit → needs_review). Goals deferred.
- Empty Durable Objects auto-seed Copilot-like demo categories/budgets **and** a demo ledger when no `demo:*` fingerprints exist and there is no reviewed income/spend yet (smoke `needs_review` stubs do not block seed; never clobbers real reviewed sync data).

- SPA routes are pre-rendered HTML (`/settings`, `/transactions`, etc.) and return 200 on Pages.

Redeploy web:

```bash
node apps/mobile/scripts/deploy-pages.mjs
```

## How Paul opens the app

1. Open **https://copilot-clone.pages.dev** in Chrome/Edge/Firefox (desktop).
2. Use Cash Flow / Categories / Transactions / More.
3. More → Recurrings / Settings / Import CSV as in the click-test below.
4. Durable data: web writes go to the Worker (auto outbox drain when offline). Sync remains available; local SQLite on web is best-effort only.

## API surface (Settings / FX / CSV import / Recurrings)

- **Settings:** GET|POST /settings — reporting_currency (USD default), default_fx_series (official|parallel|custom), timezone/locale stubs
- **FX:** GET /fx?rate_book= · POST /fx `{base,quote,as_of,rate,rate_book}` · POST /fx/delete
- **Imports:** POST /imports `{csv_text,account_id}` → mapping → POST /imports/:id/mapping → ready_review → POST /imports/:id/commit → needs_review · POST /imports/:id/undo soft-delete stub
- **Recurrings:** GET /recurrings?within_days=14 → `{recurrings, upcoming}` · sync op `recurring_upsert` (name, kind expense|income|reimbursement, cadence, expected_amount, currency, category_id, account_id, next_expected_date, active) · reviewing a txn may advance matched recurring’s next_expected_date
- Sync / Categories / Cash Flow / Accounts / Rules / Tags / Splits unchanged

## Naming

- review_status: needs_review | reviewed | excluded (NOT pending)
- AccountType: credit_card | depository | investment | loan | other | real_estate
- FxRate.rate_book: official | parallel | custom
- ImportJob status: uploaded | parsing | mapping | ready_review | committed | failed
- RecurringKind: expense | income | reimbursement · Cadence: weekly | biweekly | monthly | quarterly | yearly

## Click-test (Paul)

### Settings + FX
1. **More → Settings:** reporting currency USD (default); switch default FX series official/parallel/custom; edit timezone/locale stubs.
2. Add manual FX: base USD / quote ARS / as_of today / rate / rate_book=parallel → Save FX rate.

### Bank CSV import
1. **More → Import CSV:** paste CSV (sample pre-filled) or debit+credit columns.
2. Pick account → **1. Upload / parse** → confirm mapping → **2. Apply mapping**.
3. **3. Commit → needs_review** → open **Transactions** / To Review; re-import skips duplicates via fingerprint.
4. Optional **Undo** soft-deletes created txns.

### Recurrings + Upcoming bills
1. **More → Recurrings:** create a template (e.g. Netflix · expense · monthly · amount · next_expected_date within 14 days) → Sync.
2. **Dashboard → Upcoming bills:** shows active recurrings with `next_expected_date` within 14 days.
3. Optional: add/import a matching txn (same name+amount currency), mark **Review**ed — heuristic match advances `next_expected_date` by cadence.

No Plaid/Postgres. needs_review preserved.

### Investments (Phase 4C)
1. Sidebar **Investments** (or More → Investments).
2. Live balance estimate ~$5,397 · ranges 1W/1M/3M/YTD/1Y/ALL · gear (Display Balance / Benchmark None / Live balance ON / Accounts included).
3. Top movers (AAPL, VTI) · Accounts Demo Brokerage 5555 Manual · Allocation BY PERCENTAGE · Holdings LAST PRICE.
4. Select account/holding → right detail (More toggles / type + positions / sort). No Goals, no Add/connect.
