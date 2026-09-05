import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import type { CategoryBudgetRow, CategoryGroup } from "@copilot-clone/domain";
import { currentYearMonth } from "@copilot-clone/domain";
import { API_URL, DEMO_USER_ID, getApiUserId } from "../../src/config";
import {
  getCategoryBudgetOverview,
  setBudgetAmount,
} from "../../src/offline/budgets";
import { syncOutbox } from "../../src/offline/syncOutbox";
import { createApiTransport } from "../../src/sync/apiTransport";
import { pullCategoriesFromApi } from "../../src/sync/pullCategories";
import { colors, radius, spacing, type } from "../../src/theme";
import {
  Card,
  EmptyState,
  PrimaryButton,
  ProgressBar,
  Screen,
  ScreenHeader,
} from "../../src/ui";

function usd(n: number): string {
  return `$${n.toFixed(0)}`;
}

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget <= 0 ? (spent > 0 ? 1 : 0) : spent / budget;
  const color =
    pct > 1 ? colors.overBudgetRed : pct > 0.8 ? colors.warning : colors.progressFill;
  return <ProgressBar progress={pct} color={color} height={4} />;
}

type Overview = {
  groups: CategoryGroup[];
  rows: CategoryBudgetRow[];
  totals: { budgeted: number; spent: number; remaining: number };
};

async function fetchCategoriesOverview(yearMonth: string): Promise<Overview | null> {
  try {
    const res = await fetch(
      `${API_URL.replace(/\/$/, "")}/categories?month=${encodeURIComponent(yearMonth)}`,
      { headers: { "x-user-id": getApiUserId() } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      groups?: CategoryGroup[];
      rows?: CategoryBudgetRow[];
      totals?: Overview["totals"];
    };
    if (!data.groups || !data.rows || !data.totals) return null;
    return {
      groups: data.groups,
      rows: data.rows,
      totals: data.totals,
    };
  } catch {
    return null;
  }
}

export default function CategoriesScreen() {
  const yearMonth = currentYearMonth();
  const [groups, setGroups] = useState<
    { id: string; name: string; rows: CategoryBudgetRow[] }[]
  >([]);
  const [totals, setTotals] = useState({ budgeted: 0, spent: 0, remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<CategoryBudgetRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "local">("local");

  const applyOverview = useCallback((overview: Overview) => {
    const byGroup = overview.groups
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        id: g.id,
        name: g.name,
        rows: overview.rows
          .filter((r) => r.group_id === g.id)
          .sort((a, b) => a.category.sort_order - b.category.sort_order),
      }));
    setGroups(byGroup);
    setTotals(overview.totals);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // Prefer API rows for Pages (expo-sqlite/wasm is weak) — same demo user as sync.
      const remote = await fetchCategoriesOverview(yearMonth);
      if (remote && remote.rows.length > 0) {
        applyOverview(remote);
        setSource("api");
        // Best-effort local mirror for native / later offline — ignore web SQLite failures.
        await pullCategoriesFromApi({ month: yearMonth }).catch(() => false);
        return;
      }

      await pullCategoriesFromApi({ month: yearMonth }).catch(() => false);
      const overview = await getCategoryBudgetOverview(yearMonth);
      applyOverview({
        groups: overview.groups,
        rows: overview.rows,
        totals: overview.totals,
      });
      setSource("local");
    } catch {
      setGroups([]);
      setTotals({ budgeted: 0, spent: 0, remaining: 0 });
    } finally {
      setLoading(false);
    }
  }, [yearMonth, applyOverview]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function onSaveBudget() {
    if (!editRow) return;
    const n = Number(editAmount);
    if (!Number.isFinite(n) || n < 0) {
      setMsg("Enter a non-negative budget amount (USD)");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await setBudgetAmount({
        category_id: editRow.category.id,
        year_month: yearMonth,
        budgeted_amount: n,
      });
      // Web already POSTed budget_upsert; native drains outbox. Soft-fail on web memory db.
      await syncOutbox(createApiTransport()).catch(() => ({ pushed: 0 }));
      setEditRow(null);
      await reload();
      setMsg(`Saved ${editRow.category.name} · ${usd(n)}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const hasRows = groups.some((g) => g.rows.length > 0);

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <ScreenHeader title="Categories" />

      <Card style={styles.summary}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Budgeted</Text>
          <Text style={styles.summaryValue}>{usd(totals.budgeted)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Spent</Text>
          <Text style={styles.summaryValue}>{usd(totals.spent)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Left</Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  totals.remaining < 0 ? colors.overBudgetRed : colors.incomeGreen,
              },
            ]}
          >
            {usd(totals.remaining)}
          </Text>
        </View>
      </Card>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      {!hasRows && !loading ? (
        <Card>
          <EmptyState
            icon="📊"
            title="No categories yet"
            body="Pull to sync categories from the API, then tap a row to set a budget."
          />
        </Card>
      ) : null}

      {groups.map((g) =>
        g.rows.length === 0 ? null : (
          <View key={g.id} style={styles.group}>
            <Text style={styles.groupTitle}>{g.name}</Text>
            <Card padded={false} style={styles.groupCard}>
              {g.rows.map((row, idx) => (
                <Pressable
                  key={row.category.id}
                  style={[styles.row, idx > 0 && styles.rowBorder]}
                  onPress={() => {
                    setEditRow(row);
                    setEditAmount(String(row.budgeted_amount));
                    setMsg(null);
                  }}
                >
                  <Text style={styles.emoji}>{row.category.emoji}</Text>
                  <View style={styles.rowMid}>
                    <View style={styles.rowTop}>
                      <Text style={styles.catName} numberOfLines={1}>
                        {row.category.name}
                        {row.category.exclude_from_budget ? " · excluded" : ""}
                      </Text>
                      <Text style={styles.amounts}>
                        {usd(row.spent)}
                        <Text style={styles.amountsMuted}>
                          {" "}
                          / {usd(row.effective)}
                        </Text>
                      </Text>
                    </View>
                    <BudgetBar spent={row.spent} budget={row.effective} />
                  </View>
                  <Text style={styles.chev}>›</Text>
                </Pressable>
              ))}
            </Card>
          </View>
        ),
      )}

      <Modal visible={!!editRow} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editRow?.category.emoji} {editRow?.category.name}
            </Text>
            <Text style={styles.modalHint}>
              Budget for {yearMonth} · reporting USD
            </Text>
            <TextInput
              style={styles.input}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="Budgeted amount"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.modalActions}>
              <PrimaryButton
                label="Cancel"
                variant="ghost"
                onPress={() => setEditRow(null)}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label="Save"
                onPress={() => void onSaveBudget()}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.cardGap,
    paddingVertical: spacing.sm,
  },
  summaryCell: { flex: 1, alignItems: "center" },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.border,
  },
  summaryLabel: { ...type.caption, marginBottom: 2 },
  summaryValue: { ...type.title3 },
  msg: { ...type.footnote, marginBottom: spacing.sm, color: colors.text },
  group: { marginBottom: spacing.cardGap },
  groupTitle: {
    ...type.sectionLabel,
    marginBottom: 6,
    marginLeft: 4,
    color: colors.textTertiary,
  },
  groupCard: { marginBottom: 0 },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderHairline,
  },
  rowMid: { flex: 1, minWidth: 0, gap: 4 },
  chev: { color: colors.textTertiary, fontSize: 18, fontWeight: "300", marginLeft: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 52,
  },
  emoji: { fontSize: 18, width: 24, textAlign: "center" },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  catName: { ...type.headline, flex: 1 },
  amounts: { ...type.callout, fontWeight: "700", color: colors.text },
  amountsMuted: { color: colors.textSecondary, fontWeight: "500" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: { ...type.title3, marginBottom: 4 },
  modalHint: { ...type.footnote, marginBottom: spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    marginBottom: spacing.md,
    backgroundColor: colors.bgMuted,
    color: colors.text,
    fontSize: 16,
  },
  modalActions: { flexDirection: "row", gap: spacing.sm },
});
