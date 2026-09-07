import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  CASH_FLOW_RANGE_KEYS,
  CASH_FLOW_RANGE_LABELS,
  CASH_FLOW_RANGE_SHORT,
  type CashFlowCategoryBreakdown,
  type CashFlowExcludedTxnRow,
  type CashFlowRangeKey,
  type CashFlowRangePayload,
  type CashFlowRangeSeriesPoint,
} from "@copilot-clone/domain";
import { API_URL, getApiUserId } from "../../src/config";
import { getCashFlowRangeOverview } from "../../src/offline/cashflow";
import { colors, radius, spacing, type } from "../../src/theme";
import {
  Card,
  MasterDetail,
  ProgressBar,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Toggle,
  useIsDesktopWeb,
} from "../../src/ui";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(0)}`;
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

const RANGE_OPTIONS = CASH_FLOW_RANGE_KEYS.map((k) => CASH_FLOW_RANGE_SHORT[k]);

function shortToKey(short: string): CashFlowRangeKey {
  const found = CASH_FLOW_RANGE_KEYS.find((k) => CASH_FLOW_RANGE_SHORT[k] === short);
  return found ?? "mtd";
}

function MetricCard({
  label,
  value,
  valueColor,
  hint,
  onPress,
}: {
  label: string;
  value: string;
  valueColor?: string;
  hint?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Card style={styles.metricCard}>
        <View style={styles.metricTop}>
          <Text style={styles.cardLabel}>{label}</Text>
          {onPress ? <Text style={styles.viewMore}>View More</Text> : null}
        </View>
        <Text style={[styles.cardValue, valueColor ? { color: valueColor } : null]}>
          {value}
        </Text>
        {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
      </Card>
    </Pressable>
  );
}

function AreaChart({
  title,
  series,
  showComparison,
  priorSeries,
  mode,
  onBarPress,
  viewMore,
}: {
  title: string;
  series: CashFlowRangeSeriesPoint[];
  showComparison: boolean;
  priorSeries?: CashFlowRangeSeriesPoint[];
  mode: "income" | "spend" | "net";
  onBarPress?: () => void;
  viewMore?: () => void;
}) {
  const values = series.map((s) =>
    mode === "income" ? s.income : mode === "spend" ? s.spend : s.net,
  );
  const priorValues =
    priorSeries?.map((s) =>
      mode === "income" ? s.income : mode === "spend" ? s.spend : s.net,
    ) ?? [];
  const maxY = Math.max(
    1,
    ...values.map((v) => Math.abs(v)),
    ...priorValues.map((v) => Math.abs(v)),
  );
  const barColor =
    mode === "income"
      ? colors.incomeGreen
      : mode === "spend"
        ? colors.text
        : colors.accentBlue;

  return (
    <Card style={styles.chartCard}>
      <View style={styles.metricTop}>
        <Text style={styles.chartTitle}>{title}</Text>
        {viewMore ? (
          <Pressable onPress={viewMore} hitSlop={8}>
            <Text style={styles.viewMore}>View More</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.chartRow, { height: 110 }]}>
        {series.map((s, i) => {
          const raw = values[i] ?? 0;
          const h = Math.max(2, (Math.abs(raw) / maxY) * 90);
          const priorH =
            showComparison && priorValues[i] != null
              ? Math.max(2, (Math.abs(priorValues[i]!) / maxY) * 90)
              : 0;
          const cats =
            mode === "spend" ? (s.by_category?.slice(0, 5) ?? []) : [];
          const catSum =
            cats.reduce((acc, c) => acc + Math.max(0, c.amount), 0) || 1;
          return (
            <Pressable key={s.key} style={styles.barCol} onPress={onBarPress}>
              <View style={styles.barCluster}>
                {showComparison && priorH > 0 ? (
                  <View
                    style={[
                      styles.priorGhost,
                      { height: priorH, borderColor: colors.textTertiary },
                    ]}
                  />
                ) : null}
                {mode === "spend" && cats.length > 0 ? (
                  <View style={[styles.stackBar, { height: h }]}>
                    {cats.map((c) => {
                      const segH = Math.max(
                        1,
                        (Math.max(0, c.amount) / catSum) * h,
                      );
                      return (
                        <View
                          key={`${s.key}-${c.category_id ?? "none"}`}
                          style={{
                            height: segH,
                            width: "100%",
                            backgroundColor: c.color || barColor,
                          }}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor:
                          mode === "net" && raw < 0
                            ? colors.overBudgetRed
                            : barColor,
                      },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.barLabel}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function CategoryRows({ rows }: { rows: CashFlowCategoryBreakdown[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
  if (rows.length === 0) {
    return <Text style={styles.cardHint}>No spending in this range</Text>;
  }
  return (
    <>
      {rows.slice(0, 12).map((r) => (
        <View key={r.category_id ?? r.name} style={styles.catRow}>
          <Text style={styles.catEmoji}>{r.emoji}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.catLabelRow}>
              <Text style={styles.catName}>{r.name}</Text>
              <Text style={styles.catAmt}>{usd(r.amount)}</Text>
            </View>
            <ProgressBar
              progress={Math.abs(r.amount) / max}
              color={r.color || colors.text}
            />
          </View>
        </View>
      ))}
    </>
  );
}

/** Help Center: View More of Spending → Key Metrics + per-month/category + Excluded Transactions. */
function SpendingViewMore({
  data,
  comparison,
}: {
  data: CashFlowRangePayload;
  comparison: boolean;
}) {
  const excludedTxns: CashFlowExcludedTxnRow[] =
    data.excluded_transactions ?? [];
  const excludedCats: CashFlowCategoryBreakdown[] =
    data.excluded_by_category ?? [];
  return (
    <View style={{ gap: spacing.sm }}>
      <Card style={styles.breakdownCard}>
        <Text style={styles.chartTitle}>KEY METRICS · SPENDING</Text>
        <Text style={styles.metricLine}>
          Total spending {usd(data.spend)}
        </Text>
        <Text style={styles.cardHint}>
          Range {data.start} → {data.end}
          {data.include_excluded ? " · excluded spend included in totals" : ""}
        </Text>
        {comparison ? (
          <Text style={styles.cardHint}>
            Prior {usd(data.prior.spend)} · Δ {usd(data.spend_delta)}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.breakdownCard}>
        <Text style={styles.chartTitle}>PER MONTH / PERIOD</Text>
        {(data.series ?? []).length === 0 ? (
          <Text style={styles.cardHint}>No period breakdown</Text>
        ) : (
          (data.series ?? []).map((s) => (
            <View key={s.key} style={styles.periodRow}>
              <Text style={styles.periodLabel}>{s.label}</Text>
              <Text style={styles.periodAmt}>{usd(s.spend)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.breakdownCard}>
        <Text style={styles.chartTitle}>SPENDING BY CATEGORY</Text>
        <CategoryRows rows={data.spending_by_category ?? []} />
      </Card>

      <Card style={styles.breakdownCard}>
        <Text style={styles.chartTitle}>EXCLUDED TRANSACTIONS</Text>
        <Text style={styles.cardHint}>
          {usd(data.excluded_spend ?? 0)} excluded from spend
          {(data.excluded_spend ?? 0) === 0 ? " (none in range)" : ""}
        </Text>
        {excludedCats.length > 0 ? (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={styles.subSection}>By category</Text>
            <CategoryRows rows={excludedCats} />
          </View>
        ) : null}
        {excludedTxns.length > 0 ? (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={styles.subSection}>Transactions</Text>
            {excludedTxns.slice(0, 20).map((t) => (
              <View key={t.id} style={styles.exclTxnRow}>
                <Text style={styles.catEmoji}>{t.category_emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{t.name}</Text>
                  <Text style={styles.cardHint}>
                    {t.posted_at.slice(0, 10)} · {t.category_name}
                  </Text>
                </View>
                <Text style={styles.catAmt}>{usd(t.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function IncomeViewMore({ data }: { data: CashFlowRangePayload }) {
  return (
    <Card style={styles.breakdownCard}>
      <Text style={styles.chartTitle}>KEY METRICS · INCOME</Text>
      <Text style={styles.cardHint}>
        Total {usd(data.income)} · Prior range {usd(data.prior.income)} · Δ{" "}
        {usd(data.income_delta)}
      </Text>
      <Text style={styles.subSection}>Per month / period</Text>
      {(data.series ?? []).map((s) => (
        <View key={s.key} style={styles.periodRow}>
          <Text style={styles.periodLabel}>{s.label}</Text>
          <Text style={styles.periodAmt}>{usd(s.income)}</Text>
        </View>
      ))}
    </Card>
  );
}

function NetViewMore({
  data,
  comparison,
}: {
  data: CashFlowRangePayload;
  comparison: boolean;
}) {
  return (
    <Card style={styles.breakdownCard}>
      <Text style={styles.chartTitle}>KEY METRICS · NET INCOME</Text>
      <Text style={styles.cardHint}>
        Income {usd(data.income)} − Spending {usd(data.spend)} = {usd(data.net)}
      </Text>
      {comparison ? (
        <Text style={styles.cardHint}>
          Prior net {usd(data.prior.net)} · Δ {usd(data.net_delta)} (
          {pct(data.net_delta_pct)})
        </Text>
      ) : null}
      <Text style={styles.subSection}>Per month / period</Text>
      {(data.series ?? []).map((s) => (
        <View key={s.key} style={styles.periodRow}>
          <Text style={styles.periodLabel}>{s.label}</Text>
          <Text style={styles.periodAmt}>{usd(s.net)}</Text>
        </View>
      ))}
    </Card>
  );
}

function DetailPanel({
  detail,
  data,
  comparison,
}: {
  detail: "income" | "spend" | "net" | null;
  data: CashFlowRangePayload | null;
  comparison: boolean;
}) {
  if (!data || !detail) {
    return (
      <View style={styles.detailEmpty}>
        <Text style={styles.detailEmptyTitle}>Cash Flow detail</Text>
        <Text style={styles.detailEmptyHint}>
          Tap View More on Spending to open SPENDING BY CATEGORY and EXCLUDED
          TRANSACTIONS. Ranges, comparison, and include-excluded stay active.
        </Text>
      </View>
    );
  }
  if (detail === "spend") {
    return <SpendingViewMore data={data} comparison={comparison} />;
  }
  if (detail === "income") {
    return <IncomeViewMore data={data} />;
  }
  return <NetViewMore data={data} comparison={comparison} />;
}

export default function CashFlowScreen() {
  const desktop = useIsDesktopWeb();
  const [range, setRange] = useState<CashFlowRangeKey>("mtd");
  const [comparison, setComparison] = useState(true);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [detail, setDetail] = useState<"income" | "spend" | "net" | null>(null);
  const [data, setData] = useState<CashFlowRangePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const detailAnchorRef = useRef<View>(null);

  const openDetail = useCallback((next: "income" | "spend" | "net") => {
    setDetail((cur) => (cur === next ? null : next));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        range,
        include_excluded: includeExcluded ? "true" : "false",
        comparison: comparison ? "true" : "false",
      });
      try {
        const res = await fetch(
          `${API_URL.replace(/\/$/, "")}/cash-flow?${qs.toString()}`,
          { headers: { "x-user-id": getApiUserId() } },
        );
        if (res.ok) {
          const json = (await res.json()) as CashFlowRangePayload;
          setData(json);
          return;
        }
      } catch {
        // fall through
      }
      const local = await getCashFlowRangeOverview({
        range,
        include_excluded: includeExcluded,
        comparison,
      });
      setData(local);
    } finally {
      setLoading(false);
    }
  }, [range, includeExcluded, comparison]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Stacked layout: keep View More above charts and scroll it into view.
  useEffect(() => {
    if (desktop || !detail) return;
    const handle = setTimeout(() => {
      const node = detailAnchorRef.current as unknown as {
        scrollIntoView?: (opts?: ScrollIntoViewOptions) => void;
      } | null;
      node?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(handle);
  }, [detail, desktop]);

  const series = useMemo(() => data?.series ?? [], [data]);

  const comparisonHint = useCallback(
    (delta: number, deltaPct: number | null, priorValue: string) => {
      if (!comparison || !data) return undefined;
      const pctPart = deltaPct == null ? "" : ` (${pct(deltaPct)})`;
      return `prior ${priorValue} · Δ ${usd(delta)}${pctPart}`;
    },
    [comparison, data],
  );

  const listBody = (
    <>
      <ScreenHeader title="Cash Flow" />

      <Text style={styles.subtitle}>
        {data
          ? `${CASH_FLOW_RANGE_LABELS[range]} · ${data.start} → ${data.end}`
          : CASH_FLOW_RANGE_LABELS[range]}
      </Text>

      <SegmentedControl
        options={RANGE_OPTIONS}
        value={CASH_FLOW_RANGE_SHORT[range]}
        onChange={(v) => setRange(shortToKey(v))}
        style={{ marginBottom: spacing.sm }}
      />

      <View style={styles.toggleRow}>
        <View style={styles.toggleItem}>
          <Text style={styles.toggleLabel}>Compare prior range</Text>
          <Toggle value={comparison} onChange={setComparison} />
        </View>
        <View style={styles.toggleItem}>
          <Text style={styles.toggleLabel}>Show excluded spend</Text>
          <Toggle value={includeExcluded} onChange={setIncludeExcluded} />
        </View>
      </View>

      <View style={styles.metricsRow}>
        <MetricCard
          label="Income"
          value={usd(data?.income ?? 0)}
          valueColor={colors.incomeGreen}
          hint={
            comparison && data
              ? comparisonHint(data.income_delta, null, usd(data.prior.income))
              : undefined
          }
          onPress={() => openDetail("income")}
        />
        <MetricCard
          label="Spending"
          value={usd(data?.spend ?? 0)}
          hint={
            comparison && data
              ? comparisonHint(data.spend_delta, null, usd(data.prior.spend))
              : undefined
          }
          onPress={() => openDetail("spend")}
        />
        <MetricCard
          label="Net income"
          value={usd(data?.net ?? 0)}
          valueColor={
            (data?.net ?? 0) < 0 ? colors.overBudgetRed : colors.incomeGreen
          }
          hint={
            comparison && data
              ? comparisonHint(
                  data.net_delta,
                  data.net_delta_pct,
                  usd(data.prior.net),
                )
              : !loading && !data
                ? "Import or sync to see cash flow"
                : undefined
          }
          onPress={() => openDetail("net")}
        />
      </View>

      {/* Stacked: detail under metrics so category + excluded are visible. */}
      {!desktop && detail ? (
        <View ref={detailAnchorRef} style={styles.inlineDetail}>
          <DetailPanel detail={detail} data={data} comparison={comparison} />
        </View>
      ) : null}

      {series.length > 0 ? (
        <>
          <AreaChart
            title="Income"
            series={series}
            showComparison={comparison}
            mode="income"
            viewMore={() => openDetail("income")}
            onBarPress={() => setDetail("income")}
          />
          <AreaChart
            title="Spending"
            series={series}
            showComparison={comparison}
            mode="spend"
            viewMore={() => openDetail("spend")}
            onBarPress={() => setDetail("spend")}
          />
          <AreaChart
            title="Net income"
            series={series}
            showComparison={comparison}
            mode="net"
            viewMore={() => openDetail("net")}
            onBarPress={() => setDetail("net")}
          />
        </>
      ) : (
        <Card style={styles.chartCard}>
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartText}>
              {loading ? "Loading…" : "No cash-flow series yet"}
            </Text>
          </View>
        </Card>
      )}

      <Text style={styles.rules}>
        Web Cash Flow is an intentional clone delta (Copilot ships Cash Flow on
        iOS/Mac only). Ranges match Help Center. Transfers omitted. Net income =
        Income − Spending. Bank CSV import remains under More → Import CSV
        (commit → needs_review).
      </Text>
    </>
  );

  const detailBody = (
    <ScrollView
      style={styles.detailScroll}
      contentContainerStyle={styles.detailPad}
      keyboardShouldPersistTaps="handled"
    >
      <DetailPanel detail={detail} data={data} comparison={comparison} />
    </ScrollView>
  );

  if (desktop) {
    return (
      <MasterDetail
        list={
          <Screen
            flush
            refreshing={loading}
            onRefresh={() => void reload()}
            contentStyle={styles.listPad}
          >
            {listBody}
          </Screen>
        }
        detail={detailBody}
      />
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      {listBody}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...type.footnote,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  toggleRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  toggleLabel: { ...type.callout, fontWeight: "600", color: colors.text },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metricCard: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 92,
  },
  metricTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
    gap: 4,
  },
  viewMore: { ...type.caption, color: colors.accentBlue, fontWeight: "600" },
  cardLabel: { ...type.caption, marginBottom: 2 },
  cardValue: { ...type.title3, fontSize: 18, lineHeight: 22 },
  cardHint: { ...type.footnote, marginTop: 4, fontSize: 11, lineHeight: 14 },
  chartCard: { marginBottom: spacing.sm, paddingVertical: spacing.md },
  chartTitle: {
    ...type.sectionLabel,
    marginBottom: spacing.sm,
    color: colors.textTertiary,
  },
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
    width: 10,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minHeight: 2,
  },
  stackBar: {
    width: 12,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  priorGhost: {
    width: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 2,
    opacity: 0.7,
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
  breakdownCard: { marginBottom: spacing.sm, paddingVertical: spacing.md },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  catEmoji: { fontSize: 18, width: 24, textAlign: "center" },
  catLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  catName: { ...type.callout, fontWeight: "600" },
  catAmt: { ...type.callout, fontWeight: "600" },
  excludedBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metricLine: { ...type.title3, fontSize: 20, marginBottom: 4 },
  subSection: {
    ...type.caption,
    color: colors.textTertiary,
    fontWeight: "700",
    marginTop: spacing.sm,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  periodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  periodLabel: { ...type.callout, fontWeight: "600" },
  periodAmt: { ...type.callout, fontWeight: "600" },
  exclTxnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rules: { ...type.footnote, marginTop: spacing.sm, lineHeight: 16 },
  listPad: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  inlineDetail: { marginBottom: spacing.sm },
  detailScroll: { flex: 1, minHeight: 0 },
  detailPad: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  detailEmpty: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.sm,
  },
  detailEmptyTitle: { ...type.title3, color: colors.text },
  detailEmptyHint: {
    ...type.footnote,
    color: colors.textTertiary,
    lineHeight: 18,
  },
});
