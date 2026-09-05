import type { LocalDb, SqlValue } from "./types";

type Row = Record<string, SqlValue>;

/**
 * Tiny in-memory stand-in for offline sync unit tests.
 * Handles the SQL shapes used by add / sync / review / queries / budgets.
 */
export function createMemoryDb(): LocalDb & { _tables: Record<string, Map<string, Row>> } {
  const tables: Record<string, Map<string, Row>> = {
    transactions: new Map(),
    outbox: new Map(),
    accounts: new Map(),
    category_groups: new Map(),
    categories: new Map(),
    budget_months: new Map(),
    fx_rates: new Map(),
  };

  function budgetKey(categoryId: string, yearMonth: string): string {
    return `${categoryId}|${yearMonth}`;
  }

  async function runAsync(sql: string, ...p: SqlValue[]): Promise<unknown> {
    const s = sql.replace(/\s+/g, " ").trim();

    if (s.startsWith("INSERT INTO transactions")) {
      const row: Row = {
        id: p[0] as string,
        account_id: p[1] as string,
        category_id: p[2] as string | null,
        amount: p[3] as number,
        currency: p[4] as string,
        amount_account: p[5] as number,
        amount_reporting: p[6] as number,
        type: "regular",
        is_refund: 0,
        review_status: "needs_review",
        posted_at: p[7] as string,
        note: p[8] as string | null,
        transfer_pair_id: null,
        fingerprint: p[9] as string,
        synced: 0,
        created_at: p[10] as string,
        updated_at: p[11] as string,
      };
      tables.transactions.set(String(row.id), row);
      return { changes: 1 };
    }

    if (s.startsWith("INSERT INTO outbox")) {
      const lit = s.match(/VALUES \(\?, \x27([^\x27]+)\x27,/);
      let row: Row;
      if (lit) {
        row = {
          id: p[0] as string,
          entity_type: lit[1]!,
          entity_id: p[1] as string,
          payload: p[2] as string,
          created_at: p[3] as string,
          attempts: 0,
          last_error: null,
        };
      } else {
        row = {
          id: p[0] as string,
          entity_type: p[1] as string,
          entity_id: p[2] as string,
          payload: p[3] as string,
          created_at: p[4] as string,
          attempts: 0,
          last_error: null,
        };
      }
      tables.outbox.set(String(row.id), row);
      return { changes: 1 };
    }

    if (s.startsWith("INSERT OR IGNORE INTO accounts") || s.startsWith("INSERT INTO accounts") || s.startsWith("INSERT OR REPLACE INTO accounts")) {
      const id = String(p[0]);
      const row = {
        id,
        name: p[1] as string,
        currency: p[2] as string,
        type: (p[3] as string) || "other",
        is_archived: Number(p[4] ?? 0),
        include_in_net_worth: Number(p[5] ?? 1),
        current_balance: Number(p[6] ?? 0),
      };
      if (s.startsWith("INSERT OR IGNORE") && tables.accounts.has(id)) {
        return { changes: 0 };
      }
      tables.accounts.set(id, row);
      return { changes: 1 };
    }

    if (
      s.startsWith("INSERT OR IGNORE INTO category_groups") ||
      s.startsWith("INSERT OR REPLACE INTO category_groups")
    ) {
      tables.category_groups.set(String(p[0]), {
        id: p[0] as string,
        name: p[1] as string,
        sort_order: p[2] as number,
        is_system: p[3] as number,
      });
      return { changes: 1 };
    }

    if (
      s.startsWith("INSERT OR IGNORE INTO categories") ||
      s.startsWith("INSERT OR REPLACE INTO categories")
    ) {
      tables.categories.set(String(p[0]), {
        id: p[0] as string,
        group_id: p[1] as string,
        name: p[2] as string,
        emoji: p[3] as string,
        color: p[4] as string,
        exclude_from_budget: p[5] as number,
        is_income_category: p[6] as number,
        archived: p[7] as number,
        sort_order: p[8] as number,
      });
      return { changes: 1 };
    }

    if (
      s.startsWith("INSERT OR IGNORE INTO budget_months") ||
      s.startsWith("INSERT OR REPLACE INTO budget_months") ||
      s.startsWith("INSERT INTO budget_months")
    ) {
      const key = budgetKey(String(p[0]), String(p[1]));
      tables.budget_months.set(key, {
        category_id: p[0] as string,
        year_month: p[1] as string,
        budgeted_amount: p[2] as number,
        rollover_mode: p[3] as string,
        rollover_from_prior: p[4] as number,
      });
      return { changes: 1 };
    }


    if (s.startsWith("INSERT OR IGNORE INTO fx_rates") || s.startsWith("INSERT OR REPLACE INTO fx_rates")) {
      const key = `${p[0]}:${p[1]}:${p[2]}`;
      if (s.startsWith("INSERT OR IGNORE") && tables.fx_rates.has(key)) {
        return { changes: 0 };
      }
      tables.fx_rates.set(key, {
        from_currency: p[0] as string,
        to_currency: p[1] as string,
        on_date: p[2] as string,
        rate: p[3] as number,
      });
      return { changes: 1 };
    }

    if (s.startsWith("DELETE FROM outbox WHERE id =")) {
      tables.outbox.delete(String(p[0]));
      return { changes: 1 };
    }

    if (s.startsWith("UPDATE outbox SET attempts")) {
      const row = tables.outbox.get(String(p[1]));
      if (row) {
        row.attempts = Number(row.attempts ?? 0) + 1;
        row.last_error = p[0] as string;
      }
      return { changes: 1 };
    }

    if (s.startsWith("UPDATE transactions SET synced = 1")) {
      const row = tables.transactions.get(String(p[1]));
      if (row) {
        row.synced = 1;
        row.updated_at = p[0] as string;
      }
      return { changes: 1 };
    }

    if (s.startsWith("UPDATE transactions SET review_status =")) {
      if (s.includes("WHERE review_status = 'pending'") && p.length === 0) {
        for (const row of tables.transactions.values()) {
          if (row.review_status === "pending") row.review_status = "needs_review";
        }
        return { changes: 1 };
      }
      const row = tables.transactions.get(String(p[2]));
      if (row) {
        row.review_status = p[0] as string;
        row.synced = 0;
        row.updated_at = p[1] as string;
      }
      return { changes: 1 };
    }

    if (s.startsWith("UPDATE accounts SET current_balance = current_balance +")) {
      const row = tables.accounts.get(String(p[1]));
      if (row) {
        row.current_balance = Number(row.current_balance ?? 0) + Number(p[0] ?? 0);
      }
      return { changes: 1 };
    }

    if (s.startsWith("UPDATE accounts SET current_balance =")) {
      const row = tables.accounts.get(String(p[1]));
      if (row) {
        row.current_balance = Number(p[0] ?? 0);
      }
      return { changes: 1 };
    }

    if (s.startsWith("UPDATE accounts SET type =")) {
      const from = s.match(/WHERE type = '([^']+)'/);
      const to = s.match(/SET type = '([^']+)'/);
      if (from && to) {
        for (const row of tables.accounts.values()) {
          if (row.type === from[1]) row.type = to[1]!;
        }
      }
      return { changes: 1 };
    }

    throw new Error(`memory db unsupported SQL: ${s}`);
  }

  async function getAllAsync<T>(sql: string, ...p: SqlValue[]): Promise<T[]> {
    const s = sql.replace(/\s+/g, " ").trim();

    if (s.includes("FROM outbox")) {
      return [...tables.outbox.values()].sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at)),
      ) as T[];
    }

    if (s.includes("FROM category_groups")) {
      return [...tables.category_groups.values()].sort(
        (a, b) => Number(a.sort_order) - Number(b.sort_order),
      ) as T[];
    }

    if (s.includes("FROM categories")) {
      return [...tables.categories.values()].sort(
        (a, b) => Number(a.sort_order) - Number(b.sort_order),
      ) as T[];
    }

    if (s.includes("FROM budget_months")) {
      let rows = [...tables.budget_months.values()];
      if (s.includes("WHERE year_month")) {
        rows = rows.filter((r) => r.year_month === p[0]);
      }
      return rows as T[];
    }

    if (
      s.includes("review_status IN ('needs_review', 'pending')") ||
      s.includes("review_status = 'needs_review'") ||
      (s.includes("review_status") && s.includes("'pending'") && s.includes("WHERE"))
    ) {
      return [...tables.transactions.values()]
        .filter((r) => r.review_status === "needs_review" || r.review_status === "pending")
        .sort((a, b) => String(b.posted_at).localeCompare(String(a.posted_at))) as T[];
    }

    if (s.includes("FROM accounts")) {
      return [...tables.accounts.values()].sort((a, b) => {
        const t = String(a.type).localeCompare(String(b.type));
        if (t !== 0) return t;
        return String(a.name).localeCompare(String(b.name));
      }) as T[];
    }

    if (s.includes("FROM fx_rates")) {
      return [...tables.fx_rates.values()] as T[];
    }

    if (s.includes("FROM transactions")) {
      return [...tables.transactions.values()].sort((a, b) =>
        String(b.posted_at).localeCompare(String(a.posted_at)),
      ) as T[];
    }

    if (s.includes("COUNT(*)")) {
      return [{ c: tables.outbox.size } as T];
    }

    return [];
  }

  async function getFirstAsync<T>(sql: string, ...p: SqlValue[]): Promise<T | null> {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.includes("COUNT(*)")) {
      return { c: tables.outbox.size } as T;
    }
    if (s.includes("FROM transactions WHERE id =")) {
      return (tables.transactions.get(String(p[0])) as T) ?? null;
    }
    const rows = await getAllAsync<T>(sql, ...p);
    return rows[0] ?? null;
  }

  return {
    _tables: tables,
    async withTransactionAsync(fn) {
      await fn();
    },
    runAsync,
    getAllAsync,
    getFirstAsync,
  };
}
