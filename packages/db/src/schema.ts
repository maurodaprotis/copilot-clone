/** Shared SQL DDL fragments for client (expo-sqlite) and server (DO SQLite). */

export const TRANSACTIONS_DDL = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  category_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  amount_account REAL NOT NULL,
  amount_reporting REAL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('regular', 'income', 'transfer')),
  is_refund INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'needs_review',
  posted_at TEXT NOT NULL,
  name TEXT,
  note TEXT,
  transfer_pair_id TEXT,
  fingerprint TEXT,
  is_split_parent INTEGER NOT NULL DEFAULT 0,
  synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const OUTBOX_DDL = `
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
`;

export const ACCOUNTS_DDL = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  type TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  include_in_net_worth INTEGER NOT NULL DEFAULT 1,
  current_balance REAL NOT NULL DEFAULT 0
);
`;

/** Best-effort ALTERs for DBs created before include_in_net_worth / current_balance. */
export const ACCOUNTS_MIGRATE_SQL = [
  "ALTER TABLE accounts ADD COLUMN include_in_net_worth INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE accounts ADD COLUMN current_balance REAL NOT NULL DEFAULT 0",
];

/** Best-effort ALTERs for txn name / split parent on older DBs. */
export const TRANSACTIONS_MIGRATE_SQL = [
  "ALTER TABLE transactions ADD COLUMN name TEXT",
  "ALTER TABLE transactions ADD COLUMN is_split_parent INTEGER NOT NULL DEFAULT 0",
];

export const FX_RATES_DDL = `
CREATE TABLE IF NOT EXISTS fx_rates (
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  on_date TEXT NOT NULL,
  rate REAL NOT NULL,
  PRIMARY KEY (from_currency, to_currency, on_date)
);
`;

export const CATEGORY_GROUPS_DDL = `
CREATE TABLE IF NOT EXISTS category_groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0
);
`;

export const CATEGORIES_DDL = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#888888',
  exclude_from_budget INTEGER NOT NULL DEFAULT 0,
  is_income_category INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
`;

export const BUDGET_MONTHS_DDL = `
CREATE TABLE IF NOT EXISTS budget_months (
  category_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  budgeted_amount REAL NOT NULL DEFAULT 0,
  rollover_mode TEXT NOT NULL DEFAULT 'off',
  rollover_from_prior REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, year_month)
);
`;

export const NAME_RULES_DDL = `
CREATE TABLE IF NOT EXISTS name_rules (
  id TEXT PRIMARY KEY NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'contains')),
  pattern TEXT NOT NULL,
  category_id TEXT NOT NULL,
  apply_historically INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
`;

export const TAGS_DDL = `
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b'
);
`;

export const TRANSACTION_TAGS_DDL = `
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (transaction_id, tag_id)
);
`;

export const SPLIT_LEGS_DDL = `
CREATE TABLE IF NOT EXISTS split_legs (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  year_month_override TEXT
);
`;

/** Client keeps outbox + synced flag; server DO does not rely on synced. */
export const CLIENT_SCHEMA = [
  TRANSACTIONS_DDL,
  OUTBOX_DDL,
  ACCOUNTS_DDL,
  FX_RATES_DDL,
  CATEGORY_GROUPS_DDL,
  CATEGORIES_DDL,
  BUDGET_MONTHS_DDL,
  NAME_RULES_DDL,
  TAGS_DDL,
  TRANSACTION_TAGS_DDL,
  SPLIT_LEGS_DDL,
].join("\n");

/** Server schema includes synced column for INSERT compatibility. */
export const SERVER_SCHEMA = [
  TRANSACTIONS_DDL,
  ACCOUNTS_DDL,
  FX_RATES_DDL,
  CATEGORY_GROUPS_DDL,
  CATEGORIES_DDL,
  BUDGET_MONTHS_DDL,
  NAME_RULES_DDL,
  TAGS_DDL,
  TRANSACTION_TAGS_DDL,
  SPLIT_LEGS_DDL,
].join("\n");
