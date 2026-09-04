import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  DEMO_ACCOUNT_CURRENCY,
  DEMO_ACCOUNT_ID,
  DEMO_REPORTING_CURRENCY,
  API_URL,
} from "../../src/config";
import { addExpenseOffline } from "../../src/offline/addExpenseOffline";
import {
  countOutbox,
  listAllTransactions,
  listToReview,
  type LocalTransaction,
} from "../../src/offline/queries";
import { listCategories } from "../../src/offline/budgets";
import { reviewTransaction } from "../../src/offline/reviewTransaction";
import { syncOutbox } from "../../src/offline/syncOutbox";
import { createApiTransport } from "../../src/sync/apiTransport";

export default function TransactionsScreen() {
  const [pending, setPending] = useState<LocalTransaction[]>([]);
  const [all, setAll] = useState<LocalTransaction[]>([]);
  const [outboxCount, setOutboxCount] = useState(0);
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("Café offline");
  const [currency, setCurrency] = useState("USD");
  const [categoryId, setCategoryId] = useState("cat-dining");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [p, a, o, cats] = await Promise.all([
      listToReview(),
      listAllTransactions(),
      countOutbox(),
      listCategories(),
    ]);
    setPending(p);
    setAll(a);
    setOutboxCount(o);
    const names: Record<string, string> = {};
    for (const c of cats) names[c.id] = `${c.emoji} ${c.name}`;
    setCategoryNames(names);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function onAddOffline() {
    setBusy(true);
    setMsg(null);
    try {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        setMsg("Enter a positive amount");
        return;
      }
      const { transactionId } = await addExpenseOffline({
        account_id: DEMO_ACCOUNT_ID,
        category_id: categoryId,
        amount: n,
        currency,
        account_currency: DEMO_ACCOUNT_CURRENCY,
        reporting_currency: DEMO_REPORTING_CURRENCY,
        note: note || null,
        rate_book: { "USD:ARS:2026-09-04": 1400 },
      });
      setMsg(`Added offline pending txn ${transactionId.slice(0, 8)}…`);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSync() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await syncOutbox(createApiTransport());
      setMsg(
        result.pushed > 0
          ? `Pushed ${result.pushed} to UserDO via ${API_URL}`
          : "Outbox empty",
      );
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReview(id: string) {
    setBusy(true);
    try {
      await reviewTransaction(id);
      await syncOutbox(createApiTransport());
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => void reload()} />
      }
    >
      <Text style={styles.title}>Transactions</Text>
      <Text style={styles.sub}>
        Inbox · outbox {outboxCount} · API {API_URL.replace("https://", "")}
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Add expense (works offline)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="Amount"
        />
        <TextInput
          style={styles.input}
          value={currency}
          onChangeText={setCurrency}
          placeholder="Currency"
          autoCapitalize="characters"
        />
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder="Note"
        />
        <Text style={styles.catLabel}>Category (hits budget after Review)</Text>
        <View style={styles.chipRow}>
          {["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"].map(
            (id) => (
              <Pressable
                key={id}
                style={[styles.chip, categoryId === id && styles.chipOn]}
                onPress={() => setCategoryId(id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    categoryId === id && styles.chipTextOn,
                  ]}
                >
                  {categoryNames[id] ?? id}
                </Text>
              </Pressable>
            ),
          )}
        </View>
        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={() => void onAddOffline()} disabled={busy}>
            <Text style={styles.btnText}>Add offline</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => void onSync()} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sync</Text>}
          </Pressable>
        </View>
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </View>

      <Text style={styles.section}>To Review ({pending.length})</Text>
      {pending.map((txn) => (
        <View key={txn.id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              {txn.currency} {txn.amount.toFixed(2)}
              {txn.synced ? " · synced" : " · pending sync"}
            </Text>
            <Text style={styles.cardMeta}>
              {txn.note || "Expense"} ·{" "}
              {txn.category_id
                ? categoryNames[txn.category_id] ?? txn.category_id
                : "uncategorized"}{" "}
              · needs review
            </Text>
          </View>
          <Pressable style={styles.reviewBtn} onPress={() => void onReview(txn.id)}>
            <Text style={styles.reviewText}>Review</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.section}>All ({all.length})</Text>
      {all.map((txn) => (
        <View key={`all-${txn.id}`} style={[styles.card, styles.cardMuted]}>
          <Text style={styles.cardTitle}>
            {txn.currency} {txn.amount.toFixed(2)} · {txn.review_status}
          </Text>
          <Text style={styles.cardMeta}>
            {txn.note || "—"} ·{" "}
            {txn.category_id
              ? categoryNames[txn.category_id] ?? txn.category_id
              : "—"}{" "}
            · synced={txn.synced}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f7f7f8" },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  sub: { color: "#666", marginBottom: 16, fontSize: 12 },
  form: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
  },
  label: { fontWeight: "600", marginBottom: 8 },
  catLabel: { fontSize: 12, color: "#666", marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fafafa",
  },
  chipOn: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  chipText: { fontSize: 12, color: "#334" },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  row: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: {
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 110,
    alignItems: "center",
  },
  btnSecondary: { backgroundColor: "#0d9488" },
  btnText: { color: "#fff", fontWeight: "600" },
  msg: { marginTop: 10, color: "#334", fontSize: 13 },
  section: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
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
  cardMuted: { flexDirection: "column", alignItems: "flex-start" },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardMeta: { color: "#666", marginTop: 4, fontSize: 12 },
  reviewBtn: {
    backgroundColor: "#0d9488",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reviewText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
