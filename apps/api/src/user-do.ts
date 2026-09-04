import { DurableObject } from "cloudflare:workers";
import { ACCOUNTS_MIGRATE_SQL, SERVER_SCHEMA, seedBudgetRows, seedCategoryGroupRows, seedCategoryRows } from "@copilot-clone/db";
import {
  balanceDeltaForTxn,
  buildAccountBalanceRows,
  buildCategoryBudgetRows,
  budgetPaceByDay,
  computeCashFlowWithPrior,
  cumulativeSpendByDay,
  currentYearMonth,
  deriveAmounts,
  fx_convert,
  normalizeAccountType,
  normalizeReviewStatus,
  recomputeBalanceFromOpeningAndTxns,
  seedFxRates,
  totalEffectiveBudget,
  type Account,
  type BudgetMonth,
  type Category,
  type CategoryGroup,
  type RateBook,
  type ReviewStatus,
  type Transaction,
} from "@copilot-clone/domain";

export interface Env {
  USER_DO: DurableObjectNamespace<UserDO>;
}

type SyncPushItem = {
  op?: "upsert" | "review" | "budget_upsert" | "account_upsert";
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
  transfer_pair_id?: string | null;
  fingerprint?: string | null;
  account_currency?: string;
  reporting_currency?: string;
  updated_at?: string;
  // budget_upsert
  year_month?: string;
  budgeted_amount?: number;
  rollover_mode?: string;
  rollover_from_prior?: number;
  // account_upsert
  name?: string;
  is_archived?: boolean;
  include_in_net_worth?: boolean;
  current_balance?: number;
};

export class UserDO extends DurableObject<Env> {
  private ready = false;

  private async ensureSchema(): Promise<void> {
    if (this.ready) return;
    this.ctx.storage.sql.exec(SERVER_SCHEMA);
    for (const sql of ACCOUNTS_MIGRATE_SQL) {
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
    this.seedFxIfNeeded();
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
        `INSERT OR REPLACE INTO fx_rates (from_currency, to_currency, on_date, rate)
         VALUES (?, ?, ?, ?)`,
        row.from,
        row.to,
        row.on_date,
        row.rate,
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
      note: row.note == null ? null : String(row.note),
      transfer_pair_id:
        row.transfer_pair_id == null ? null : String(row.transfer_pair_id),
      fingerprint: row.fingerprint == null ? null : String(row.fingerprint),
    };
  }

  private loadRateBook(): RateBook {
    this.seedFxIfNeeded();
    const book: RateBook = {};
    const rows = this.ctx.storage.sql.exec(
      "SELECT from_currency, to_currency, on_date, rate FROM fx_rates",
    );
    for (const row of rows) {
      const from = String(row.from_currency);
      const to = String(row.to_currency);
      const on_date = String(row.on_date);
      const rate = Number(row.rate);
      book[`${from}:${to}:${on_date}`] = rate;
    }
    return book;
  }

  private findByFingerprint(fingerprint: string): string | null {
    const rows = [
      ...this.ctx.storage.sql.exec(
        "SELECT id FROM transactions WHERE fingerprint = ? LIMIT 1",
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
    return [...this.ctx.storage.sql.exec("SELECT * FROM transactions")].map(
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
        note: row.note == null ? null : String(row.note),
        transfer_pair_id:
          row.transfer_pair_id == null ? null : String(row.transfer_pair_id),
        fingerprint: row.fingerprint == null ? null : String(row.fingerprint),
      }),
    );
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
    if (item.fingerprint) {
      const existingId = this.findByFingerprint(item.fingerprint);
      if (existingId && existingId !== item.id) {
        return existingId;
      }
    }

    const amounts = deriveAmounts({
      amount: item.amount!,
      currency: item.currency!,
      account_currency: item.account_currency!,
      reporting_currency: item.reporting_currency!,
      on_date: (item.posted_at ?? new Date().toISOString()).slice(0, 10),
      rate_book: rateBook,
    });
    const now = new Date().toISOString();
    const reviewStatus = normalizeReviewStatus(item.review_status ?? "needs_review");
    const before = item.id ? this.loadTxnDomainById(item.id) : null;

    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO transactions (
        id, account_id, category_id, amount, currency,
        amount_account, amount_reporting, type, is_refund,
        review_status, posted_at, note, transfer_pair_id, fingerprint,
        synced, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      item.id,
      item.account_id,
      item.category_id ?? null,
      item.amount,
      item.currency!.toUpperCase(),
      amounts.amount_account,
      amounts.amount_reporting,
      item.type ?? "regular",
      item.is_refund ? 1 : 0,
      reviewStatus,
      item.posted_at,
      item.note ?? null,
      item.transfer_pair_id ?? null,
      item.fingerprint ?? null,
      now,
      now,
    );

    const after = item.id ? this.loadTxnDomainById(item.id) : null;
    if (before) {
      this.applyAccountBalanceDelta(before.account_id, -balanceDeltaForTxn(before));
    }
    if (after) {
      this.applyAccountBalanceDelta(after.account_id, balanceDeltaForTxn(after));
    }
    return item.id!;
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

  private cashFlowPayload(yearMonth: string) {
    const transactions = this.listTransactionsDomain();
    return computeCashFlowWithPrior({
      transactions,
      year_month: yearMonth,
      reporting_currency: "USD",
    });
  }

  private accountsPayload() {
    const accounts = this.listAccounts();
    const transactions = this.listTransactionsDomain();
    const rateBook = this.loadRateBook();
    const onDate = new Date().toISOString().slice(0, 10);
    const built = buildAccountBalanceRows({
      accounts,
      transactions,
      reporting_currency: "USD",
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
    const rows = buildCategoryBudgetRows({
      categories,
      budgets,
      transactions,
      year_month: yearMonth,
    });
    return {
      year_month: yearMonth,
      reporting_currency: "USD",
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
    const rows = buildCategoryBudgetRows({
      categories,
      budgets,
      transactions,
      year_month: yearMonth,
    });
    const totalBudget = totalEffectiveBudget(rows);
    const cumulative = cumulativeSpendByDay({
      transactions,
      year_month: yearMonth,
      categories,
    });
    const pace = budgetPaceByDay(totalBudget, yearMonth);
    return {
      year_month: yearMonth,
      reporting_currency: "USD",
      total_budget: totalBudget,
      cumulative_spend: cumulative,
      budget_pace: pace,
      spent_mtd: cumulative[cumulative.length - 1] ?? 0,
    };
  }

  private listTransactionsNormalized(): Record<string, unknown>[] {
    const rows = [
      ...this.ctx.storage.sql.exec(
        "SELECT * FROM transactions ORDER BY posted_at DESC",
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

    if (request.method === "POST" && url.pathname === "/fx") {
      const body = (await request.json()) as {
        from: string;
        to: string;
        on_date: string;
        rate: number;
      };
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO fx_rates (from_currency, to_currency, on_date, rate)
         VALUES (?, ?, ?, ?)`,
        body.from.toUpperCase(),
        body.to.toUpperCase(),
        body.on_date,
        body.rate,
      );
      return Response.json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/sync") {
      const body = (await request.json()) as { items: SyncPushItem[] };
      const rateBook = this.loadRateBook();
      const saved: string[] = [];

      for (const item of body.items ?? []) {
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
        saved.push(this.applyUpsert(item, rateBook));
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
      return Response.json(this.cashFlowPayload(yearMonth));
    }

    if (request.method === "GET" && url.pathname === "/accounts") {
      return Response.json(this.accountsPayload());
    }

    return new Response("Not found", { status: 404 });
  }
}

export type { Transaction };
