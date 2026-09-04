# copilot-clone

Argentina-first Copilot Money clone (scaffold).

See the `scaffold/expo-do-sqlite` branch / PR for the monorepo scaffold:

- `apps/mobile` — Expo + Expo Router
- `apps/api` — Cloudflare Worker + Hono + Durable Object SQLite
- `packages/domain` — pure TS domain + Vitest
- `packages/db` — shared types/schema helpers

**Storage:** client `expo-sqlite` + outbox; server DO SQLite per user. No Postgres/Neon. No Plaid.
