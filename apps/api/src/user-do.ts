import { DurableObject } from "cloudflare:workers";
import { SERVER_SCHEMA } from "@copilot-clone/db";
import {
  deriveAmounts,
  fx_convert,
  normalizeReviewStatus,
  seedFxRates,
  type RateBook,
  type ReviewStatus,
  type Transaction,
} from "@copilot-clone/domain";

export interface Env {
  USER_DO: DurableObjectNamespace<UserDO>;
}

type SyncPushItem = {
  op?: "upsert" | "review";
  id: string;
  account_id?: string;
  category_id?: string | null;
  amount?: number;
  currency?: string;
  type?: "regular" | "income" | "transfer";
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
};

export class UserDO extends DurableObject<Env> {
  private ready = false;

  private async ensureSchema(): Promise<void> {
    if (this.ready) return;
    this.ctx.storage.sql.exec(SERVER_SCHEMA);
    // Migrate legacy review_status "pending" → needs_review.
    this.ctx.storage.sql.exec(
      `UPDATE transactions SET review_status = 'needs_review'
       WHERE review_status = 'pending'`,
    );
    this.seedFxIfNeeded();
    this.ready = true;
  }

  /** Seed USD/ARS (rate 1400, rate_book parallel, recent as_of) on first access. */
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

  /** Recompute balances from reviewed transactions (authoritative on DO). */
  balanceForAccount(accountId: string): number {
    const rows = this.ctx.storage.sql.exec(
      `SELECT amount_account, type, is_refund, review_status
       FROM transactions WHERE account_id = ?`,
      accountId,
    );
    let balance = 0;
    for (const row of rows) {
      const review = normalizeReviewStatus(String(row.review_status));
      if (review === "needs_review") continue;
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
    const status = normalizeReviewStatus(item.review_status ?? "reviewed");
    this.ctx.storage.sql.exec(
      `UPDATE transactions SET review_status = ?, updated_at = ? WHERE id = ?`,
      status,
      now,
      item.id,
    );
    return item.id;
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
    return item.id;
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

    return new Response("Not found", { status: 404 });
  }
}

export type { Transaction };
