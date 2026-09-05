import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { CategoryBudgetRow, Recurring } from "@copilot-clone/domain";
import { currentYearMonth, isLiabilityAccount } from "@copilot-clone/domain";
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
  const [spend, setSpend] = useState<{
    year_month: string;
    total_budget: number;
    cumulative_spend: number[];
    budget_pace: number[];
    spent_mtd: number;
  } | null>(null);
  const [upcoming, setUpcoming] = useState<Recurring[]>([]);
  const [assets, setAssets] = useState(0);
  const [debts, setDebts] = useState(0);
  const [nwRange, setNwRange] = useState("1M");
  const [topCats, setTopCats] = useState<CategoryBudgetRow[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await pullCategoriesFromApi().catch(() => false);
      const [rows, line, accounts, overview] = await Promise.all([
        listToReview(),
        getSpendingLine(),
        getAccountsOverview().catch(() => null),
        getCategoryBudgetOverview(currentYearMonth()).catch(() => null),
      ]);
      setItems(rows);
      setSpend(line);
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
      if (overview) {
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
        setUpcoming(await listUpcomingLocal(14));
      }
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

  const over = spend != null ? spend.spent_mtd - spend.total_budget : 0;
  const overLabel =
    spend == null
      ? "…"
      : over > 0
        ? `$${over.toFixed(0)} over`
        : over < 0
          ? `$${Math.abs(over).toFixed(0)} under`
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
          ${spend?.total_budget.toFixed(0) ?? "0"} budgeted
        </Text>
      </View>
      {spend ? (
        <SpendingLineChart
          cumulative={spend.cumulative_spend}
          pace={spend.budget_pace}
          width={300}
          height={120}
        />
      ) : (
        <ActivityIndicator color={colors.accentBlue} style={{ marginTop: 16 }} />
      )}
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
          title="You’re all caught up"
          body="0 transactions to unlock intelligence. Add an expense or import a CSV."
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
  emptyHint: { ...type.subhead, textAlign: "center", paddingVertical: spacing.sm },
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
    paddingVertical: 8,
  },
  catEmoji: { fontSize: 16, width: 24, textAlign: "center" },
  catMid: { flex: 1, minWidth: 0, gap: 4 },
  catName: { ...type.headline },
  catAmt: { ...type.amountList },
  upcoming: { marginTop: spacing.cardGap },
});
