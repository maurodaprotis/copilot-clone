import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  currentYearMonth,
  priorYearMonth,
  shiftYearMonth,
  type CashFlowComparison,
} from "@copilot-clone/domain";
import { API_URL, DEMO_USER_ID } from "../../src/config";
import { getCashFlowOverview } from "../../src/offline/cashflow";
import { colors, radius, spacing, type } from "../../src/theme";
import { Card, Screen, ScreenHeader, SegmentedControl } from "../../src/ui";

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
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <ScreenHeader
        title="Cash Flow"
        subtitle={`${source === "api" ? "Live" : "Local"} · transfers omitted`}
      />

      <View style={styles.monthRow}>
        <Pressable
          style={styles.chip}
          onPress={() => setMonth(shiftYearMonth(month, -1))}
        >
          <Text style={styles.chipText}>←</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{month}</Text>
        <Pressable
          style={styles.chip}
          onPress={() => setMonth(shiftYearMonth(month, 1))}
        >
          <Text style={styles.chipText}>→</Text>
        </Pressable>
      </View>
      <SegmentedControl
        options={["1M", "3M", "YTD", "1Y"]}
        value="1M"
        onChange={() => undefined}
        style={{ marginBottom: spacing.md }}
      />

      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>Net</Text>
        <Text
          style={[
            styles.heroValue,
            { color: (data?.net ?? 0) < 0 ? colors.overBudgetRed : colors.incomeGreen },
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
      </Card>

      <View style={styles.cards}>
        <Card style={[styles.statCard, styles.incomeCard]}>
          <Text style={styles.cardLabel}>Inflow</Text>
          <Text style={styles.cardValue}>{usd(data?.income ?? 0)}</Text>
          {data ? (
            <Text style={styles.cardHint}>
              prior {usd(data.prior.income)} · Δ {usd(data.income_delta)}
            </Text>
          ) : null}
        </Card>
        <Card style={[styles.statCard, styles.spendCard]}>
          <Text style={styles.cardLabel}>Outflow</Text>
          <Text style={styles.cardValue}>{usd(data?.spend ?? 0)}</Text>
          {data ? (
            <Text style={styles.cardHint}>
              prior {usd(data.prior.spend)} · Δ {usd(data.spend_delta)}
            </Text>
          ) : null}
        </Card>
      </View>

      <Text style={styles.rules}>
        Income = type income. Spend = regular non-excluded (refunds net).
        Transfers omitted. Net = Income − Spend.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  chip: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipText: { ...type.footnote, fontWeight: "600", color: colors.text },
  monthLabel: { ...type.headline },
  hero: { alignItems: "center", marginBottom: spacing.md, paddingVertical: spacing.xl },
  heroLabel: { ...type.caption, marginBottom: spacing.xs },
  heroValue: { ...type.moneyHero },
  heroCmp: { ...type.subhead, marginTop: spacing.sm },
  cards: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1 },
  incomeCard: {},
  spendCard: {},
  cardLabel: { ...type.caption, marginBottom: 4 },
  cardValue: { ...type.title2 },
  cardHint: { ...type.footnote, marginTop: 6 },
  rules: { ...type.footnote, marginTop: spacing.lg, lineHeight: 18 },
});
