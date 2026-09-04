import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { Recurring } from "@copilot-clone/domain";
import {
  listToReview,
  type LocalTransaction,
} from "../../src/offline/queries";
import { getSpendingLine } from "../../src/offline/budgets";
import { reviewTransaction } from "../../src/offline/reviewTransaction";
import { syncOutbox } from "../../src/offline/syncOutbox";
import { createApiTransport } from "../../src/sync/apiTransport";
import { pullCategoriesFromApi } from "../../src/sync/pullCategories";
import { SpendingLineChart } from "../../src/components/SpendingLineChart";
import { API_URL } from "../../src/config";
import {
  listUpcomingLocal,
  pullRecurringsFromApi,
} from "../../src/offline/recurrings";
import { colors, radius, spacing, type } from "../../src/theme";
import {
  Card,
  EmptyState,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionHeader,
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

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await pullCategoriesFromApi().catch(() => false);
      const [rows, line] = await Promise.all([
        listToReview(),
        getSpendingLine(),
      ]);
      setItems(rows);
      setSpend(line);
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

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <ScreenHeader
        title="Dashboard"
        subtitle="Spending, bills, and review inbox"
        right={
          <PrimaryButton
            label={syncing ? "…" : "Sync"}
            onPress={() => void onSync()}
            loading={syncing}
            variant="ghost"
            style={styles.syncBtn}
          />
        }
      />

      <Card style={styles.spendCard}>
        <View style={styles.spendHeader}>
          <Text style={styles.spendTitle}>Monthly spending</Text>
          <Pressable onPress={() => router.push("/transactions")}>
            <Text style={styles.link}>Transactions ›</Text>
          </Pressable>
        </View>
        <Text
          style={[
            styles.spendHero,
            { color: over > 0 ? colors.danger : colors.text },
          ]}
        >
          {overLabel}
        </Text>
        <Text style={styles.spendMeta}>
          ${spend?.spent_mtd.toFixed(0) ?? "0"} spent · $
          {spend?.total_budget.toFixed(0) ?? "0"} budgeted ·{" "}
          {spend?.year_month ?? "…"}
        </Text>
        {spend ? (
          <SpendingLineChart
            cumulative={spend.cumulative_spend}
            pace={spend.budget_pace}
            width={300}
            height={140}
          />
        ) : (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        )}
      </Card>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <SectionHeader
        title="Upcoming bills"
        count={upcoming.length}
        actionLabel="Recurrings ›"
        onAction={() => router.push("/recurrings")}
      />
      {upcoming.length === 0 && !loading ? (
        <Card style={{ marginBottom: spacing.md }}>
          <EmptyState
            icon="📅"
            title="No bills due soon"
            body="Nothing in the next 14 days. Add templates under More → Recurrings."
            ctaLabel="Add recurring"
            onCta={() => router.push("/recurrings")}
          />
        </Card>
      ) : (
        upcoming.map((r) => (
          <Card key={r.id} padded={false} style={styles.billCard}>
            <Pressable
              style={styles.billRow}
              onPress={() => router.push("/recurrings")}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{r.name}</Text>
                <Text style={styles.cardMeta}>
                  due {r.next_expected_date} · {r.kind} · {r.cadence}
                </Text>
              </View>
              <Text style={styles.amount}>
                {formatMoney(r.expected_amount, r.currency)}
              </Text>
            </Pressable>
          </Card>
        ))
      )}

      <SectionHeader
        title="To Review"
        count={items.length}
        actionLabel="View all ›"
        onAction={() => router.push("/transactions")}
      />

      {items.length === 0 && !loading ? (
        <Card>
          <EmptyState
            icon="✨"
            title="Inbox zero"
            body="No transactions need review. Add an expense or import a CSV to unlock intelligence."
            ctaLabel="Add transaction"
            onCta={() => router.push("/transactions")}
            secondary={
              <Pressable onPress={() => router.push("/import")}>
                <Text style={styles.linkCenter}>Import CSV</Text>
              </Pressable>
            }
          />
        </Card>
      ) : null}

      {items.map((txn) => (
        <Card key={txn.id} style={styles.reviewCard} padded={false}>
          <View style={styles.reviewRow}>
            <View style={styles.reviewDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {txn.note || "Expense"}
                {!txn.synced ? " · unsynced" : ""}
              </Text>
              <Text style={styles.cardMeta}>
                {txn.posted_at.slice(0, 10)} · needs review
              </Text>
            </View>
            <Text style={styles.amount}>
              {formatMoney(txn.amount, txn.currency)}
            </Text>
            <PrimaryButton
              label="Review"
              variant="secondary"
              onPress={() => void onReview(txn.id)}
              style={styles.reviewBtn}
            />
          </View>
        </Card>
      ))}

      <Text style={styles.apiHint}>{API_URL.replace("https://", "")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  syncBtn: { minWidth: 72, paddingVertical: 8, minHeight: 36 },
  spendCard: { marginBottom: spacing.lg },
  spendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  spendTitle: { ...type.headline },
  link: { ...type.callout, color: colors.primary, fontWeight: "600" },
  linkCenter: {
    ...type.callout,
    color: colors.primary,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.xs,
  },
  spendHero: { ...type.moneyHero, marginBottom: 2 },
  spendMeta: { ...type.footnote, marginBottom: spacing.sm },
  status: { ...type.footnote, color: colors.text, marginBottom: spacing.sm },
  billCard: { marginBottom: spacing.sm },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  reviewCard: { marginBottom: spacing.sm },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  reviewDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  cardTitle: { ...type.headline },
  cardMeta: { ...type.footnote, marginTop: 2 },
  amount: { ...type.money, marginRight: 4 },
  reviewBtn: { minWidth: 84, minHeight: 36, paddingVertical: 8 },
  apiHint: {
    ...type.caption,
    textAlign: "center",
    marginTop: spacing.xl,
    color: colors.textTertiary,
  },
});
