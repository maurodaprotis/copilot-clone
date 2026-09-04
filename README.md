# copilot-clone

Argentina-first Copilot Money-inspired personal finance scaffold.

## Architecture

| Package | Role |
|---------|------|
| `apps/mobile` | Expo SDK 52 + Expo Router (tabs + web). Local expo-sqlite + outbox for offline writes. |
| `apps/api` | Cloudflare Worker + Hono. Per-user Durable Object with SQLite (new_sqlite_classes). |
| `packages/domain` | Pure TypeScript domain (entities, fx_convert, fingerprint, balance/budget rules) + Vitest. |
| `packages/db` | Shared SQL DDL helpers for client and DO SQLite. |

**Not in scope for this scaffold:** Postgres/Neon, Plaid, real Better Auth wiring (stub routes only).

### Data flow

1. Mobile writes a pending transaction + outbox row (`addExpenseOffline`).
2. Sync module pushes outbox payloads to `POST /sync` on the Worker.
3. Worker forwards to the user's `UserDO`, which stores rows in DO SQLite and recomputes balances/FX authoritatively.

### Domain notes

- Transaction `amount` is always positive; direction comes from `type` (regular | income | transfer) and `is_refund`.
- `amount_account` / `amount_reporting` derived via `fx_convert` + `rate_book`.
- Posted-only applies to balances; regular non-excluded hits budgets.

## Requirements

- Node.js **22+**
- pnpm 9 (via Corepack: `corepack enable`)

## Setup

```bash
corepack enable
pnpm install
```

## Scripts

```bash
# Domain unit tests
pnpm --filter @copilot-clone/domain test

# Typecheck packages that define it
pnpm typecheck

# API local dev (Wrangler)
pnpm --filter @copilot-clone/api dev

# Mobile
pnpm --filter @copilot-clone/mobile dev
```

Optional Wrangler config check:

```bash
pnpm --filter @copilot-clone/api exec wrangler deploy --dry-run
```

## Offline definition of done (scaffold)

- [x] Local insert of expense + outbox row (`apps/mobile/src/offline/addExpenseOffline.ts`)
- [x] Sync module that pushes outbox via injectable transport (`syncOutbox`)
- [x] Deep-link helper scheme `copilotclone://expense?...` (`src/lib/deepLink.ts`)
- [x] Server sync stub on Worker → UserDO SQLite

## Secrets

No secrets are committed. Use Wrangler `.dev.vars` locally for Cloudflare; Better Auth secrets when wired. Cloudflare API token is optional for deploy.

## License

Private scaffold.
