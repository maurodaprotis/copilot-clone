# Preview — Copilot Clone (web + API)

## Public URLs

- **Web (Expo on Cloudflare Pages):** https://copilot-clone.pages.dev
- **Worker API:** https://copilot-clone-api.maurodaprotis.workers.dev
- Health: GET /health

Web build is a static Expo Router export (`apps/mobile`) deployed with `wrangler pages deploy` to project `copilot-clone` (account `005a2bd41e7a63f88c945fd6fb7ba6a0`). It points at the Worker via `extra.apiUrl` / `EXPO_PUBLIC_API_URL`.

### Web limitations (Paul)

- **expo-sqlite in the browser:** static export succeeds, but there is **no `.wasm` shipped** in this build. Local SQLite / offline-first writes may fail or no-op in some browsers; prefer Sync against the Worker API for durable data.
- Screens that call the API (settings, FX, import, cash-flow, sync) work over HTTPS + CORS `*`.
- SPA routes are pre-rendered HTML (`/settings`, `/transactions`, etc.) and return 200 on Pages.

Redeploy web:

```bash
node apps/mobile/scripts/deploy-pages.mjs
```

## API surface (Settings / FX / CSV import)

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

## Web hosting notes

- Static Expo web export on Pages project copilot-clone.
- Local data uses expo-sqlite (WASM/OPFS). If it fails in private mode, try Chrome.
- Rebuild with EXPO_PUBLIC_API_URL set to the Worker URL, then export -p web.
