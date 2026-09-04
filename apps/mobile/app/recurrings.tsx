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
import { Stack, useFocusEffect } from "expo-router";
import type {
  Recurring,
  RecurringCadence,
  RecurringKind,
} from "@copilot-clone/domain";
import { DEMO_ACCOUNT_ID } from "../src/config";
import {
  listRecurringsLocal,
  pullRecurringsFromApi,
  upsertRecurringLocal,
} from "../src/offline/recurrings";
import { syncOutbox } from "../src/offline/syncOutbox";
import { createApiTransport } from "../src/sync/apiTransport";

const KINDS: RecurringKind[] = ["expense", "income", "reimbursement"];
const CADENCES: RecurringCadence[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
];

export default function RecurringsScreen() {
  const [items, setItems] = useState<Recurring[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("Netflix");
  const [kind, setKind] = useState<RecurringKind>("expense");
  const [cadence, setCadence] = useState<RecurringCadence>("monthly");
  const [amount, setAmount] = useState("15.99");
  const [currency, setCurrency] = useState("USD");
  const [nextDate, setNextDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const pulled = await pullRecurringsFromApi();
      setItems(pulled.recurrings);
    } catch {
      setItems(await listRecurringsLocal());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  function loadForEdit(r: Recurring) {
    setEditId(r.id);
    setName(r.name);
    setKind(r.kind);
    setCadence(r.cadence);
    setAmount(String(r.expected_amount));
    setCurrency(r.currency);
    setNextDate(r.next_expected_date.slice(0, 10));
    setActive(r.active);
    setMsg(null);
  }

  function resetForm() {
    setEditId(null);
    setName("Netflix");
    setKind("expense");
    setCadence("monthly");
    setAmount("15.99");
    setCurrency("USD");
    setNextDate(new Date().toISOString().slice(0, 10));
    setActive(true);
  }

  async function onSave() {
    setBusy(true);
    setMsg(null);
    try {
      await upsertRecurringLocal({
        id: editId ?? undefined,
        name: name.trim() || "Recurring",
        kind,
        cadence,
        expected_amount: Number(amount) || 0,
        currency: currency.trim() || "USD",
        category_id: kind === "income" ? "cat-salary" : "cat-utilities",
        account_id: DEMO_ACCOUNT_ID,
        next_expected_date: nextDate.slice(0, 10),
        active,
      });
      await syncOutbox(createApiTransport());
      setMsg(editId ? "Recurring updated" : "Recurring created");
      resetForm();
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Recurrings" }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => void reload()} />
        }
      >
        <Text style={styles.sub}>
          Templates for bills / income / reimbursements · match reviewed txns by
          name+amount · Dashboard Upcoming bills uses next_expected_date
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>{editId ? "Edit" : "Create"} recurring</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name"
          />
          <Text style={styles.label}>Kind</Text>
          <View style={styles.rowWrap}>
            {KINDS.map((k) => (
              <Pressable
                key={k}
                style={[styles.chip, kind === k && styles.chipOn]}
                onPress={() => setKind(k)}
              >
                <Text
                  style={[styles.chipText, kind === k && styles.chipTextOn]}
                >
                  {k}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Cadence</Text>
          <View style={styles.rowWrap}>
            {CADENCES.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, cadence === c && styles.chipOn]}
                onPress={() => setCadence(c)}
              >
                <Text
                  style={[styles.chipText, cadence === c && styles.chipTextOn]}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.flex]}
              value={amount}
              onChangeText={setAmount}
              placeholder="expected_amount"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.flex]}
              value={currency}
              onChangeText={setCurrency}
              placeholder="currency"
              autoCapitalize="characters"
            />
          </View>
          <TextInput
            style={styles.input}
            value={nextDate}
            onChangeText={setNextDate}
            placeholder="next_expected_date YYYY-MM-DD"
          />
          <Pressable
            style={[styles.chip, active && styles.chipOn, { alignSelf: "flex-start" }]}
            onPress={() => setActive((v) => !v)}
          >
            <Text style={[styles.chipText, active && styles.chipTextOn]}>
              {active ? "active" : "inactive"}
            </Text>
          </Pressable>
          <View style={[styles.row, { marginTop: 10 }]}>
            <Pressable
              style={[styles.btn, { flex: 1 }]}
              onPress={() => void onSave()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {editId ? "Save changes" : "Create"}
                </Text>
              )}
            </Pressable>
            {editId ? (
              <Pressable style={styles.btnSecondary} onPress={resetForm}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </View>

        <Text style={styles.section}>Recurrings ({items.length})</Text>
        {items.map((r) => (
          <Pressable
            key={r.id}
            style={styles.card}
            onPress={() => loadForEdit(r)}
          >
            <Text style={styles.cardTitle}>
              {r.name} · {r.currency} {r.expected_amount.toFixed(2)}
            </Text>
            <Text style={styles.cardMeta}>
              {r.kind} · {r.cadence} · next {r.next_expected_date}
              {r.active ? "" : " · inactive"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#F5F7FA" },
  container: { padding: 20, paddingBottom: 48 },
  sub: { color: "#666", marginBottom: 16, fontSize: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
  },
  label: { fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  flex: { flex: 1 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fafafa",
  },
  chipOn: { backgroundColor: "#2F6BFF", borderColor: "#2F6BFF" },
  chipText: { fontSize: 12, color: "#334" },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  btn: {
    backgroundColor: "#2F6BFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  btnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  btnSecondaryText: { color: "#334", fontWeight: "600" },
  msg: { marginTop: 10, color: "#334", fontSize: 13 },
  section: { fontSize: 18, fontWeight: "600", marginBottom: 10, marginTop: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardMeta: { color: "#666", marginTop: 4, fontSize: 12 },
});
