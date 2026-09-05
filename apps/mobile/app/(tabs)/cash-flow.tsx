import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  currentYearMonth,
  shiftYearMonth,
  type CashFlowComparison,
  type CashFlowSummary,
} from "@copilot-clone/domain";
import { API_URL, DEMO_USER_ID, getApiUserId } from "../../src/config";
import { getCashFlowOverview } from "../../src/offline/cashflow";
import { colors, radius, spacing, type } from "../../src/theme";
import { Card, Screen, ScreenHeader, SegmentedControl } from "../../src/ui";

type CashFlowPayload = CashFlowComparison & {
  series?: CashFlowSummary[];
};

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${names[m - 1]}`;
}

function CashFlowBars({ series }: { series: CashFlowSummary[] }) {
  const maxY = Math.max(1, ...series.flatMap((s) => [s.income, s.spend, Math.abs(s.net)]));
  const chartH = 120;

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartLegend}>
        <Text style={styles.legendIncome}>● Income</Text>
        <Text style={styles.legendSpend}>● Spend</Text>
        <Text style={styles.legendNet}>● Net</Text>
      </View>
      <View style={[styles.chartRow, { height: chartH }]}>
        {series.map((s) => {
          const incomeH = Math.max(2, (s.income / maxY) * (chartH - 18));
          const spendH = Math.max(2, (s.spend / maxY) * (chartH - 18));
          const netH = Math.max(2, (Math.abs(s.net) / maxY) * (chartH - 18));
          return (
            <View key={s.year_month} style={styles.barCol}>
              <View style={styles.barCluster}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: incomeH,
                      backgroundColor: colors.incomeGreen,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    {
                      height: spendH,
                      backgroundColor: colors.text,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    {
                      height: netH,
                      backgroundColor:
                        s.net >= 0 ? colors.accentBlue : colors.overBudgetRed,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{monthLabel(s.year_month)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function fallbackSeries(data: CashFlowComparison): CashFlowSummary[] {
  const months = [2, 1, 0].map((i) => shiftYearMonth(data.year_month, -i));
  return months.map((ym) => {
    if (ym === data.year_month) {
      return {
        year_month: ym,
        income: data.income,
        spend: data.spend,
        net: data.net,
        reporting_currency: data.reporting_currency,
      };
    }
    if (ym === data.prior.year_month) return data.prior;
    return {
      year_month: ym,
      income: 0,
      spend: 0,
      net: 0,
      reporting_currency: data.reporting_currency,
    };
  });
}

export default function CashFlowScreen() {
  const [month, setMonth] = useState(currentYearMonth());
  const [data, setData] = useState<CashFlowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"api" | "local">("local");
  const [range, setRange] = useState("1M");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const res = await fetch(
          `${API_URL.replace(/\/$/, "")}/cash-flow?month=${encodeURIComponent(month)}`,
          { headers: { "x-user-id": getApiUserId() } },
        );
        if (res.ok) {
          const json = (await res.json()) as CashFlowPayload;
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

  const chartSeries = useMemo(() => {
    if (!data) return [];
    const full = data.series && data.series.length > 0 ? data.series : fallbackSeries(data);
    if (range === "1M") return full.slice(-3); // still show a bit of history for density
    if (range === "3M") return full.slice(-3);
    return full;
  }, [data, range]);

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <ScreenHeader title="Cash Flow" />

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
        value={range}
        onChange={setRange}
        style={{ marginBottom: spacing.sm }}
      />

      <View style={styles.metricsRow}>
        <Card style={[styles.metricCard, styles.incomeCard]}>
          <Text style={styles.cardLabel}>Income</Text>
          <Text style={[styles.cardValue, { color: colors.incomeGreen }]}>
            {usd(data?.income ?? 0)}
          </Text>
          {data ? (
            <Text style={styles.cardHint}>
              prior {usd(data.prior.income)} · Δ {usd(data.income_delta)}
            </Text>
          ) : null}
        </Card>
        <Card style={[styles.metricCard, styles.spendCard]}>
          <Text style={styles.cardLabel}>Spend</Text>
          <Text style={styles.cardValue}>{usd(data?.spend ?? 0)}</Text>
          {data ? (
            <Text style={styles.cardHint}>
              prior {usd(data.prior.spend)} · Δ {usd(data.spend_delta)}
            </Text>
          ) : null}
        </Card>
        <Card style={[styles.metricCard, styles.netCard]}>
          <Text style={styles.cardLabel}>Net</Text>
          <Text
            style={[
              styles.cardValue,
              {
                color: (data?.net ?? 0) < 0 ? colors.overBudgetRed : colors.incomeGreen,
              },
            ]}
          >
            {usd(data?.net ?? 0)}
          </Text>
          {data ? (
            <Text style={styles.cardHint}>
              vs prior {usd(data.net_delta)} ({pct(data.net_delta_pct)})
            </Text>
          ) : !loading ? (
            <Text style={styles.cardHint}>Import or sync to see cash flow</Text>
          ) : null}
        </Card>
      </View>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Income / Spend / Net</Text>
        {chartSeries.length > 0 ? (
          <CashFlowBars series={chartSeries} />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartText}>
              {loading ? "Loading…" : "No cash-flow series yet"}
            </Text>
          </View>
        )}
      </Card>

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
    marginBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipText: { ...type.footnote, fontWeight: "600", color: colors.text },
  monthLabel: { ...type.headline },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metricCard: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 88,
  },
  incomeCard: {},
  spendCard: {},
  netCard: {},
  cardLabel: { ...type.caption, marginBottom: 2 },
  cardValue: { ...type.title3, fontSize: 18, lineHeight: 22 },
  cardHint: { ...type.footnote, marginTop: 4, fontSize: 11, lineHeight: 14 },
  chartCard: { marginBottom: spacing.sm, paddingVertical: spacing.md },
  chartTitle: { ...type.sectionLabel, marginBottom: spacing.sm, color: colors.textTertiary },
  chartWrap: { gap: spacing.sm },
  chartLegend: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: 4,
  },
  legendIncome: { ...type.footnote, color: colors.incomeGreen, fontWeight: "600" },
  legendSpend: { ...type.footnote, color: colors.text, fontWeight: "600" },
  legendNet: { ...type.footnote, color: colors.accentBlue, fontWeight: "600" },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
  },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barCluster: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: "100%",
    paddingBottom: 16,
  },
  bar: {
    width: 6,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minHeight: 2,
  },
  barLabel: { ...type.caption, fontSize: 10, marginTop: 2 },
  emptyChart: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
  },
  emptyChartText: { ...type.footnote },
  rules: { ...type.footnote, marginTop: spacing.sm, lineHeight: 16 },
});
