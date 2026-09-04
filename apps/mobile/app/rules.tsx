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
import type { NameRule } from "@copilot-clone/domain";
import { listCategories } from "../src/offline/budgets";
import {
  listNameRules,
  upsertNameRuleLocal,
} from "../src/offline/rulesTagsSplits";
import { syncOutbox } from "../src/offline/syncOutbox";
import { createApiTransport } from "../src/sync/apiTransport";

export default function RulesScreen() {
  const [rules, setRules] = useState<NameRule[]>([]);
  const [cats, setCats] = useState<Record<string, string>>({});
  const [pattern, setPattern] = useState("Starbucks");
  const [matchType, setMatchType] = useState<"exact" | "contains">("contains");
  const [categoryId, setCategoryId] = useState("cat-dining");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [r, c] = await Promise.all([listNameRules(), listCategories()]);
    setRules(r);
    const names: Record<string, string> = {};
    for (const cat of c) names[cat.id] = `${cat.emoji} ${cat.name}`;
    setCats(names);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function onSave() {
    setBusy(true);
    setMsg(null);
    try {
      await upsertNameRuleLocal({
        match_type: matchType,
        pattern,
        category_id: categoryId,
        apply_historically: true,
      });
      await syncOutbox(createApiTransport());
      setMsg("Rule saved (historic apply stubbed; future create/sync apply)");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Name Rules" }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => void reload()} />
        }
      >
        <Text style={styles.sub}>
          exact/contains on txn name → category · last-write-wins · apply on
          create/sync
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Pattern</Text>
          <TextInput
            style={styles.input}
            value={pattern}
            onChangeText={setPattern}
            placeholder="Merchant name"
          />
          <View style={styles.row}>
            {(["contains", "exact"] as const).map((m) => (
              <Pressable
                key={m}
                style={[styles.chip, matchType === m && styles.chipOn]}
                onPress={() => setMatchType(m)}
              >
                <Text
                  style={[styles.chipText, matchType === m && styles.chipTextOn]}
                >
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Category</Text>
          <View style={styles.rowWrap}>
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
                    {cats[id] ?? id}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
          <Pressable style={styles.btn} onPress={() => void onSave()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Save rule</Text>
            )}
          </Pressable>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </View>

        <Text style={styles.section}>Rules ({rules.length})</Text>
        {rules.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {r.match_type}: “{r.pattern}”
            </Text>
            <Text style={styles.cardMeta}>
              → {cats[r.category_id] ?? r.category_id} · updated{" "}
              {r.updated_at.slice(0, 19)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f7f7f8" },
  container: { padding: 20, paddingBottom: 48 },
  sub: { color: "#666", marginBottom: 16, fontSize: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
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
  chipOn: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  chipText: { fontSize: 12, color: "#334" },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  btn: {
    backgroundColor: "#1a1a2e",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  msg: { marginTop: 10, color: "#334", fontSize: 13 },
  section: { fontSize: 18, fontWeight: "600", marginBottom: 10, marginTop: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardMeta: { color: "#666", marginTop: 4, fontSize: 12 },
});
