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
import type { Tag } from "@copilot-clone/domain";
import { listTags, upsertTagLocal } from "../src/offline/rulesTagsSplits";
import { syncOutbox } from "../src/offline/syncOutbox";
import { createApiTransport } from "../src/sync/apiTransport";

export default function TagsScreen() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("Business");
  const [color, setColor] = useState("#3366ff");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setTags(await listTags());
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
      await upsertTagLocal({ name, color });
      await syncOutbox(createApiTransport());
      setMsg("Tag saved · assign on Transactions detail");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tags" }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => void reload()} />
        }
      >
        <Text style={styles.sub}>
          Orthogonal labels · no budget impact · multi-tag on txn detail
        </Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Tag name"
          />
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder="#hex color"
            autoCapitalize="none"
          />
          <Pressable style={styles.btn} onPress={() => void onSave()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Add tag</Text>
            )}
          </Pressable>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </View>
        <Text style={styles.section}>Tags ({tags.length})</Text>
        {tags.map((t) => (
          <View key={t.id} style={styles.card}>
            <View style={[styles.dot, { backgroundColor: t.color }]} />
            <Text style={styles.cardTitle}>{t.name}</Text>
          </View>
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
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: "#fafafa",
    width: "100%",
  },
  btn: {
    backgroundColor: "#2F6BFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  msg: { marginTop: 10, color: "#334", fontSize: 13, width: "100%" },
  section: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
});
