import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  ACCOUNT_TYPES,
  type Account,
  type AccountBalanceRow,
} from "@copilot-clone/domain";
import {
  getAccountsOverview,
  upsertAccountLocal,
} from "../src/offline/accounts";
import { pullAccountsFromApi } from "../src/sync/pullAccounts";
import { syncOutbox } from "../src/offline/syncOutbox";
import { createApiTransport } from "../src/sync/apiTransport";

function money(n: number, ccy: string): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(ccy === "ARS" ? 0 : 2)} ${ccy}`;
}

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}

const emptyForm = {
  id: undefined as string | undefined,
  name: "",
  currency: "USD",
  type: "cash" as Account["type"],
  current_balance: "0",
  include_in_net_worth: true,
};

export default function AccountsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<AccountBalanceRow[]>([]);
  const [nw, setNw] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await pullAccountsFromApi().catch(() => false);
      const overview = await getAccountsOverview();
      setRows(overview.rows);
      setNw(overview.net_worth_reporting);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const byType = useMemo(() => {
    const map = new Map<string, AccountBalanceRow[]>();
    for (const row of rows) {
      const t = row.account.type;
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(row);
    }
    return [...map.entries()];
  }, [rows]);

  function openCreate() {
    setForm(emptyForm);
    setMsg(null);
    setFormOpen(true);
  }

  function openEdit(row: AccountBalanceRow) {
    setForm({
      id: row.account.id,
      name: row.account.name,
      currency: row.account.currency,
      type: row.account.type,
      current_balance: String(row.account.current_balance ?? 0),
      include_in_net_worth: row.account.include_in_net_worth,
    });
    setMsg(null);
    setFormOpen(true);
  }

  async function onSave() {
    if (!form.name.trim()) {
      setMsg("Name is required");
      return;
    }
    const bal = Number(form.current_balance);
    if (!Number.isFinite(bal)) {
      setMsg("Balance must be a number");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await upsertAccountLocal({
        id: form.id,
        name: form.name.trim(),
        currency: form.currency.trim() || "USD",
        type: form.type,
        current_balance: bal,
        include_in_net_worth: form.include_in_net_worth,
      });
      await syncOutbox(createApiTransport());
      setFormOpen(false);
      await reload();
      setMsg(form.id ? "Account updated" : "Account created");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Accounts",
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
              <Text style={{ color: "#1a1a2e", fontWeight: "600" }}>Back</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={openCreate} style={{ padding: 8 }}>
              <Text style={{ color: "#1a1a2e", fontWeight: "700" }}>+ Add</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void reload()} />
        }
      >
        <View style={styles.nwCard}>
          <Text style={styles.nwLabel}>Net Worth (USD)</Text>
          <Text
            style={[
              styles.nwValue,
              { color: nw < 0 ? "#ef4444" : "#0d9488" },
            ]}
          >
            {usd(nw)}
          </Text>
          <Text style={styles.nwHint}>
            Includes accounts flagged include_in_net_worth · credit = liability
          </Text>
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        {byType.map(([type, typeRows]) => (
          <View key={type} style={styles.group}>
            <Text style={styles.groupTitle}>{type}</Text>
            {typeRows.map((row) => (
              <Pressable
                key={row.account.id}
                style={styles.row}
                onPress={() => openEdit(row)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{row.account.name}</Text>
                  <Text style={styles.rowMeta}>
                    {row.account.currency}
                    {row.account.include_in_net_worth ? "" : " · excluded from NW"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.rowBal}>
                    {money(row.balance_account, row.account.currency)}
                  </Text>
                  <Text style={styles.rowUsd}>{usd(row.balance_reporting)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}

        {rows.length === 0 && !loading ? (
          <Text style={styles.empty}>No accounts yet — tap + Add</Text>
        ) : null}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {form.id ? "Edit account" : "New manual account"}
            </Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              placeholder="e.g. Galicia USD"
            />
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {ACCOUNT_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[
                    styles.typeChip,
                    form.type === t && styles.typeChipOn,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, type: t }))}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      form.type === t && styles.typeChipTextOn,
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Currency</Text>
            <TextInput
              style={styles.input}
              value={form.currency}
              autoCapitalize="characters"
              onChangeText={(currency) =>
                setForm((f) => ({ ...f, currency }))
              }
              placeholder="USD"
            />
            <Text style={styles.fieldLabel}>Opening / current balance</Text>
            <TextInput
              style={styles.input}
              value={form.current_balance}
              keyboardType="decimal-pad"
              onChangeText={(current_balance) =>
                setForm((f) => ({ ...f, current_balance }))
              }
            />
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Include in net worth</Text>
              <Switch
                value={form.include_in_net_worth}
                onValueChange={(include_in_net_worth) =>
                  setForm((f) => ({ ...f, include_in_net_worth }))
                }
              />
            </View>
            {msg && formOpen ? <Text style={styles.msg}>{msg}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setFormOpen(false)}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.btn}
                onPress={() => void onSave()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f7f7f8" },
  container: { padding: 20, paddingBottom: 48 },
  nwCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
  },
  nwLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  nwValue: { fontSize: 32, fontWeight: "800" },
  nwHint: { marginTop: 8, fontSize: 11, color: "#94a3b8" },
  msg: { color: "#334", marginBottom: 10, fontSize: 13 },
  group: { marginBottom: 18 },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
    alignItems: "center",
  },
  rowName: { fontWeight: "600", fontSize: 15 },
  rowMeta: { fontSize: 11, color: "#888", marginTop: 2 },
  rowBal: { fontWeight: "700", fontSize: 14 },
  rowUsd: { fontSize: 11, color: "#64748b", marginTop: 2 },
  empty: { color: "#888", textAlign: "center", marginTop: 24 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: "#666", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  typeChipOn: { backgroundColor: "#1a1a2e" },
  typeChipText: { fontSize: 12, fontWeight: "600", color: "#334" },
  typeChipTextOn: { color: "#fff" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
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
