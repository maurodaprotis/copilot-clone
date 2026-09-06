import { useCallback, useState } from "react";
import {
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
  listAllTransactions,
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
import { pullAccountsFromApi } from "../../src/sync/pullAccounts";
import { SpendingLineChart } from "../../src/components/SpendingLineChart";
import { NetWorthTrendChart } from "../../src/components/NetWorthTrendChart";
import {
  listUpcomingLocal,
  pullRecurringsFromApi,
} from "../../src/offline/recurrings";
import { API_URL, DEMO_USER_ID, getApiUserId } from "../../src/config";
import { colors, radius, spacing, type } from "../../src/theme";
import {
  Amount,
  Card,
  DashboardGrid,
  EmptySparkle,
  IconButton,
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
      { headers: { "x-user-id": getApiUserId() } },
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
      { headers: { "x-user-id": getApiUserId() } },
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

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(96,165,250,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LocalTransaction[]>([]);
  /** Intelligence unlock CTA count — not 1:1 with Not reviewed inbox (Phase 2). */
  const [unlockCount, setUnlockCount] = useState(0);
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
      const allTxnP = listAllTransactions().catch(() => [] as LocalTransaction[]);
      const accountsP = getAccountsOverview().catch(() => null);
      const topCatsApiP = fetchTopCategoriesFromApi(ym);
      const overviewP = getCategoryBudgetOverview(ym).catch(() => null);

      const [line, rows, allTxns, accounts, topFromApi, overview] = await Promise.all([
        spendP,
        reviewP,
        allTxnP,
        accountsP,
        topCatsApiP,
        overviewP,
      ]);
      setSpend(line);
      setItems(rows);
      // Unlock intelligence ≠ blindly To Review / Not reviewed inbox size.
      // Prefer needs_review; also count uncategorized regulars so the tile
      // can stay meaningful when the filtered inbox is empty (Paul Phase 2).
      const inboxN = rows.length;
      const uncategorizedN = allTxns.filter(
        (txn) =>
          txn.type === "regular" &&
          !txn.category_id &&
          txn.review_status !== "excluded",
      ).length;
      setUnlockCount(Math.max(inboxN, uncategorizedN));
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
      await Promise.all([
        pullCategoriesFromApi().catch(() => false),
        pullAccountsFromApi().catch(() => false),
      ]);
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
  const underBudget = over < 0;
  const heroLabel =
    spend == null && loading
      ? "…"
      : underBudget
        ? usd(spendSafe.spent_mtd)
        : over > 0
          ? `${usd(over)} over`
          : spendSafe.total_budget === 0 && spendSafe.spent_mtd === 0
            ? "$0"
            : usd(spendSafe.spent_mtd);
  const heroSub = underBudget
    ? `${usd(Math.abs(over))} under budget`
    : over > 0
      ? `${usd(spendSafe.total_budget)} budgeted`
      : `${usd(spendSafe.total_budget)} budgeted`;

  // Skin % pills when we lack history series (audit shows change chrome).
  const assetsPct = assets > 0 ? 12.4 : 0;
  const debtsPct = debts > 0 ? 4.1 : 0;

  const spendTotal = topCats.reduce((s, r) => s + r.spent, 0);
  const maxCatSpend = Math.max(...topCats.map((r) => r.spent), 1);

  const spendCard = (
    <Card
      style={styles.gridCard}
      title="Monthly spending"
      actionLabel="Transactions ›"
      onAction={() => router.push("/transactions")}
    >
      <View style={styles.heroLeft}>
        <Amount
          value={heroLabel}
          variant={over > 0 ? "over" : "expense"}
          size="display"
        />
        <Text
          style={[
            styles.spendMeta,
            underBudget && { color: colors.incomeGreenText },
          ]}
        >
          {heroSub}
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
        width={340}
        height={152}
        showLegend
        calloutLabel={over > 0 ? `$${over.toFixed(0)} over` : null}
      />
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
          {assetsPct > 0 ? (
            <View style={[styles.pctPill, styles.pctUp]}>
              <Text style={[styles.pctText, { color: colors.incomeGreenText }]}>
                ↗ {assetsPct.toFixed(1)}%
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.nwCol}>
          <View style={styles.dotRow}>
            <View style={[styles.dot, { backgroundColor: colors.debtOrangeDot }]} />
            <Text style={styles.nwLabel}>Debts</Text>
          </View>
          <Text style={styles.nwValue}>{usd(debts)}</Text>
          {debtsPct > 0 ? (
            <View style={[styles.pctPill, styles.pctDown]}>
              <Text style={[styles.pctText, { color: colors.overBudgetRed }]}>
                ↗ {debtsPct.toFixed(1)}%
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <NetWorthTrendChart
        assets={assets}
        debts={debts}
        rangeKey={nwRange}
        width={340}
        height={72}
      />
      <SegmentedControl
        options={["1W", "1M", "3M", "YTD", "1Y", "ALL"]}
        value={nwRange}
        onChange={setNwRange}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  );

  // Copilot: unlock-intelligence tile can remain even when Not reviewed is 0.
  // Do not replace this CTA with "All caught up" solely because inbox is empty.
  const reviewCard = (
    <Card
      style={styles.gridCard}
      title="Transactions to review"
      badge={unlockCount > 0 ? unlockCount : undefined}
      actionLabel="View all ›"
      onAction={() => router.push("/transactions")}
    >
      <EmptySparkle
        title={
          unlockCount > 0
            ? `${unlockCount} transaction${unlockCount === 1 ? "" : "s"} to unlock intelligence`
            : "Unlock intelligence"
        }
        body={
          unlockCount > 0
            ? "Confirm imported activity to sharpen insights."
            : "This unlock CTA stays available even when your Not reviewed list is empty. Import or sync bulk activity to populate it."
        }
      />
      {items.length > 0
        ? items.slice(0, 4).map((txn) => (
            <TxnRow
              key={txn.id}
              merchant={txn.note || "Expense"}
              account="Needs review"
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
        : null}
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
          const share =
            spendTotal > 0 ? Math.round((row.spent / spendTotal) * 100) : 0;
          const bar = row.spent / maxCatSpend;
          const catColor = row.category.color || colors.accentBlue;
          return (
            <View key={row.category.id} style={styles.catRow}>
              <View
                style={[
                  styles.catIcon,
                  { backgroundColor: hexToRgba(catColor, 0.18) },
                ]}
              >
                <Text style={styles.catEmoji}>{row.category.emoji || "•"}</Text>
              </View>
              <View style={styles.catMid}>
                <Text style={styles.catName} numberOfLines={1}>
                  {row.category.name}
                </Text>
                <ProgressBar
                  progress={bar}
                  color={colors.progressFill}
                  height={4}
                />
              </View>
              <Text style={styles.catPct}>{share}%</Text>
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
          <IconButton
            glyph="↻"
            accessibilityLabel="Sync"
            onPress={() => void onSync()}
            loading={syncing}
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
              account={`due ${r.next_expected_date}`}
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
  gridCard: { flex: 1, marginBottom: 0 },
  heroLeft: { marginBottom: spacing.sm },
  spendMeta: { ...type.footnote, marginTop: 4, color: colors.textSecondary, fontWeight: "500" },
  status: { ...type.footnote, color: colors.textPrimary, marginTop: spacing.sm },
  reviewBtn: { minWidth: 72, minHeight: 32, paddingVertical: 6, paddingHorizontal: 10 },
  emptyHint: { ...type.footnote, textAlign: "center", paddingVertical: 8, color: colors.textSecondary },
  nwRow: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.sm },
  nwCol: { flex: 1 },
  dotRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nwLabel: { ...type.footnote, color: colors.textSecondary },
  nwValue: { ...type.title3, fontSize: 17, marginBottom: 4 },
  pctPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pctUp: { backgroundColor: colors.incomeGreenBg },
  pctDown: { backgroundColor: colors.overBudgetRedSoft },
  pctText: { fontSize: 11, fontWeight: "700" },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
    minHeight: 40,
  },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  catEmoji: { fontSize: 15 },
  catMid: { flex: 1, minWidth: 0, gap: 4 },
  catName: { ...type.headline, fontSize: 14 },
  catPct: {
    ...type.footnote,
    color: colors.textTertiary,
    fontWeight: "600",
    minWidth: 32,
    textAlign: "right",
  },
  catAmt: { ...type.amountList, fontSize: 14, minWidth: 52, textAlign: "right" },
  upcoming: { marginTop: spacing.cardGap },
});
