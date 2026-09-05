import { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { CategoryBudgetRow, Recurring } from "@copilot-clone/domain";
import {
  currentYearMonth,
  daysInYearMonth,
  isLiabilityAccount,
} from "@copilot-clone/domain";
import {
  listToReview,
  type LocalTransaction,
} from "../../src/offline/queries";
import {
  getCategoryBudgetOverview,
  getSpendingLine,
} from "../../src/offline/budgets";
import { getAccountsOverview } from "../../src/offline/accounts";
import { reviewTransaction } from "../../src/offline/reviewTransaction";
import { syncOutbox } from "../../src/offline/syncOutbox";
import { createApiTransport } from "../../src/sync/apiTransport";
import { pullCategoriesFromApi } from "../../src/sync/pullCategories";
import { SpendingLineChart } from "../../src/components/SpendingLineChart";
import {
  listUpcomingLocal,
  pullRecurringsFromApi,
} from "../../src/offline/recurrings";
import { API_URL, DEMO_USER_ID } from "../../src/config";
import { colors, radius, spacing, type } from "../../src/theme";
import {
  Amount,
  Card,
  DashboardGrid,
  EmptySparkle,
  GhostButton,
  PrimaryButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  SegmentedControl,
  TxnRow,
} from "../../src/ui";

type SpendLine = {
  year_month: string;
  total_budget: number;
  cumulative_spend: number[];
  budget_pace: number[];
  spent_mtd: number;
};

function emptySpend(yearMonth = currentYearMonth()): SpendLine {
  const days = daysInYearMonth(yearMonth);
  return {
    year_month: yearMonth,
    total_budget: 0,
    cumulative_spend: Array.from({ length: days }, () => 0),
    budget_pace: Array.from({ length: days }, () => 0),
    spent_mtd: 0,
  };
}

async function fetchSpendingLine(yearMonth: string): Promise<SpendLine> {
  try {
    const res = await fetch(
      `${API_URL.replace(/\/$/, "")}/dashboard/spending?month=${encodeURIComponent(yearMonth)}`,
      { headers: { "x-user-id": DEMO_USER_ID } },
    );
    if (res.ok) {
      const json = (await res.json()) as SpendLine;
      if (json && Array.isArray(json.cumulative_spend)) return json;
    }
  } catch {
    // fall through
  }
  try {
    return await getSpendingLine(yearMonth);
  } catch {
    return emptySpend(yearMonth);
  }
}

/** Same Categories API as the Categories tab (Pages-safe; expo-sqlite/wasm is weak). */
async function fetchTopCategoriesFromApi(
  yearMonth: string,
): Promise<CategoryBudgetRow[] | null> {
  try {
    const res = await fetch(
      `${API_URL.replace(/\/$/, "")}/categories?month=${encodeURIComponent(yearMonth)}`,
      { headers: { "x-user-id": DEMO_USER_ID } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { rows?: CategoryBudgetRow[] };
    if (!data.rows || data.rows.length === 0) return null;
    return [...data.rows]
      .filter((r) => r.spent > 0 || r.budgeted_amount > 0)
      .sort((x, y) => y.spent - x.spent)
      .slice(0, 5);
  } catch {
    return null;
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LocalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [spend, setSpend] = useState<SpendLine | null>(null);
  const [upcoming, setUpcoming] = useState<Recurring[]>([]);
  const [assets, setAssets] = useState(0);
  const [debts, setDebts] = useState(0);
  const [nwRange, setNwRange] = useState("1M");
  const [topCats, setTopCats] = useState<CategoryBudgetRow[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    const ym = currentYearMonth();
    try {
      await pullCategoriesFromApi().catch(() => false);

      const spendP = fetchSpendingLine(ym);
      const reviewP = listToReview().catch(() => [] as LocalTransaction[]);
      const accountsP = getAccountsOverview().catch(() => null);
      // Prefer API rows for Pages (same source as Categories tab).
      const topCatsApiP = fetchTopCategoriesFromApi(ym);
      const overviewP = getCategoryBudgetOverview(ym).catch(() => null);

      const [line, rows, accounts, topFromApi, overview] = await Promise.all([
        spendP,
        reviewP,
        accountsP,
        topCatsApiP,
        overviewP,
      ]);
      setSpend(line);
      setItems(rows);
      if (accounts) {
        let a = 0;
        let d = 0;
        for (const row of accounts.rows) {
          if (!row.account.include_in_net_worth || row.account.is_archived) continue;
          if (isLiabilityAccount(row.account)) d += Math.abs(row.balance_reporting);
          else a += row.balance_reporting;
        }
        setAssets(a);
        setDebts(d);
      }
      if (topFromApi && topFromApi.length > 0) {
        setTopCats(topFromApi);
      } else if (overview) {
        setTopCats(
          [...overview.rows]
            .filter((r) => r.spent > 0 || r.budgeted_amount > 0)
            .sort((x, y) => y.spent - x.spent)
            .slice(0, 5),
        );
      }
      try {
        const pulled = await pullRecurringsFromApi(14);
        setUpcoming(pulled.upcoming);
      } catch {
        setUpcoming(await listUpcomingLocal(14).catch(() => []));
      }
    } catch {
      setSpend((prev) => prev ?? emptySpend(ym));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function onSync() {
    setSyncing(true);
    setStatus(null);
    try {
      const result = await syncOutbox(createApiTransport());
      await pullCategoriesFromApi();
      setStatus(
        result.pushed > 0
          ? `Synced ${result.pushed} item(s)`
          : "Everything is up to date",
      );
      await reload();
    } catch (e) {
      setStatus(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function onReview(id: string) {
    try {
      await reviewTransaction(id);
      await syncOutbox(createApiTransport());
      await reload();
    } catch (e) {
      setStatus(`Review failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const spendSafe = spend ?? emptySpend();
  const over = spendSafe.spent_mtd - spendSafe.total_budget;
  const overLabel =
    spend == null && loading
      ? "…"
      : over > 0
        ? `$${over.toFixed(0)} over`
        : over < 0
          ? `$${Math.abs(over).toFixed(0)} under`
          : spendSafe.total_budget === 0 && spendSafe.spent_mtd === 0
            ? "$0"
            : "On budget";

  const spendCard = (
    <Card
      style={styles.gridCard}
      title="Monthly spending"
      actionLabel="Transactions ›"
      onAction={() => router.push("/transactions")}
    >
      <View style={styles.heroCenter}>
        <Amount
          value={overLabel}
          variant={over > 0 ? "over" : "expense"}
          size="display"
          style={{ textAlign: "center" }}
        />
        <Text style={styles.spendMeta}>
          ${spendSafe.total_budget.toFixed(0)} budgeted
        </Text>
      </View>
      <SpendingLineChart
        cumulative={spendSafe.cumulative_spend}
        pace={
          spendSafe.budget_pace.length
            ? spendSafe.budget_pace
            : spendSafe.cumulative_spend.map((_, i, arr) =>
                arr.length <= 1
                  ? spendSafe.total_budget
                  : (spendSafe.total_budget * i) / (arr.length - 1),
              )
        }
        width={300}
        height={96}
      />
      {over > 0 ? (
        <View style={styles.callout}>
          <Text style={styles.calloutText}>${over.toFixed(0)} over</Text>
        </View>
      ) : null}
    </Card>
  );

  const netWorthCard = (
    <Card
      style={styles.gridCard}
      title="Net worth"
      actionLabel="Accounts ›"
      onAction={() => router.push("/accounts")}
    >
      <View style={styles.nwRow}>
        <View style={styles.nwCol}>
          <View style={styles.dotRow}>
            <View style={[styles.dot, { backgroundColor: colors.assetBlueDot }]} />
            <Text style={styles.nwLabel}>Assets</Text>
          </View>
          <Text style={styles.nwValue}>{usd(assets)}</Text>
        </View>
        <View style={styles.nwCol}>
          <View style={styles.dotRow}>
            <View style={[styles.dot, { backgroundColor: colors.debtOrangeDot }]} />
            <Text style={styles.nwLabel}>Debts</Text>
          </View>
          <Text style={styles.nwValue}>{usd(debts)}</Text>
        </View>
      </View>
      <SegmentedControl
        options={["1W", "1M", "3M", "YTD", "1Y", "ALL"]}
        value={nwRange}
        onChange={setNwRange}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  );

  const reviewCard = (
    <Card
      style={styles.gridCard}
      title="Transactions to review"
      actionLabel={items.length ? "View all ›" : undefined}
      onAction={items.length ? () => router.push("/transactions") : undefined}
    >
      {items.length === 0 && !loading ? (
        <EmptySparkle
          title="You're all caught up"
          body="No transactions to unlock intelligence."
          ctaLabel="Add transaction"
          onCta={() => router.push("/transactions")}
          secondary={
            <Pressable onPress={() => router.push("/import")}>
              <Text style={styles.linkCenter}>Import CSV</Text>
            </Pressable>
          }
        />
      ) : (
        items.slice(0, 4).map((txn) => (
          <TxnRow
            key={txn.id}
            merchant={txn.note || "Expense"}
            account={txn.synced ? "Needs review" : "Unsynced · needs review"}
            amountLabel={formatMoney(txn.amount, txn.currency)}
            trailing={
              <PrimaryButton
                label="Review"
                variant="secondary"
                onPress={() => void onReview(txn.id)}
                style={styles.reviewBtn}
              />
            }
          />
        ))
      )}
    </Card>
  );

  const topCatsCard = (
    <Card
      style={styles.gridCard}
      title="Top categories"
      actionLabel="View all ›"
      onAction={() => router.push("/categories")}
    >
      {topCats.length === 0 && !loading ? (
        <Text style={styles.emptyHint}>No spending this month yet.</Text>
      ) : (
        topCats.map((row) => {
          const pct =
            row.budgeted_amount > 0
              ? Math.min(1, row.spent / row.budgeted_amount)
              : row.spent > 0
                ? 1
                : 0;
          return (
            <View key={row.category.id} style={styles.catRow}>
              <Text style={styles.catEmoji}>{row.category.emoji || "•"}</Text>
              <View style={styles.catMid}>
                <Text style={styles.catName} numberOfLines={1}>
                  {row.category.name}
                </Text>
                <ProgressBar
                  progress={pct}
                  color={pct > 1 ? colors.overBudgetRed : colors.progressFill}
                />
              </View>
              <Text style={styles.catAmt}>{usd(row.spent)}</Text>
            </View>
          );
        })
      )}
    </Card>
  );

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <ScreenHeader
        title="Dashboard"
        right={
          <GhostButton
            label={syncing ? "…" : "Sync"}
            onPress={() => void onSync()}
            loading={syncing}
            style={styles.syncBtn}
          />
        }
      />

      <DashboardGrid>
        {spendCard}
        {netWorthCard}
        {reviewCard}
        {topCatsCard}
      </DashboardGrid>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <Card
        style={styles.upcoming}
        title="Next two weeks"
        actionLabel="Recurrings ›"
        onAction={() => router.push("/recurrings")}
      >
        {upcoming.length === 0 && !loading ? (
          <Text style={styles.emptyHint}>
            No bills due soon. Add templates under More → Recurrings.
          </Text>
        ) : (
          upcoming.map((r) => (
            <TxnRow
              key={r.id}
              merchant={r.name}
              account={`due ${r.next_expected_date} · ${r.kind}`}
              amountLabel={formatMoney(r.expected_amount, r.currency)}
              onPress={() => router.push("/recurrings")}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  syncBtn: { minWidth: 72, paddingVertical: 8, minHeight: 36 },
  gridCard: { flex: 1, marginBottom: 0 },
  heroCenter: { alignItems: "center", marginBottom: spacing.xs },
  spendMeta: { ...type.footnote, marginTop: 2, color: colors.textSecondary },
  callout: {
    alignSelf: "center",
    marginTop: spacing.sm,
    backgroundColor: colors.overBudgetCallout,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  calloutText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  status: { ...type.footnote, color: colors.textPrimary, marginTop: spacing.sm },
  linkCenter: {
    ...type.callout,
    color: colors.accentBlue,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.xs,
  },
  reviewBtn: { minWidth: 84, minHeight: 36, paddingVertical: 8 },
  emptyHint: { ...type.footnote, textAlign: "center", paddingVertical: 2, color: colors.textSecondary },
  nwRow: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.xs },
  nwCol: { flex: 1 },
  dotRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nwLabel: { ...type.footnote, color: colors.textSecondary },
  nwValue: { ...type.title2 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 4,
    minHeight: 36,
  },
  catEmoji: { fontSize: 16, width: 24, textAlign: "center" },
  catMid: { flex: 1, minWidth: 0, gap: 3 },
  catName: { ...type.headline },
  catAmt: { ...type.amountList },
  upcoming: { marginTop: spacing.cardGap },
});
