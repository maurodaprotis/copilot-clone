import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  listToReview,
  type LocalTransaction,
} from "../../src/offline/queries";
import { reviewTransaction } from "../../src/offline/reviewTransaction";
import { syncOutbox } from "../../src/offline/syncOutbox";
import { createApiTransport } from "../../src/sync/apiTransport";
import { API_URL } from "../../src/config";

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export default function DashboardScreen() {
  const [items, setItems] = useState<LocalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listToReview();
      setItems(rows);
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
      setStatus(
        result.pushed > 0
          ? `Synced ${result.pushed} item(s) to ${API_URL}`
          : "Nothing in outbox to sync",
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void reload()} />
      }
    >
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.sub}>To Review — local SQLite (needs_review)</Text>

      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => void onSync()} disabled={syncing}>
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sync now</Text>
          )}
        </Pressable>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <Text style={styles.section}>
        To Review ({items.length})
      </Text>

      {items.length === 0 && !loading ? (
        <Text style={styles.empty}>
          No expenses needing review. Add one from Transactions (offline-capable).
        </Text>
      ) : null}

      {items.map((txn) => (
        <View key={txn.id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              {formatMoney(txn.amount, txn.currency)}
              {txn.synced ? "" : " · unsynced"}
            </Text>
            <Text style={styles.cardMeta}>
              {txn.note || "Expense"} · {txn.posted_at.slice(0, 10)} · needs review
            </Text>
          </View>
          <Pressable style={styles.reviewBtn} onPress={() => void onReview(txn.id)}>
            <Text style={styles.reviewText}>Review</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f7f7f8" },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  sub: { color: "#666", marginBottom: 16 },
  row: { flexDirection: "row", marginBottom: 12 },
  btn: {
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  status: { color: "#334", marginBottom: 12, fontSize: 13 },
  section: { fontSize: 18, fontWeight: "600", marginBottom: 10, marginTop: 8 },
  empty: { color: "#888", marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardMeta: { color: "#666", marginTop: 4, fontSize: 13 },
  reviewBtn: {
    backgroundColor: "#0d9488",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reviewText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
