import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

export default function MoreScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>More</Text>
      <Text style={styles.sub}>Accounts, settings, and secondary surfaces</Text>

      <Pressable
        style={styles.row}
        onPress={() => router.push("/accounts")}
      >
        <Text style={styles.rowTitle}>Accounts</Text>
        <Text style={styles.rowHint}>
          Manual accounts by type · balances · net worth
        </Text>
      </Pressable>

      <View style={[styles.row, styles.rowDisabled]}>
        <Text style={styles.rowTitle}>Settings</Text>
        <Text style={styles.rowHint}>Stub — FX / features later</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#f7f7f8" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  sub: { color: "#666", marginBottom: 20, fontSize: 13 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
  },
  rowDisabled: { opacity: 0.55 },
  rowTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  rowHint: { fontSize: 12, color: "#64748b" },
});
