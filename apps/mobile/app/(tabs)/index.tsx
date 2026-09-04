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
import {
  listUpcomingLocal,
  pullRecurringsFromApi,
} from "../../src/offline/recurrings";
import { colors, radius, spacing, type } from "../../src/theme";
import {
  Amount,
  Card,
  EmptySparkle,
  GhostButton,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionHeader,
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
        right={
          <GhostButton
            label={syncing ? "…" : "Sync"}
            onPress={() => void onSync()}
            loading={syncing}
            style={styles.syncBtn}
          />
        }
      />

      <Card
        style={styles.spendCard}
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
            height={140}
          />
        ) : (
          <ActivityIndicator color={colors.accentBlue} style={{ marginTop: 24 }} />
        )}
        {over > 0 ? (
          <View style={styles.callout}>
            <Text style={styles.calloutText}>${over.toFixed(0)} over</Text>
          </View>
        ) : null}
      </Card>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <Card
        style={styles.reviewCard}
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

      <SectionHeader
        title="Next two weeks"
        count={upcoming.length}
        actionLabel="Recurrings ›"
        onAction={() => router.push("/recurrings")}
      />
      {upcoming.length === 0 && !loading ? (
        <Card>
          <Text style={styles.emptyHint}>
            No bills due soon. Add templates under More → Recurrings.
          </Text>
        </Card>
      ) : (
        upcoming.map((r) => (
          <Card key={r.id} padded={false} style={styles.billCard}>
            <TxnRow
              merchant={r.name}
              account={`due ${r.next_expected_date} · ${r.kind}`}
              amountLabel={formatMoney(r.expected_amount, r.currency)}
              onPress={() => router.push("/recurrings")}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  syncBtn: { minWidth: 72, paddingVertical: 8, minHeight: 36 },
  spendCard: { marginBottom: spacing.cardGap },
  heroCenter: { alignItems: "center", marginBottom: spacing.sm },
  spendMeta: { ...type.footnote, marginTop: 4, color: colors.textSecondary },
  callout: {
    alignSelf: "center",
    marginTop: spacing.sm,
    backgroundColor: colors.overBudgetCallout,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  calloutText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  status: { ...type.footnote, color: colors.textPrimary, marginBottom: spacing.sm },
  reviewCard: { marginBottom: spacing.sectionGap },
  linkCenter: {
    ...type.callout,
    color: colors.accentBlue,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.xs,
  },
  billCard: { marginBottom: spacing.sm },
  reviewBtn: { minWidth: 84, minHeight: 36, paddingVertical: 8 },
  emptyHint: { ...type.subhead, textAlign: "center", paddingVertical: spacing.md },
});
