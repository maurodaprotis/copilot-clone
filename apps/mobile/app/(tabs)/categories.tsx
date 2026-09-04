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
import type { CategoryBudgetRow } from "@copilot-clone/domain";
import { currentYearMonth } from "@copilot-clone/domain";
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
  Screen,
  ScreenHeader,
} from "../../src/ui";

function usd(n: number): string {
  return `$${n.toFixed(0)}`;
}

function ProgressBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget <= 0 ? (spent > 0 ? 1 : 0) : Math.min(spent / budget, 1.2);
  const color =
    pct > 1 ? colors.danger : pct > 0.8 ? colors.warning : colors.success;
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          { width: `${Math.min(pct, 1) * 100}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
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

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await pullCategoriesFromApi({ month: yearMonth }).catch(() => false);
      const overview = await getCategoryBudgetOverview(yearMonth);
      const byGroup = overview.groups.map((g) => ({
        id: g.id,
        name: g.name,
        rows: overview.rows
          .filter((r) => r.group_id === g.id)
          .sort((a, b) => a.category.sort_order - b.category.sort_order),
      }));
      setGroups(byGroup);
      setTotals(overview.totals);
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

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
      await syncOutbox(createApiTransport());
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
      <ScreenHeader title="Categories" subtitle={`${yearMonth} · USD budgets`} />

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
                  totals.remaining < 0 ? colors.danger : colors.success,
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

      {groups.map((g) => (
        <View key={g.id} style={styles.group}>
          <Text style={styles.groupTitle}>{g.name}</Text>
          {g.rows.map((row) => (
            <Card key={row.category.id} padded={false} style={styles.rowCard}>
              <Pressable
                style={styles.row}
                onPress={() => {
                  setEditRow(row);
                  setEditAmount(String(row.budgeted_amount));
                  setMsg(null);
                }}
              >
                <Text style={styles.emoji}>{row.category.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.catName}>
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
                  <ProgressBar spent={row.spent} budget={row.effective} />
                  <Text style={styles.remaining}>
                    {usd(row.remaining)} left · tap to edit
                  </Text>
                </View>
              </Pressable>
            </Card>
          ))}
        </View>
      ))}

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
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
  },
  summaryCell: { flex: 1, alignItems: "center" },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.border,
  },
  summaryLabel: { ...type.caption, marginBottom: 4 },
  summaryValue: { ...type.title3 },
  msg: { ...type.footnote, marginBottom: spacing.sm, color: colors.text },
  group: { marginBottom: spacing.md },
  groupTitle: { ...type.caption, marginBottom: spacing.sm, marginLeft: 4 },
  rowCard: { marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  emoji: { fontSize: 22, width: 28, textAlign: "center", marginTop: 2 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: spacing.sm,
  },
  catName: { ...type.headline, flex: 1 },
  amounts: { ...type.callout, fontWeight: "700", color: colors.text },
  amountsMuted: { color: colors.textSecondary, fontWeight: "500" },
  remaining: { ...type.footnote, marginTop: 6 },
  barTrack: {
    height: 6,
    backgroundColor: colors.chipBg,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: radius.pill },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: { ...type.title3, marginBottom: 4 },
  modalHint: { ...type.footnote, marginBottom: spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    marginBottom: spacing.md,
    backgroundColor: colors.chipBg,
    color: colors.text,
    fontSize: 16,
  },
  modalActions: { flexDirection: "row", gap: spacing.sm },
});
