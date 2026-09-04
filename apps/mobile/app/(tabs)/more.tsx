import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

export default function MoreScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>More</Text>
      <Text style={styles.sub}>Accounts, settings, import, rules, tags</Text>
      <Pressable style={styles.row} onPress={() => router.push("/accounts")}>
        <Text style={styles.rowTitle}>Accounts</Text>
        <Text style={styles.rowHint}>Manual accounts by type · balances · net worth</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push("/settings")}>
        <Text style={styles.rowTitle}>Settings</Text>
        <Text style={styles.rowHint}>Reporting currency · FX series · manual rates · locale</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push("/import")}>
        <Text style={styles.rowTitle}>Import CSV</Text>
        <Text style={styles.rowHint}>Bank CSV · mapping · commit → needs_review</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push("/rules")}>
        <Text style={styles.rowTitle}>Name Rules</Text>
        <Text style={styles.rowHint}>exact/contains → category · apply on create/sync</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push("/tags")}>
        <Text style={styles.rowTitle}>Tags</Text>
        <Text style={styles.rowHint}>CRUD tags · assign on Transactions</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#f7f7f8" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  sub: { color: "#666", marginBottom: 20, fontSize: 13 },
  row: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: "#e2e2e6" },
  rowTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  rowHint: { fontSize: 12, color: "#64748b" },
});
