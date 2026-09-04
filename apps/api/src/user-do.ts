import { DurableObject } from "cloudflare:workers";
import { SERVER_SCHEMA, seedBudgetRows, seedCategoryGroupRows, seedCategoryRows } from "@copilot-clone/db";
import {
  buildCategoryBudgetRows,
  budgetPaceByDay,
  cumulativeSpendByDay,
  currentYearMonth,
  deriveAmounts,
  fx_convert,
  totalEffectiveBudget,
  type BudgetMonth,
  type Category,
  type CategoryGroup,
  type RateBook,
  type Transaction,
} from "@copilot-clone/domain";

export interface Env {
  USER_DO: DurableObjectNamespace<UserDO>;
}

type SyncPushItem = {
  op?: "upsert" | "review" | "budget_upsert";
  id?: string;
  account_id?: string;
  category_id?: string | null;
  amount?: number;
  currency?: string;
  type?: "regular" | "income" | "transfer";
  is_refund?: boolean;
  review_status?: "pending" | "needs_review" | "reviewed" | "excluded";
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
};

export class UserDO extends DurableObject<Env> {
  private ready = false;

  private async ensureSchema(): Promise<void> {
    if (this.ready) return;
    this.ctx.storage.sql.exec(SERVER_SCHEMA);
    this.seedIfEmpty();
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

    // Demo cash account + FX so reporting math works.
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO accounts (id, name, currency, type, is_archived)
       VALUES ('acc-cash-ars', 'Cash ARS', 'ARS', 'cash', 0)`,
    );
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO fx_rates (from_currency, to_currency, on_date, rate)
       VALUES ('USD', 'ARS', '2026-09-01', 1400)`,
    );
  }

  private loadRateBook(): RateBook {
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

  /** Recompute balances from posted transactions (authoritative on DO). */
  balanceForAccount(accountId: string): number {
    const rows = this.ctx.storage.sql.exec(
      `SELECT amount_account, type, is_refund, review_status
       FROM transactions WHERE account_id = ?`,
      accountId,
    );
    let balance = 0;
    for (const row of rows) {
      if (String(row.review_status) === "pending" || String(row.review_status) === "needs_review") continue;
      const amt = Number(row.amount_account);
      const type = String(row.type);
      const isRefund = Number(row.is_refund) === 1;
      if (type === "income") balance += amt;
      else if (type === "regular") balance += isRefund ? amt : -amt;
      else balance -= amt;
    }
    return balance;
  }

  private applyReview(item: SyncPushItem): string {
    const now = item.updated_at ?? new Date().toISOString();
    this.ctx.storage.sql.exec(
      `UPDATE transactions SET review_status = ?, updated_at = ? WHERE id = ?`,
      item.review_status ?? "reviewed",
      now,
      item.id,
    );
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
    // Idempotency: same client id wins; same fingerprint maps to existing row.
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
    // Keep pending/needs_review until client sends an explicit review op.
    const reviewStatus = item.review_status ?? "pending";

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
    return item.id!;
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
        saved.push(this.applyUpsert(item, rateBook));
      }

      return Response.json({
        ok: true,
        saved,
        sample_fx: fx_convert(1, "USD", "ARS", "2026-09-01", rateBook),
      });
    }

    if (request.method === "GET" && url.pathname === "/transactions") {
      const rows = [
        ...this.ctx.storage.sql.exec(
          "SELECT * FROM transactions ORDER BY posted_at DESC",
        ),
      ];
      return Response.json({ transactions: rows });
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

    return new Response("Not found", { status: 404 });
  }
}

export type { Transaction };
