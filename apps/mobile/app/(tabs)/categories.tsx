import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
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

function usd(n: number): string {
  return `$${n.toFixed(0)}`;
}

function ProgressBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget <= 0 ? (spent > 0 ? 1 : 0) : Math.min(spent / budget, 1.2);
  const color = pct > 1 ? "#ef4444" : pct > 0.8 ? "#f59e0b" : "#10b981";
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
      setMsg(`Saved ${editRow.category.name} budget ${usd(n)}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void reload()} />
      }
    >
      <Text style={styles.title}>Categories</Text>
      <Text style={styles.sub}>
        {yearMonth} · budgets in reporting USD · no rebalance yet
      </Text>

      <View style={styles.summary}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Budgeted</Text>
          <Text style={styles.summaryValue}>{usd(totals.budgeted)}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Spent</Text>
          <Text style={styles.summaryValue}>{usd(totals.spent)}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Remaining</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: totals.remaining < 0 ? "#ef4444" : "#0d9488" },
            ]}
          >
            {usd(totals.remaining)}
          </Text>
        </View>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      {groups.map((g) => (
        <View key={g.id} style={styles.group}>
          <Text style={styles.groupTitle}>{g.name}</Text>
          {g.rows.map((row) => (
            <Pressable
              key={row.category.id}
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
                    {usd(row.spent)} / {usd(row.effective)}
                  </Text>
                </View>
                <ProgressBar spent={row.spent} budget={row.effective} />
                <Text style={styles.remaining}>
                  Remaining {usd(row.remaining)} · tap to edit budget
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}

      <Modal visible={!!editRow} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Edit budget · {editRow?.category.emoji} {editRow?.category.name}
            </Text>
            <Text style={styles.modalHint}>
              Month {yearMonth} · amount in USD (reporting)
            </Text>
            <TextInput
              style={styles.input}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="Budgeted amount"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setEditRow(null)}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.btn}
                onPress={() => void onSaveBudget()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f7f7f8" },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  sub: { color: "#666", marginBottom: 16, fontSize: 12 },
  summary: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
  },
  summaryCell: { flex: 1 },
  summaryLabel: { fontSize: 11, color: "#888", marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: "700" },
  msg: { color: "#334", marginBottom: 10, fontSize: 13 },
  group: { marginBottom: 18 },
  groupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
  },
  emoji: { fontSize: 22, width: 28, textAlign: "center" },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  catName: { fontWeight: "600", fontSize: 15 },
  amounts: { fontSize: 13, color: "#334", fontWeight: "600" },
  remaining: { fontSize: 11, color: "#888", marginTop: 4 },
  barTrack: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 999 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  modalHint: { color: "#666", marginBottom: 12, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    backgroundColor: "#fafafa",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  btn: {
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  btnGhost: { backgroundColor: "#f1f5f9" },
  btnGhostText: { color: "#334", fontWeight: "600" },
});
