import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  currentYearMonth,
  priorYearMonth,
  shiftYearMonth,
  type CashFlowComparison,
} from "@copilot-clone/domain";
import { API_URL, DEMO_USER_ID } from "../../src/config";
import { getCashFlowOverview } from "../../src/offline/cashflow";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

export default function CashFlowScreen() {
  const [month, setMonth] = useState(currentYearMonth());
  const [data, setData] = useState<CashFlowComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"api" | "local">("local");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const res = await fetch(
          `${API_URL.replace(/\/$/, "")}/cash-flow?month=${encodeURIComponent(month)}`,
          { headers: { "x-user-id": DEMO_USER_ID } },
        );
        if (res.ok) {
          const json = (await res.json()) as CashFlowComparison;
          setData(json);
          setSource("api");
          return;
        }
      } catch {
        // fall through to local
      }
      const local = await getCashFlowOverview(month);
      setData(local);
      setSource("local");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void reload()} />
      }
    >
      <Text style={styles.title}>Cash Flow</Text>
      <Text style={styles.sub}>
        Reporting USD · {source === "api" ? "live Worker" : "local SQLite"} ·
        transfers omitted · needs_review / pending excluded
      </Text>

      <View style={styles.monthRow}>
        <Pressable
          style={styles.chip}
          onPress={() => setMonth(shiftYearMonth(month, -1))}
        >
          <Text style={styles.chipText}>← {priorYearMonth(month)}</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{month}</Text>
        <Pressable
          style={styles.chip}
          onPress={() => setMonth(shiftYearMonth(month, 1))}
        >
          <Text style={styles.chipText}>{shiftYearMonth(month, 1)} →</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Net Income</Text>
        <Text
          style={[
            styles.heroValue,
            { color: (data?.net ?? 0) < 0 ? "#ef4444" : "#0d9488" },
          ]}
        >
          {usd(data?.net ?? 0)}
        </Text>
        {data ? (
          <Text style={styles.heroCmp}>
            vs {data.prior.year_month}: {usd(data.net_delta)} (
            {pct(data.net_delta_pct)})
          </Text>
        ) : null}
      </View>

      <View style={styles.cards}>
        <View style={[styles.card, styles.incomeCard]}>
          <Text style={styles.cardLabel}>Income</Text>
          <Text style={styles.cardValue}>{usd(data?.income ?? 0)}</Text>
          {data ? (
            <Text style={styles.cardHint}>
              prior {usd(data.prior.income)} · Δ {usd(data.income_delta)}
            </Text>
          ) : null}
        </View>
        <View style={[styles.card, styles.spendCard]}>
          <Text style={styles.cardLabel}>Spend</Text>
          <Text style={styles.cardValue}>{usd(data?.spend ?? 0)}</Text>
          {data ? (
            <Text style={styles.cardHint}>
              prior {usd(data.prior.spend)} · Δ {usd(data.spend_delta)}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.rules}>
        Rules: income = type income; spend = regular non-excluded (refunds net);
        transfers omitted. Net = Income − Spend.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f7f7f8" },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  sub: { color: "#666", marginBottom: 16, fontSize: 12 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  chip: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
  },
  chipText: { fontSize: 12, fontWeight: "600", color: "#334" },
  monthLabel: { fontSize: 16, fontWeight: "700" },
  hero: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
    alignItems: "center",
  },
  heroLabel: { fontSize: 12, color: "#888", marginBottom: 6 },
  heroValue: { fontSize: 36, fontWeight: "800" },
  heroCmp: { marginTop: 8, fontSize: 13, color: "#64748b" },
  cards: { flexDirection: "row", gap: 10 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e6",
  },
  incomeCard: { borderLeftWidth: 3, borderLeftColor: "#10b981" },
  spendCard: { borderLeftWidth: 3, borderLeftColor: "#f59e0b" },
  cardLabel: { fontSize: 11, color: "#888", marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: "700" },
  cardHint: { marginTop: 6, fontSize: 11, color: "#888" },
  rules: { marginTop: 18, fontSize: 12, color: "#94a3b8", lineHeight: 18 },
});
