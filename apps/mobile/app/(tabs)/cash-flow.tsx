import { StyleSheet, Text, View } from "react-native";

export default function CashFlowScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cash Flow</Text>
      <Text style={styles.sub}>Stub — inflows / outflows</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 8 },
  sub: { color: "#666" },
});
