import { DurableObject } from "cloudflare:workers";
import { ACCOUNTS_MIGRATE_SQL, FX_RATES_MIGRATE_SQL, SERVER_SCHEMA, TRANSACTIONS_MIGRATE_SQL, seedBudgetRows, seedCategoryGroupRows, seedCategoryRows } from "@copilot-clone/db";
import {
  applyCsvMapping,
  applyNameRuleToTransaction,
  assertBalancedSplit,
  ClientError,
  isClientError,
  importFingerprint,
  balanceDeltaForTxn,
  buildAccountBalanceRows,
  buildCategoryBudgetRows,
  budgetPaceByDay,
  cashFlowSeries,
  computeCashFlowRangePayload,
  computeCashFlowWithPrior,
  parseCashFlowRangeKey,
  cumulativeSpendByDay,
  seedDemoTransactions,
  currentYearMonth,
  defaultUserSettings,
  deriveAmounts,
  fx_convert,
  mergeUserSettings,
  normalizeAccountType,
  normalizeFxSeries,
  normalizeReviewStatus,
  parseCsvText,
  recomputeBalanceFromOpeningAndTxns,
  seedFxRates,
  signedAmountToTxn,
  suggestCsvMapping,
  totalEffectiveBudget,
  type Account,
  type BudgetMonth,
  type Category,
  type CategoryGroup,
  type CsvColumnMapping,
  type FxRate,
  type FxRateInput,
  type FxSeries,
  type ImportJob,
  type ImportRow,
  type NameRule,
  type RateBook,
  type ReviewStatus,
  type SplitLeg,
  type Tag,
  type Transaction,
  type UserSettings,
  type Recurring,
  type RecurringCadence,
  type RecurringKind,
  normalizeRecurringCadence,
  normalizeRecurringKind,
  matchReviewedTxnToRecurring,
  rollForwardAfterMatch,
  upcomingRecurrings,
  DEFAULT_UPCOMING_WITHIN_DAYS,
} from "@copilot-clone/domain";

export interface Env {
  USER_DO: DurableObjectNamespace<UserDO>;
}

type SyncPushItem = {
  op?:
    | "upsert"
    | "review"
    | "budget_upsert"
    | "account_upsert"
    | "rule_upsert"
    | "tag_upsert"
    | "tag_assign"
    | "tag_unassign"
    | "split_set"
    | "recurring_upsert"
    | "category_upsert";
  id?: string;
  account_id?: string;
  category_id?: string | null;
  amount?: number;
  currency?: string;
  type?: "regular" | "income" | "transfer" | Account["type"];
  is_refund?: boolean;
  /** Accepts legacy "pending" which normalizes to needs_review. */
  review_status?: ReviewStatus | "pending";
  posted_at?: string;
  note?: string | null;
  /** Merchant/payee for Name Rules (falls back to note). */
  txn_name?: string | null;
  transfer_pair_id?: string | null;
  fingerprint?: string | null;
  account_currency?: string;
  reporting_currency?: string;
  updated_at?: string;
  is_split_parent?: boolean;
  // budget_upsert
  year_month?: string;
  budgeted_amount?: number;
  rollover_mode?: string;
  rollover_from_prior?: number;
  // category_upsert
  group_id?: string;
  emoji?: string;
  exclude_from_budget?: boolean;
  is_income_category?: boolean;
  archived?: boolean;
  sort_order?: number;
  // account_upsert / tag / rule
  name?: string;
  is_archived?: boolean;
  include_in_net_worth?: boolean;
  current_balance?: number;
  match_type?: "exact" | "contains";
  pattern?: string;
  apply_historically?: boolean;
  color?: string;
  tag_id?: string;
  transaction_id?: string;
  legs?: Array<{
    id?: string;
    category_id: string;
    amount: number;
    year_month_override?: string | null;
  }>;
  // recurring_upsert
  kind?: RecurringKind;
  cadence?: RecurringCadence;
  expected_amount?: number;
  next_expected_date?: string;
  active?: boolean;
};

export class UserDO extends DurableObject<Env> {
  private ready = false;

  private async ensureSchema(): Promise<void> {
    if (this.ready) return;
    this.ctx.storage.sql.exec(SERVER_SCHEMA);
    for (const sql of [
      ...ACCOUNTS_MIGRATE_SQL,
      ...TRANSACTIONS_MIGRATE_SQL,
      ...FX_RATES_MIGRATE_SQL,
    ]) {
      try {
        this.ctx.storage.sql.exec(sql);
      } catch {
        // column already exists
      }
    }
    this.ctx.storage.sql.exec(
      `UPDATE transactions SET review_status = 'needs_review'
       WHERE review_status = 'pending'`,
    );
    this.seedIfEmpty();
    this.ensureIncomeCategories();
    this.seedDemoTxnsIfEmpty();
    this.seedFxIfNeeded();
    this.seedSettingsIfNeeded();
    this.migrateAccountTypesAndBalances();
    this.ready = true;
  }

  private seedIfEmpty(): void {
    const groups = [
      ...this.ctx.storage.sql.exec("SELECT COUNT(*) AS c FROM category_groups"),
    ];
    const count = Number(groups[0]?.c ?? 0);
    if (count > 0) return;

    for (const g of seedCategoryGroupRows()) {
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO category_groups (id, name, sort_order, is_system)
         VALUES (?, ?, ?, ?)`,
        g.id,
        g.name,
        g.sort_order,
        g.is_system,
      );
    }
    for (const c of seedCategoryRows()) {
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO categories (
          id, group_id, name, emoji, color,
          exclude_from_budget, is_income_category, archived, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id,
        c.group_id,
        c.name,
        c.emoji,
        c.color,
        c.exclude_from_budget,
        c.is_income_category,
        c.archived,
        c.sort_order,
      );
    }
    for (const b of seedBudgetRows()) {
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO budget_months (
          category_id, year_month, budgeted_amount, rollover_mode, rollover_from_prior
        ) VALUES (?, ?, ?, ?, ?)`,
        b.category_id,
        b.year_month,
        b.budgeted_amount,
        b.rollover_mode,
        b.rollover_from_prior,
      );
    }

    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO accounts (
         id, name, currency, type, is_archived, include_in_net_worth, current_balance
       ) VALUES ('acc-cash-ars', 'Cash ARS', 'ARS', 'other', 0, 1, 0)`,
    );
  }


  /**
   * Demo ledger for empty DOs (Pages preview / Paul).
   * Only inserts when there are zero live transactions — never clobbers real sync data.
   */
  /** Idempotent: Income group + Salary even when DO was seeded before income existed. */
  private ensureIncomeCategories(): void {
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO category_groups (id, name, sort_order, is_system)
       VALUES ('grp-income', 'Income', 0, 1)`,
    );
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO categories (
         id, group_id, name, emoji, color,
         exclude_from_budget, is_income_category, archived, sort_order
       ) VALUES ('cat-salary', 'grp-income', 'Salary', '💵', '#10B981', 1, 1, 0, 1)`,
    );
  }

  private seedDemoTxnsIfEmpty(): void {
    // Skip if demo ledger already present.
    const demoRows = [
      ...this.ctx.storage.sql.exec(
        `SELECT COUNT(*) AS c FROM transactions
         WHERE deleted_at IS NULL AND fingerprint LIKE 'demo:%'`,
      ),
    ];
    if (Number(demoRows[0]?.c ?? 0) > 0) return;

    // Skip if the user already has real reviewed cash-flow activity.
    // Smoke/needs_review stubs (e.g. txn-demo-1) must NOT block Pages preview seed.
    const reviewed = [
      ...this.ctx.storage.sql.exec(
        `SELECT COUNT(*) AS c FROM transactions
         WHERE deleted_at IS NULL
           AND review_status = 'reviewed'
           AND type IN ('regular', 'income')`,
      ),
    ];
    if (Number(reviewed[0]?.c ?? 0) > 0) return;

    const now = new Date().toISOString();
    for (const t of seedDemoTransactions()) {
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO transactions (
          id, account_id, category_id, amount, currency,
          amount_account, amount_reporting, type, is_refund,
          review_status, posted_at, name, note, transfer_pair_id, fingerprint,
          is_split_parent, synced, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, 1, ?, ?)`,
        t.id,
        t.account_id,
        t.category_id,
        t.amount,
        t.currency,
        t.amount_account,
        t.amount_reporting,
        t.type,
        t.is_refund,
        t.review_status,
        t.posted_at,
        t.name,
        t.note,
        t.fingerprint,
        now,
        now,
      );
    }

    const accounts = this.listAccounts();
    const transactions = this.listTransactionsDomain();
    for (const account of accounts) {
      const bal = recomputeBalanceFromOpeningAndTxns(account, transactions);
      this.ctx.storage.sql.exec(
        `UPDATE accounts SET current_balance = ? WHERE id = ?`,
        bal,
        account.id,
      );
    }
  }

  private seedFxIfNeeded(): void {
    const existing = [
      ...this.ctx.storage.sql.exec(
        `SELECT 1 as ok FROM fx_rates
         WHERE from_currency = 'USD' AND to_currency = 'ARS' LIMIT 1`,
      ),
    ];
    if (existing.length > 0) return;

    for (const row of seedFxRates()) {
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO fx_rates (from_currency, to_currency, on_date, rate, rate_book, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        row.from,
        row.to,
        row.on_date,
        row.rate,
        row.rate_book,
        row.source ?? "manual",
      );
    }
  }

  /** Spec AccountType + fold opening+txn deltas into persisted current_balance once. */
  private migrateAccountTypesAndBalances(): void {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY)`,
    );
    this.ctx.storage.sql.exec(
      `UPDATE accounts SET type = 'other' WHERE type = 'cash'`,
    );
    this.ctx.storage.sql.exec(
      `UPDATE accounts SET type = 'depository' WHERE type = 'bank'`,
    );
    this.ctx.storage.sql.exec(
      `UPDATE accounts SET type = 'credit_card' WHERE type = 'credit'`,
    );

    const done = [
      ...this.ctx.storage.sql.exec(
        `SELECT 1 AS ok FROM _migrations WHERE id = 'acct_bal_v2' LIMIT 1`,
      ),
    ];
    if (done.length > 0) return;

    const accounts = this.listAccounts();
    const transactions = this.listTransactionsDomain();
    for (const account of accounts) {
      const bal = recomputeBalanceFromOpeningAndTxns(account, transactions);
      this.ctx.storage.sql.exec(
        `UPDATE accounts SET current_balance = ? WHERE id = ?`,
        bal,
        account.id,
      );
    }
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO _migrations (id) VALUES ('acct_bal_v2')`,
    );
  }

  private applyAccountBalanceDelta(accountId: string, delta: number): void {
    if (!accountId || delta === 0) return;
    this.ctx.storage.sql.exec(
      `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
      delta,
      accountId,
    );
  }

  private loadTxnDomainById(id: string): Transaction | null {
    const rows = [
      ...this.ctx.storage.sql.exec(
        `SELECT * FROM transactions WHERE id = ? LIMIT 1`,
        id,
      ),
    ];
    if (rows.length === 0) return null;
    const row = rows[0]!;
    return {
      id: String(row.id),
      account_id: String(row.account_id),
      category_id: row.category_id == null ? null : String(row.category_id),
      amount: Number(row.amount),
      currency: String(row.currency),
      amount_account: Number(row.amount_account),
      amount_reporting: Number(row.amount_reporting),
      type: String(row.type) as Transaction["type"],
      is_refund: Number(row.is_refund) === 1,
      review_status: String(row.review_status) as Transaction["review_status"],
      status: "posted",
      posted_at: String(row.posted_at),
      name: row.name == null ? null : String(row.name),
      note: row.note == null ? null : String(row.note),
      transfer_pair_id:
        row.transfer_pair_id == null ? null : String(row.transfer_pair_id),
      fingerprint: row.fingerprint == null ? null : String(row.fingerprint),
      is_split_parent: Number(row.is_split_parent ?? 0) === 1,
    };
  }

  private seedSettingsIfNeeded(): void {
    const existing = [
      ...this.ctx.storage.sql.exec(
        `SELECT 1 AS ok FROM user_settings WHERE id = 'default' LIMIT 1`,
      ),
    ];
    if (existing.length > 0) return;
    const s = defaultUserSettings();
    this.ctx.storage.sql.exec(
      `INSERT INTO user_settings (
         id, reporting_currency, locale, timezone, default_fx_series
       ) VALUES (?, ?, ?, ?, ?)`,
      s.id,
      s.reporting_currency,
      s.locale,
      s.timezone,
      s.default_fx_series,
    );
  }

  private getSettings(): UserSettings {
    this.seedSettingsIfNeeded();
    const rows = [
      ...this.ctx.storage.sql.exec(
        `SELECT * FROM user_settings WHERE id = 'default' LIMIT 1`,
      ),
    ];
    if (rows.length === 0) return defaultUserSettings();
    const row = rows[0]!;
    return {
      id: String(row.id),
      reporting_currency: String(row.reporting_currency ?? "USD"),
      locale: String(row.locale ?? "en-US"),
      timezone: String(row.timezone ?? "America/Argentina/Salta"),
      default_fx_series: normalizeFxSeries(
        row.default_fx_series == null ? null : String(row.default_fx_series),
      ),
    };
  }

  private patchSettings(patch: Partial<UserSettings>): UserSettings {
    const next = mergeUserSettings(this.getSettings(), patch);
    this.ctx.storage.sql.exec(
      `INSERT INTO user_settings (
         id, reporting_currency, locale, timezone, default_fx_series
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         reporting_currency = excluded.reporting_currency,
         locale = excluded.locale,
         timezone = excluded.timezone,
         default_fx_series = excluded.default_fx_series`,
      next.id,
      next.reporting_currency,
      next.locale,
      next.timezone,
      next.default_fx_series,
    );
    return next;
  }

  private listFxRates(series?: FxSeries): FxRate[] {
    this.seedFxIfNeeded();
    const rows = series
      ? [...this.ctx.storage.sql.exec(`SELECT * FROM fx_rates WHERE rate_book = ? ORDER BY on_date DESC`, series)]
      : [...this.ctx.storage.sql.exec(`SELECT * FROM fx_rates ORDER BY on_date DESC`)];
    return rows.map((row) => ({
      from: String(row.from_currency),
      to: String(row.to_currency),
      on_date: String(row.on_date),
      rate: Number(row.rate),
      rate_book: normalizeFxSeries(row.rate_book == null ? "parallel" : String(row.rate_book)),
      source: (row.source == null ? "manual" : String(row.source)) as FxRate["source"],
    }));
  }

  private upsertFxRate(input: FxRateInput): FxRate {
    const base = input.base.toUpperCase();
    const quote = input.quote.toUpperCase();
    const asOf = input.as_of.slice(0, 10);
    const book = normalizeFxSeries(input.rate_book);
    const source = input.source ?? "manual";
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO fx_rates (from_currency, to_currency, on_date, rate, rate_book, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      base, quote, asOf, Number(input.rate), book, source,
    );
    return { from: base, to: quote, on_date: asOf, rate: Number(input.rate), rate_book: book, source };
  }

  private deleteFxRate(input: { base: string; quote: string; as_of: string; rate_book: FxSeries }): void {
    this.ctx.storage.sql.exec(
      `DELETE FROM fx_rates WHERE from_currency = ? AND to_currency = ? AND on_date = ? AND rate_book = ?`,
      input.base.toUpperCase(), input.quote.toUpperCase(), input.as_of.slice(0, 10), normalizeFxSeries(input.rate_book),
    );
  }

  private loadRateBook(series?: FxSeries): RateBook {
    this.seedFxIfNeeded();
    const settings = this.getSettings();
    const use = series ?? settings.default_fx_series;
    const book: RateBook = {};
    let rows = [...this.ctx.storage.sql.exec(
      `SELECT from_currency, to_currency, on_date, rate FROM fx_rates WHERE rate_book = ?`, use,
    )];
    if (rows.length === 0) {
      rows = [...this.ctx.storage.sql.exec(`SELECT from_currency, to_currency, on_date, rate FROM fx_rates`)];
    }
    for (const row of rows) {
      book[`${String(row.from_currency)}:${String(row.to_currency)}:${String(row.on_date)}`] = Number(row.rate);
    }
    return book;
  }

  private mapImportJob(row: Record<string, unknown>): ImportJob {
    return {
      id: String(row.id), type: "bank_csv",
      status: String(row.status) as ImportJob["status"],
      account_id: row.account_id == null ? null : String(row.account_id),
      currency: row.currency == null ? null : String(row.currency),
      file_name: row.file_name == null ? null : String(row.file_name),
      mime: row.mime == null ? null : String(row.mime),
      detected_format: row.detected_format == null ? null : String(row.detected_format),
      mapping_json: row.mapping_json == null ? null : String(row.mapping_json),
      error_log: row.error_log == null ? null : String(row.error_log),
      created_at: String(row.created_at),
      committed_at: row.committed_at == null ? null : String(row.committed_at),
      undone_at: row.undone_at == null ? null : String(row.undone_at),
      row_count: Number(row.row_count ?? 0),
      created_count: Number(row.created_count ?? 0),
      duplicate_count: Number(row.duplicate_count ?? 0),
    };
  }

  private getImportJob(id: string): ImportJob | null {
    const rows = [...this.ctx.storage.sql.exec(`SELECT * FROM import_jobs WHERE id = ? LIMIT 1`, id)];
    if (rows.length === 0) return null;
    return this.mapImportJob(rows[0]! as Record<string, unknown>);
  }

  private listImportJobs(): ImportJob[] {
    return [...this.ctx.storage.sql.exec(`SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 50`)].map(
      (row) => this.mapImportJob(row as Record<string, unknown>),
    );
  }

  private listImportRows(jobId: string): ImportRow[] {
    return [...this.ctx.storage.sql.exec(`SELECT * FROM import_rows WHERE job_id = ? ORDER BY row_index ASC`, jobId)].map((row) => ({
      id: String(row.id), job_id: String(row.job_id), raw_payload: String(row.raw_payload),
      row_date: row.row_date == null ? null : String(row.row_date),
      name: row.name == null ? null : String(row.name),
      amount: row.amount == null ? null : Number(row.amount),
      currency: row.currency == null ? null : String(row.currency),
      fingerprint: row.fingerprint == null ? null : String(row.fingerprint),
      action: String(row.action) as ImportRow["action"],
      result_entity_id: row.result_entity_id == null ? null : String(row.result_entity_id),
      row_index: Number(row.row_index ?? 0),
    }));
  }

  private createImportJob(input: {
    csv_text: string; account_id?: string | null; currency?: string | null; file_name?: string | null;
  }): { job: ImportJob; headers: string[]; suggested_mapping: CsvColumnMapping } {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      const table = parseCsvText(input.csv_text);
      if (table.headers.length === 0) {
        this.ctx.storage.sql.exec(
          `INSERT INTO import_jobs (id, type, status, account_id, currency, file_name, mime, detected_format, mapping_json, csv_text, error_log, created_at, row_count, created_count, duplicate_count)
           VALUES (?, 'bank_csv', 'failed', ?, ?, ?, 'text/csv', NULL, NULL, ?, ?, ?, 0, 0, 0)`,
          id, input.account_id ?? null, input.currency ?? null, input.file_name ?? null, input.csv_text, "Empty CSV", now,
        );
        return { job: this.getImportJob(id)!, headers: [], suggested_mapping: suggestCsvMapping([]) };
      }
      const suggested = suggestCsvMapping(table.headers);
      this.ctx.storage.sql.exec(
        `INSERT INTO import_jobs (id, type, status, account_id, currency, file_name, mime, detected_format, mapping_json, csv_text, error_log, created_at, row_count, created_count, duplicate_count)
         VALUES (?, 'bank_csv', 'mapping', ?, ?, ?, 'text/csv', 'bank_csv', NULL, ?, NULL, ?, ?, 0, 0)`,
        id, input.account_id ?? null, input.currency ?? null, input.file_name ?? "paste.csv", input.csv_text, now, table.rows.length,
      );
      return { job: this.getImportJob(id)!, headers: table.headers, suggested_mapping: suggested };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.ctx.storage.sql.exec(
        `INSERT INTO import_jobs (id, type, status, account_id, currency, file_name, mime, detected_format, mapping_json, csv_text, error_log, created_at, row_count, created_count, duplicate_count)
         VALUES (?, 'bank_csv', 'failed', ?, ?, ?, 'text/csv', NULL, NULL, ?, ?, ?, 0, 0, 0)`,
        id, input.account_id ?? null, input.currency ?? null, input.file_name ?? null, input.csv_text, msg, now,
      );
      return { job: this.getImportJob(id)!, headers: [], suggested_mapping: suggestCsvMapping([]) };
    }
  }

  private applyImportMapping(
    jobId: string, mapping: CsvColumnMapping, accountId?: string | null, currency?: string | null,
  ): { job: ImportJob; rows: ImportRow[]; preview: ImportRow[] } {
    const jobRows = [...this.ctx.storage.sql.exec(`SELECT * FROM import_jobs WHERE id = ? LIMIT 1`, jobId)];
    if (jobRows.length === 0) throw new Error("import job not found");
    const csvText = String(jobRows[0]!.csv_text ?? "");
    const table = parseCsvText(csvText);
    const mapped = applyCsvMapping(table, mapping);
    const acct = accountId ?? (jobRows[0]!.account_id == null ? null : String(jobRows[0]!.account_id));
    const ccy = (currency ?? (jobRows[0]!.currency == null ? null : String(jobRows[0]!.currency)) ?? "USD").toUpperCase();
    this.ctx.storage.sql.exec(`DELETE FROM import_rows WHERE job_id = ?`, jobId);
    for (const m of mapped) {
      const rowCcy = (m.currency ?? ccy).toUpperCase();
      const abs = Math.abs(m.amount);
      const fp = acct ? importFingerprint({ account_id: acct, date: m.date, amount: abs, description: m.description, currency: rowCcy }) : null;
      let action: ImportRow["action"] = "create_txn";
      if (fp && this.findByFingerprint(fp)) action = "duplicate";
      this.ctx.storage.sql.exec(
        `INSERT INTO import_rows (id, job_id, raw_payload, row_date, name, amount, currency, fingerprint, action, result_entity_id, row_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        crypto.randomUUID(), jobId, JSON.stringify(m.raw), m.date, m.description, m.amount, rowCcy, fp, action, m.row_index,
      );
    }
    this.ctx.storage.sql.exec(
      `UPDATE import_jobs SET status = 'ready_review', mapping_json = ?, account_id = ?, currency = ?, row_count = ?, error_log = NULL WHERE id = ?`,
      JSON.stringify(mapping), acct, ccy, mapped.length, jobId,
    );
    const rows = this.listImportRows(jobId);
    return { job: this.getImportJob(jobId)!, rows, preview: rows.slice(0, 20) };
  }

  private commitImport(jobId: string): { job: ImportJob; created: string[]; duplicates: string[] } {
    const job = this.getImportJob(jobId);
    if (!job) throw new Error("import job not found");
    if (job.status !== "ready_review" && job.status !== "committed") throw new Error(`cannot commit job in status ${job.status}`);
    if (!job.account_id) throw new Error("import job missing account_id");
    const account = this.listAccounts().find((a) => a.id === job.account_id);
    if (!account) throw new Error("account not found");
    const settings = this.getSettings();
    const rateBook = this.loadRateBook();
    const rows = this.listImportRows(jobId);
    const created: string[] = [];
    const duplicates: string[] = [];
    for (const row of rows) {
      if (row.action === "skip" || row.amount == null || !row.row_date) continue;
      const rowCcy = (row.currency ?? job.currency ?? account.currency).toUpperCase();
      const { amount, type, is_refund } = signedAmountToTxn(row.amount);
      const fp = row.fingerprint ?? importFingerprint({
        account_id: job.account_id, date: row.row_date, amount, description: row.name ?? "", currency: rowCcy,
      });
      const existing = this.findByFingerprint(fp);
      if (existing || row.action === "duplicate") {
        duplicates.push(existing ?? fp);
        this.ctx.storage.sql.exec(`UPDATE import_rows SET action = 'duplicate', result_entity_id = ? WHERE id = ?`, existing, row.id);
        continue;
      }
      const txnId = crypto.randomUUID();
      this.applyUpsert({
        op: "upsert", id: txnId, account_id: job.account_id, amount, currency: rowCcy, type, is_refund,
        review_status: "needs_review", posted_at: `${row.row_date}T12:00:00.000Z`, note: row.name, txn_name: row.name,
        fingerprint: fp, account_currency: account.currency, reporting_currency: settings.reporting_currency,
      }, rateBook);
      created.push(txnId);
      this.ctx.storage.sql.exec(`UPDATE import_rows SET action = 'create_txn', result_entity_id = ? WHERE id = ?`, txnId, row.id);
    }
    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `UPDATE import_jobs SET status = 'committed', committed_at = ?, created_count = ?, duplicate_count = ? WHERE id = ?`,
      now, created.length, duplicates.length, jobId,
    );
    return { job: this.getImportJob(jobId)!, created, duplicates };
  }

  private undoImport(jobId: string): ImportJob {
    const job = this.getImportJob(jobId);
    if (!job) throw new Error("import job not found");
    if (job.status !== "committed") throw new Error("only committed jobs can be undone");
    const now = new Date().toISOString();
    for (const row of this.listImportRows(jobId)) {
      if (!row.result_entity_id || row.action !== "create_txn") continue;
      const before = this.loadTxnDomainById(row.result_entity_id);
      this.ctx.storage.sql.exec(
        `UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
        now, now, row.result_entity_id,
      );
      if (before) this.applyAccountBalanceDelta(before.account_id, -balanceDeltaForTxn(before));
    }
    this.ctx.storage.sql.exec(`UPDATE import_jobs SET undone_at = ? WHERE id = ?`, now, jobId);
    return this.getImportJob(jobId)!;
  }


  private findByFingerprint(fingerprint: string): string | null {
    const rows = [
      ...this.ctx.storage.sql.exec(
        `SELECT id FROM transactions
         WHERE fingerprint = ? AND deleted_at IS NULL LIMIT 1`,
        fingerprint,
      ),
    ];
    if (rows.length === 0) return null;
    return String(rows[0]!.id);
  }

  private listCategories(): Category[] {
    return [...this.ctx.storage.sql.exec("SELECT * FROM categories")].map(
      (row) => ({
        id: String(row.id),
        group_id: String(row.group_id),
        name: String(row.name),
        emoji: String(row.emoji ?? ""),
        color: String(row.color ?? "#888888"),
        exclude_from_budget: Number(row.exclude_from_budget) === 1,
        is_income_category: Number(row.is_income_category) === 1,
        archived: Number(row.archived) === 1,
        sort_order: Number(row.sort_order ?? 0),
      }),
    );
  }

  private listGroups(): CategoryGroup[] {
    return [
      ...this.ctx.storage.sql.exec(
        "SELECT * FROM category_groups ORDER BY sort_order ASC",
      ),
    ].map((row) => ({
      id: String(row.id),
      name: String(row.name),
      sort_order: Number(row.sort_order ?? 0),
      is_system: Number(row.is_system) === 1,
    }));
  }

  private listBudgets(yearMonth?: string): BudgetMonth[] {
    const rows = yearMonth
      ? [
          ...this.ctx.storage.sql.exec(
            "SELECT * FROM budget_months WHERE year_month = ?",
            yearMonth,
          ),
        ]
      : [...this.ctx.storage.sql.exec("SELECT * FROM budget_months")];
    return rows.map((row) => ({
      category_id: String(row.category_id),
      year_month: String(row.year_month),
      budgeted_amount: Number(row.budgeted_amount),
      rollover_mode: (String(row.rollover_mode) || "off") as BudgetMonth["rollover_mode"],
      rollover_from_prior: Number(row.rollover_from_prior ?? 0),
    }));
  }

  private listTransactionsDomain(): Transaction[] {
    return [...this.ctx.storage.sql.exec(
      "SELECT * FROM transactions WHERE deleted_at IS NULL",
    )].map(
      (row) => ({
        id: String(row.id),
        account_id: String(row.account_id),
        category_id: row.category_id == null ? null : String(row.category_id),
        amount: Number(row.amount),
        currency: String(row.currency),
        amount_account: Number(row.amount_account),
        amount_reporting: Number(row.amount_reporting),
        type: String(row.type) as Transaction["type"],
        is_refund: Number(row.is_refund) === 1,
        review_status: String(row.review_status) as Transaction["review_status"],
        status: "posted",
        posted_at: String(row.posted_at),
        name: row.name == null ? null : String(row.name),
        note: row.note == null ? null : String(row.note),
        transfer_pair_id:
          row.transfer_pair_id == null ? null : String(row.transfer_pair_id),
        fingerprint: row.fingerprint == null ? null : String(row.fingerprint),
        is_split_parent: Number(row.is_split_parent ?? 0) === 1,
      }),
    );
  }

  private listNameRules(): NameRule[] {
    return [...this.ctx.storage.sql.exec("SELECT * FROM name_rules")].map((row) => ({
      id: String(row.id),
      match_type: String(row.match_type) as NameRule["match_type"],
      pattern: String(row.pattern),
      category_id: String(row.category_id),
      apply_historically: Number(row.apply_historically) === 1,
      updated_at: String(row.updated_at),
    }));
  }

  private listTags(): Tag[] {
    return [...this.ctx.storage.sql.exec("SELECT * FROM tags ORDER BY name ASC")].map(
      (row) => ({
        id: String(row.id),
        name: String(row.name),
        color: String(row.color ?? "#64748b"),
      }),
    );
  }

  private listTransactionTags(transactionId?: string) {
    const rows = transactionId
      ? [
          ...this.ctx.storage.sql.exec(
            "SELECT * FROM transaction_tags WHERE transaction_id = ?",
            transactionId,
          ),
        ]
      : [...this.ctx.storage.sql.exec("SELECT * FROM transaction_tags")];
    return rows.map((row) => ({
      transaction_id: String(row.transaction_id),
      tag_id: String(row.tag_id),
    }));
  }

  private listSplitLegs(transactionId?: string): SplitLeg[] {
    const rows = transactionId
      ? [
          ...this.ctx.storage.sql.exec(
            "SELECT * FROM split_legs WHERE transaction_id = ?",
            transactionId,
          ),
        ]
      : [...this.ctx.storage.sql.exec("SELECT * FROM split_legs")];
    return rows.map((row) => ({
      id: String(row.id),
      transaction_id: String(row.transaction_id),
      category_id: String(row.category_id),
      amount: Number(row.amount),
      year_month_override:
        row.year_month_override == null ? null : String(row.year_month_override),
    }));
  }

  private ensureMonthBudgets(yearMonth: string): void {
    for (const b of seedBudgetRows(yearMonth)) {
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO budget_months (
          category_id, year_month, budgeted_amount, rollover_mode, rollover_from_prior
        ) VALUES (?, ?, ?, ?, ?)`,
        b.category_id,
        b.year_month,
        b.budgeted_amount,
        b.rollover_mode,
        b.rollover_from_prior,
      );
    }
  }

  /** Persisted account.current_balance (authoritative on DO). */
  balanceForAccount(accountId: string): number {
    const rows = [
      ...this.ctx.storage.sql.exec(
        `SELECT current_balance FROM accounts WHERE id = ? LIMIT 1`,
        accountId,
      ),
    ];
    if (rows.length === 0) return 0;
    return Number(rows[0]!.current_balance ?? 0);
  }

  private applyReview(item: SyncPushItem): string {
    const now = item.updated_at ?? new Date().toISOString();
    const status = normalizeReviewStatus(item.review_status ?? "reviewed");
    const before = item.id ? this.loadTxnDomainById(item.id) : null;
    this.ctx.storage.sql.exec(
      `UPDATE transactions SET review_status = ?, updated_at = ? WHERE id = ?`,
      status,
      now,
      item.id,
    );
    const after = item.id ? this.loadTxnDomainById(item.id) : null;
    if (before && after) {
      const delta = balanceDeltaForTxn(after) - balanceDeltaForTxn(before);
      this.applyAccountBalanceDelta(after.account_id, delta);
    }
    if (after && status === "reviewed") {
      this.tryMatchRecurringForTxn(after, now);
    }
    return item.id!;
  }

  private applyBudgetUpsert(item: SyncPushItem): string {
    const categoryId = item.category_id;
    const yearMonth = item.year_month ?? currentYearMonth();
    if (!categoryId) throw new Error("budget_upsert requires category_id");
    const budgeted = Number(item.budgeted_amount ?? 0);
    const mode = item.rollover_mode ?? "off";
    const rollover = Number(item.rollover_from_prior ?? 0);
    this.ctx.storage.sql.exec(
      `INSERT INTO budget_months (
        category_id, year_month, budgeted_amount, rollover_mode, rollover_from_prior
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(category_id, year_month) DO UPDATE SET
        budgeted_amount = excluded.budgeted_amount,
        rollover_mode = excluded.rollover_mode,
        rollover_from_prior = excluded.rollover_from_prior`,
      categoryId,
      yearMonth,
      budgeted,
      mode,
      rollover,
    );
    return `${categoryId}:${yearMonth}`;
  }

  private applyUpsert(item: SyncPushItem, rateBook: RateBook): string {
    const id = item.id;
    if (!id) throw new ClientError("upsert_invalid", "upsert requires id");
    if (!item.account_id) {
      throw new ClientError("upsert_invalid", "upsert requires account_id");
    }
    if (item.amount == null || !Number.isFinite(Number(item.amount))) {
      throw new ClientError("upsert_invalid", "upsert requires amount");
    }
    if (!item.currency) {
      throw new ClientError("upsert_invalid", "upsert requires currency");
    }
    const postedAt = item.posted_at ?? new Date().toISOString();
    const amount = Number(item.amount);
    const currency = item.currency.toUpperCase();

    // Dedup only against live rows; soft-deleted fingerprints must not block write.
    if (item.fingerprint) {
      const existingId = this.findByFingerprint(item.fingerprint);
      if (existingId && existingId !== id) {
        return existingId;
      }
    }

    const account = this.listAccounts().find((a) => a.id === item.account_id);
    const accountCurrency = (
      item.account_currency ?? account?.currency ?? currency
    ).toUpperCase();
    const reportingCurrency = (
      item.reporting_currency ?? this.getSettings().reporting_currency
    ).toUpperCase();

    const amounts = deriveAmounts({
      amount,
      currency,
      account_currency: accountCurrency,
      reporting_currency: reportingCurrency,
      on_date: postedAt.slice(0, 10),
      rate_book: rateBook,
    });
    const now = new Date().toISOString();
    const reviewStatus = normalizeReviewStatus(item.review_status ?? "needs_review");
    const txnName = item.txn_name ?? item.note ?? null;

    let categoryId = item.category_id ?? null;
    const draft: Transaction = {
      id,
      account_id: item.account_id,
      category_id: categoryId,
      amount,
      currency,
      amount_account: amounts.amount_account,
      amount_reporting: amounts.amount_reporting,
      type: (item.type as Transaction["type"]) ?? "regular",
      is_refund: !!item.is_refund,
      review_status: reviewStatus,
      posted_at: postedAt,
      name: txnName,
      note: item.note ?? null,
      transfer_pair_id: item.transfer_pair_id ?? null,
      fingerprint: item.fingerprint ?? null,
    };
    categoryId = applyNameRuleToTransaction(draft, this.listNameRules()).category_id;
    const before = this.loadTxnDomainById(id);
    const createdAt = before ? String(
      [...this.ctx.storage.sql.exec(`SELECT created_at FROM transactions WHERE id = ?`, id)][0]
        ?.created_at ?? now,
    ) : now;

    this.ctx.storage.sql.exec(
      `INSERT INTO transactions (
        id, account_id, category_id, amount, currency,
        amount_account, amount_reporting, type, is_refund,
        review_status, posted_at, name, note, transfer_pair_id, fingerprint,
        is_split_parent, synced, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        account_id = excluded.account_id,
        category_id = excluded.category_id,
        amount = excluded.amount,
        currency = excluded.currency,
        amount_account = excluded.amount_account,
        amount_reporting = excluded.amount_reporting,
        type = excluded.type,
        is_refund = excluded.is_refund,
        review_status = excluded.review_status,
        posted_at = excluded.posted_at,
        name = excluded.name,
        note = excluded.note,
        transfer_pair_id = excluded.transfer_pair_id,
        fingerprint = excluded.fingerprint,
        is_split_parent = excluded.is_split_parent,
        synced = 1,
        updated_at = excluded.updated_at,
        deleted_at = NULL`,
      id,
      item.account_id,
      categoryId,
      amount,
      currency,
      amounts.amount_account,
      amounts.amount_reporting,
      item.type ?? "regular",
      item.is_refund ? 1 : 0,
      reviewStatus,
      postedAt,
      txnName,
      item.note ?? null,
      item.transfer_pair_id ?? null,
      item.fingerprint ?? null,
      item.is_split_parent ? 1 : 0,
      createdAt,
      now,
    );

    const after = this.loadTxnDomainById(id);
    if (before) {
      this.applyAccountBalanceDelta(before.account_id, -balanceDeltaForTxn(before));
    }
    if (after) {
      this.applyAccountBalanceDelta(after.account_id, balanceDeltaForTxn(after));
    }
    if (after && reviewStatus === "reviewed") {
      this.tryMatchRecurringForTxn(after, now);
    }
    return id;
  }


  private applyCategoryUpsert(item: SyncPushItem): string {
    const id = item.id ?? crypto.randomUUID();
    const name = (item.name ?? "").trim();
    if (!name) throw new ClientError("category_upsert_invalid", "category_upsert requires name");
    const isIncome = !!item.is_income_category;
    const groupId = item.group_id ?? (isIncome ? "grp-income" : "grp-other");
    // Ensure group row exists (custom groups allowed).
    const groupRows = [
      ...this.ctx.storage.sql.exec(
        `SELECT id FROM category_groups WHERE id = ? LIMIT 1`,
        groupId,
      ),
    ];
    if (groupRows.length === 0) {
      const maxSort = [
        ...this.ctx.storage.sql.exec(
          `SELECT COALESCE(MAX(sort_order), 0) AS m FROM category_groups`,
        ),
      ];
      const sort = Number(maxSort[0]?.m ?? 0) + 1;
      this.ctx.storage.sql.exec(
        `INSERT INTO category_groups (id, name, sort_order, is_system)
         VALUES (?, ?, ?, 0)`,
        groupId,
        isIncome ? "Income" : "Custom",
        sort,
      );
    }
    const emoji = item.emoji ?? (isIncome ? "💵" : "📁");
    const color = item.color ?? (isIncome ? "#10B981" : "#94a3b8");
    const exclude = item.exclude_from_budget == null ? (isIncome ? 1 : 0) : (item.exclude_from_budget ? 1 : 0);
    const archived = item.archived ? 1 : 0;
    const sortOrder = Number(item.sort_order ?? 100);
    this.ctx.storage.sql.exec(
      `INSERT INTO categories (
         id, group_id, name, emoji, color,
         exclude_from_budget, is_income_category, archived, sort_order
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         group_id = excluded.group_id,
         name = excluded.name,
         emoji = excluded.emoji,
         color = excluded.color,
         exclude_from_budget = excluded.exclude_from_budget,
         is_income_category = excluded.is_income_category,
         archived = excluded.archived,
         sort_order = excluded.sort_order`,
      id,
      groupId,
      name,
      emoji,
      color,
      exclude,
      isIncome ? 1 : 0,
      archived,
      sortOrder,
    );
    return id;
  }

  private applyRuleUpsert(item: SyncPushItem): string {
    const id = item.id ?? crypto.randomUUID();
    const now = item.updated_at ?? new Date().toISOString();
    const matchType = item.match_type ?? "contains";
    const pattern = item.pattern ?? "";
    const categoryId = item.category_id;
    if (!categoryId) throw new Error("rule_upsert requires category_id");
    if (!pattern) throw new Error("rule_upsert requires pattern");
    this.ctx.storage.sql.exec(
      `INSERT INTO name_rules (id, match_type, pattern, category_id, apply_historically, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         match_type = excluded.match_type,
         pattern = excluded.pattern,
         category_id = excluded.category_id,
         apply_historically = excluded.apply_historically,
         updated_at = excluded.updated_at`,
      id,
      matchType,
      pattern,
      categoryId,
      item.apply_historically === false ? 0 : 1,
      now,
    );
    return id;
  }

  private applyTagUpsert(item: SyncPushItem): string {
    const id = item.id ?? crypto.randomUUID();
    const name = item.name ?? "Tag";
    const color = item.color ?? "#64748b";
    this.ctx.storage.sql.exec(
      `INSERT INTO tags (id, name, color) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color`,
      id,
      name,
      color,
    );
    return id;
  }

  private applyTagAssign(item: SyncPushItem, assign: boolean): string {
    const txnId = item.transaction_id ?? item.id;
    const tagId = item.tag_id;
    if (!txnId || !tagId) throw new Error("tag_assign requires transaction_id and tag_id");
    if (assign) {
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`,
        txnId,
        tagId,
      );
    } else {
      this.ctx.storage.sql.exec(
        `DELETE FROM transaction_tags WHERE transaction_id = ? AND tag_id = ?`,
        txnId,
        tagId,
      );
    }
    return `${txnId}:${tagId}`;
  }

  private applySplitSet(item: SyncPushItem): string {
    const txnId = item.transaction_id ?? item.id;
    if (!txnId) throw new Error("split_set requires transaction_id");
    const legs = item.legs ?? [];
    const parentRows = [
      ...this.ctx.storage.sql.exec(
        "SELECT amount FROM transactions WHERE id = ? LIMIT 1",
        txnId,
      ),
    ];
    if (parentRows.length === 0) throw new Error("split_set parent not found");
    const parentAmount = Number(parentRows[0]!.amount);
    assertBalancedSplit(
      parentAmount,
      legs.map((l) => ({ amount: Number(l.amount) })),
    );
    this.ctx.storage.sql.exec(`DELETE FROM split_legs WHERE transaction_id = ?`, txnId);
    for (const leg of legs) {
      const legId = leg.id ?? crypto.randomUUID();
      this.ctx.storage.sql.exec(
        `INSERT INTO split_legs (id, transaction_id, category_id, amount, year_month_override)
         VALUES (?, ?, ?, ?, ?)`,
        legId,
        txnId,
        leg.category_id,
        Number(leg.amount),
        leg.year_month_override ?? null,
      );
    }
    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `UPDATE transactions SET is_split_parent = 1, updated_at = ? WHERE id = ?`,
      now,
      txnId,
    );
    return txnId;
  }

  private listAccounts(): Account[] {
    return [...this.ctx.storage.sql.exec("SELECT * FROM accounts")].map((row) => ({
      id: String(row.id),
      name: String(row.name),
      currency: String(row.currency),
      type: normalizeAccountType(String(row.type)),
      is_archived: Number(row.is_archived) === 1,
      include_in_net_worth:
        row.include_in_net_worth == null
          ? true
          : Number(row.include_in_net_worth) === 1,
      current_balance: Number(row.current_balance ?? 0),
    }));
  }

  private applyAccountUpsert(item: SyncPushItem): string {
    const id = item.id;
    if (!id) throw new Error("account_upsert requires id");
    const name = item.name ?? "Account";
    const currency = (item.currency ?? "USD").toUpperCase();
    const type = normalizeAccountType(item.type as string | undefined);
    const isArchived = item.is_archived ? 1 : 0;
    const includeNw = item.include_in_net_worth === false ? 0 : 1;
    const balance = Number(item.current_balance ?? 0);
    this.ctx.storage.sql.exec(
      `INSERT INTO accounts (
         id, name, currency, type, is_archived, include_in_net_worth, current_balance
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         currency = excluded.currency,
         type = excluded.type,
         is_archived = excluded.is_archived,
         include_in_net_worth = excluded.include_in_net_worth,
         current_balance = excluded.current_balance`,
      id,
      name,
      currency,
      type,
      isArchived,
      includeNw,
      balance,
    );
    return id;
  }


  private mapRecurring(row: Record<string, unknown>): Recurring {
    return {
      id: String(row.id),
      name: String(row.name),
      kind: normalizeRecurringKind(row.kind == null ? null : String(row.kind)),
      cadence: normalizeRecurringCadence(row.cadence == null ? null : String(row.cadence)),
      expected_amount: Number(row.expected_amount),
      currency: String(row.currency).toUpperCase(),
      category_id: row.category_id == null ? null : String(row.category_id),
      account_id: row.account_id == null ? null : String(row.account_id),
      next_expected_date: String(row.next_expected_date).slice(0, 10),
      active: Number(row.active ?? 1) === 1,
      updated_at: String(row.updated_at),
    };
  }

  private listRecurrings(): Recurring[] {
    return [...this.ctx.storage.sql.exec(
      `SELECT * FROM recurrings ORDER BY next_expected_date ASC, name ASC`,
    )].map((row) => this.mapRecurring(row as Record<string, unknown>));
  }

  private applyRecurringUpsert(item: SyncPushItem): string {
    const id = item.id ?? crypto.randomUUID();
    const now = item.updated_at ?? new Date().toISOString();
    const name = (item.name ?? "").trim();
    if (!name) throw new Error("recurring_upsert requires name");
    const kind = normalizeRecurringKind(item.kind);
    const cadence = normalizeRecurringCadence(item.cadence);
    const expected = Number(item.expected_amount ?? 0);
    const currency = (item.currency ?? "USD").toUpperCase();
    const next = (item.next_expected_date ?? now).slice(0, 10);
    const active = item.active === false ? 0 : 1;
    this.ctx.storage.sql.exec(
      `INSERT INTO recurrings (
         id, name, kind, cadence, expected_amount, currency,
         category_id, account_id, next_expected_date, active, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         kind = excluded.kind,
         cadence = excluded.cadence,
         expected_amount = excluded.expected_amount,
         currency = excluded.currency,
         category_id = excluded.category_id,
         account_id = excluded.account_id,
         next_expected_date = excluded.next_expected_date,
         active = excluded.active,
         updated_at = excluded.updated_at`,
      id,
      name,
      kind,
      cadence,
      expected,
      currency,
      item.category_id ?? null,
      item.account_id ?? null,
      next,
      active,
      now,
    );
    return id;
  }

  private tryMatchRecurringForTxn(txn: Transaction, now: string): void {
    const match = matchReviewedTxnToRecurring(txn, this.listRecurrings());
    if (!match) return;
    const next = rollForwardAfterMatch(match.recurring, txn.posted_at);
    this.ctx.storage.sql.exec(
      `UPDATE recurrings SET next_expected_date = ?, updated_at = ? WHERE id = ?`,
      next,
      now,
      match.recurring.id,
    );
  }

  private cashFlowPayload(opts: {
    yearMonth: string;
    range?: string | null;
    includeExcluded?: boolean;
    comparison?: boolean;
  }) {
    const transactions = this.listTransactionsDomain();
    const categories = this.listCategories();
    const settings = this.getSettings();
    const include_excluded = opts.includeExcluded === true;
    // Prefer Help Center range when provided; keep month path for legacy clients.
    if (opts.range != null && String(opts.range).trim() !== "") {
      const range = parseCashFlowRangeKey(opts.range);
      return computeCashFlowRangePayload({
        transactions,
        categories,
        range,
        include_excluded,
        comparison_enabled: opts.comparison !== false,
        reporting_currency: settings.reporting_currency,
      });
    }
    const comparison = computeCashFlowWithPrior({
      transactions,
      year_month: opts.yearMonth,
      reporting_currency: settings.reporting_currency,
      include_excluded,
    });
    const series = cashFlowSeries({
      transactions,
      year_month: opts.yearMonth,
      months: 6,
      reporting_currency: settings.reporting_currency,
      include_excluded,
    });
    const rangePayload = computeCashFlowRangePayload({
      transactions,
      categories,
      range: "mtd",
      include_excluded,
      comparison_enabled: opts.comparison !== false,
      reporting_currency: settings.reporting_currency,
    });
    return {
      ...comparison,
      series,
      // Help Center fields also present on legacy month responses
      range: rangePayload.range,
      range_label: rangePayload.range_label,
      start: rangePayload.start,
      end: rangePayload.end,
      prior_start: rangePayload.prior_start,
      prior_end: rangePayload.prior_end,
      include_excluded,
      comparison_enabled: opts.comparison !== false,
      excluded_spend: rangePayload.excluded_spend,
      spending_by_category: rangePayload.spending_by_category,
    };
  }

  private accountsPayload() {
    const accounts = this.listAccounts();
    const transactions = this.listTransactionsDomain();
    const settings = this.getSettings();
    const rateBook = this.loadRateBook();
    const onDate = new Date().toISOString().slice(0, 10);
    const built = buildAccountBalanceRows({
      accounts,
      transactions,
      reporting_currency: settings.reporting_currency,
      on_date: onDate,
      rate_book: rateBook,
    });
    return {
      ...built,
      on_date: onDate,
    };
  }

  private categoriesPayload(yearMonth: string) {
    this.ensureMonthBudgets(yearMonth);
    const groups = this.listGroups();
    const categories = this.listCategories();
    const budgets = this.listBudgets(yearMonth);
    const transactions = this.listTransactionsDomain();
    const split_legs = this.listSplitLegs();
    const rows = buildCategoryBudgetRows({
      categories,
      budgets,
      transactions,
      year_month: yearMonth,
      split_legs,
    });
    return {
      year_month: yearMonth,
      reporting_currency: this.getSettings().reporting_currency,
      groups,
      categories,
      budgets,
      rows,
      totals: {
        budgeted: totalEffectiveBudget(rows),
        spent: rows
          .filter((r) => !r.category.exclude_from_budget)
          .reduce((s, r) => s + r.spent, 0),
        remaining: rows
          .filter((r) => !r.category.exclude_from_budget)
          .reduce((s, r) => s + r.remaining, 0),
      },
    };
  }

  private spendingPayload(yearMonth: string) {
    this.ensureMonthBudgets(yearMonth);
    const categories = this.listCategories();
    const budgets = this.listBudgets(yearMonth);
    const transactions = this.listTransactionsDomain();
    const split_legs = this.listSplitLegs();
    const rows = buildCategoryBudgetRows({
      categories,
      budgets,
      transactions,
      year_month: yearMonth,
      split_legs,
    });
    const totalBudget = totalEffectiveBudget(rows);
    const cumulative = cumulativeSpendByDay({
      transactions,
      year_month: yearMonth,
      categories,
      split_legs,
    });
    const pace = budgetPaceByDay(totalBudget, yearMonth);
    return {
      year_month: yearMonth,
      reporting_currency: this.getSettings().reporting_currency,
      total_budget: totalBudget,
      cumulative_spend: cumulative,
      budget_pace: pace,
      spent_mtd: cumulative[cumulative.length - 1] ?? 0,
    };
  }

  private listTransactionsNormalized(): Record<string, unknown>[] {
    const rows = [
      ...this.ctx.storage.sql.exec(
        "SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY posted_at DESC",
      ),
    ];
    return rows.map((row) => {
      const out: Record<string, unknown> = { ...row };
      out.review_status = normalizeReviewStatus(
        row.review_status == null ? null : String(row.review_status),
      );
      return out;
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureSchema();
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, do: "UserDO" });
    }

    if (request.method === "GET" && url.pathname === "/settings") {
      return Response.json({ settings: this.getSettings() });
    }

    if (request.method === "POST" && url.pathname === "/settings") {
      const body = (await request.json()) as Partial<UserSettings>;
      return Response.json({ ok: true, settings: this.patchSettings(body) });
    }

    if (request.method === "GET" && url.pathname === "/fx") {
      const series = url.searchParams.get("rate_book");
      return Response.json({
        rates: this.listFxRates(series ? normalizeFxSeries(series) : undefined),
        default_fx_series: this.getSettings().default_fx_series,
      });
    }

    if (request.method === "POST" && url.pathname === "/fx") {
      const body = (await request.json()) as Partial<FxRateInput> & {
        from?: string; to?: string; on_date?: string;
      };
      const rate = this.upsertFxRate({
        base: body.base ?? body.from ?? "USD",
        quote: body.quote ?? body.to ?? "ARS",
        as_of: body.as_of ?? body.on_date ?? new Date().toISOString().slice(0, 10),
        rate: Number(body.rate ?? 0),
        rate_book: normalizeFxSeries(body.rate_book),
        source: body.source ?? "manual",
      });
      return Response.json({ ok: true, rate });
    }

    if (request.method === "POST" && url.pathname === "/fx/delete") {
      const body = (await request.json()) as {
        base: string; quote: string; as_of: string; rate_book: FxSeries;
      };
      this.deleteFxRate(body);
      return Response.json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/imports") {
      return Response.json({ imports: this.listImportJobs() });
    }

    if (request.method === "POST" && url.pathname === "/imports") {
      const body = (await request.json()) as {
        csv_text: string; account_id?: string; currency?: string; file_name?: string;
      };
      if (!body.csv_text) {
        return Response.json({ ok: false, error: "csv_text required" }, { status: 400 });
      }
      return Response.json({ ok: true, ...this.createImportJob(body) });
    }

    if (request.method === "GET" && url.pathname.startsWith("/imports/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 2) {
        const job = this.getImportJob(parts[1]!);
        if (!job) return Response.json({ error: "not found" }, { status: 404 });
        return Response.json({ job, rows: this.listImportRows(job.id) });
      }
    }

    if (request.method === "POST" && url.pathname.startsWith("/imports/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 3) {
        const jobId = parts[1]!;
        const action = parts[2]!;
        try {
          if (action === "mapping") {
            const body = (await request.json()) as {
              mapping: CsvColumnMapping; account_id?: string; currency?: string;
            };
            return Response.json({
              ok: true,
              ...this.applyImportMapping(jobId, body.mapping, body.account_id, body.currency),
            });
          }
          if (action === "commit") {
            return Response.json({ ok: true, ...this.commitImport(jobId) });
          }
          if (action === "undo") {
            return Response.json({ ok: true, job: this.undoImport(jobId) });
          }
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 400 },
          );
        }
      }
    }


    if (request.method === "POST" && url.pathname === "/sync") {
      const raw = (await request.json()) as
        | SyncPushItem[]
        | { items?: SyncPushItem[]; item?: SyncPushItem };
      const items: SyncPushItem[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : raw?.item
            ? [raw.item]
            : [];
      const rateBook = this.loadRateBook();
      const saved: string[] = [];

      try {
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          if (item.op === "review") {
            saved.push(this.applyReview(item));
            continue;
          }
          if (item.op === "budget_upsert") {
            saved.push(this.applyBudgetUpsert(item));
            continue;
          }
          if (item.op === "account_upsert") {
            saved.push(this.applyAccountUpsert(item));
            continue;
          }
          if (item.op === "category_upsert") {
            saved.push(this.applyCategoryUpsert(item));
            continue;
          }
          if (item.op === "rule_upsert") {
            saved.push(this.applyRuleUpsert(item));
            continue;
          }
          if (item.op === "tag_upsert") {
            saved.push(this.applyTagUpsert(item));
            continue;
          }
          if (item.op === "tag_assign") {
            saved.push(this.applyTagAssign(item, true));
            continue;
          }
          if (item.op === "tag_unassign") {
            saved.push(this.applyTagAssign(item, false));
            continue;
          }
          if (item.op === "split_set") {
            saved.push(this.applySplitSet(item));
            continue;
          }
          if (item.op === "recurring_upsert") {
            saved.push(this.applyRecurringUpsert(item));
            continue;
          }
          // Default / explicit upsert — must always push a saved id when item is valid.
          if (item.op === "upsert" || item.op == null || item.id) {
            saved.push(this.applyUpsert(item, rateBook));
          }
        }
      } catch (err) {
        if (isClientError(err)) {
          return Response.json(
            { ok: false, error: err.code, message: err.message, saved },
            { status: err.status },
          );
        }
        throw err;
      }

      if (items.length > 0 && saved.length === 0) {
        return Response.json(
          {
            ok: false,
            error: "sync_empty_saved",
            message: "No items were persisted",
            saved,
          },
          { status: 400 },
        );
      }

      return Response.json({
        ok: true,
        saved,
        sample_fx: fx_convert(1, "USD", "ARS", "2026-09-01", rateBook),
      });
    }

    if (request.method === "GET" && url.pathname === "/transactions") {
      return Response.json({ transactions: this.listTransactionsNormalized() });
    }

    if (request.method === "GET" && url.pathname === "/categories") {
      const yearMonth = url.searchParams.get("month") ?? currentYearMonth();
      return Response.json(this.categoriesPayload(yearMonth));
    }

    if (request.method === "GET" && url.pathname === "/budgets") {
      const yearMonth = url.searchParams.get("month") ?? currentYearMonth();
      return Response.json(this.categoriesPayload(yearMonth));
    }

    if (request.method === "GET" && url.pathname === "/dashboard/spending") {
      const yearMonth = url.searchParams.get("month") ?? currentYearMonth();
      return Response.json(this.spendingPayload(yearMonth));
    }

    if (request.method === "GET" && url.pathname === "/cash-flow") {
      const yearMonth = url.searchParams.get("month") ?? currentYearMonth();
      const range = url.searchParams.get("range");
      const includeExcluded =
        url.searchParams.get("include_excluded") === "1" ||
        url.searchParams.get("include_excluded") === "true";
      const comparisonRaw = url.searchParams.get("comparison");
      const comparison =
        comparisonRaw == null ? true : comparisonRaw !== "0" && comparisonRaw !== "false";
      return Response.json(
        this.cashFlowPayload({
          yearMonth,
          range,
          includeExcluded,
          comparison,
        }),
      );
    }

    if (request.method === "GET" && url.pathname === "/accounts") {
      return Response.json(this.accountsPayload());
    }

    if (request.method === "GET" && url.pathname === "/rules") {
      return Response.json({ rules: this.listNameRules() });
    }

    if (request.method === "GET" && url.pathname === "/tags") {
      return Response.json({
        tags: this.listTags(),
        transaction_tags: this.listTransactionTags(),
      });
    }

    if (request.method === "GET" && url.pathname === "/splits") {
      const txnId = url.searchParams.get("transaction_id") ?? undefined;
      return Response.json({ legs: this.listSplitLegs(txnId) });
    }

    if (request.method === "GET" && url.pathname === "/recurrings") {
      const withinRaw = url.searchParams.get("within_days");
      const within = withinRaw != null && withinRaw !== ""
        ? Number(withinRaw)
        : DEFAULT_UPCOMING_WITHIN_DAYS;
      const all = this.listRecurrings();
      return Response.json({
        recurrings: all,
        upcoming: upcomingRecurrings(all, {
          within_days: Number.isFinite(within) ? within : DEFAULT_UPCOMING_WITHIN_DAYS,
        }),
        within_days: Number.isFinite(within) ? within : DEFAULT_UPCOMING_WITHIN_DAYS,
      });
    }


    return new Response("Not found", { status: 404 });
  }
}

export type { Transaction };
