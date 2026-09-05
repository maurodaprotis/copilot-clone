import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";

type Props = {
  cumulative: number[];
  pace: number[];
  /** Highlight through this day index (0-based). Defaults to today in month. */
  throughDay?: number;
  height?: number;
  width?: number;
  /** When true, show Spending / Budget legend above the chart (Copilot web). */
  showLegend?: boolean;
};

/**
 * SVG polyline: cumulative MTD spend vs budget pace.
 * Legend: solid Spending + dotted Budget (Copilot-style).
 */
export function SpendingLineChart({
  cumulative,
  pace,
  throughDay,
  height = 160,
  width = 320,
  showLegend = true,
}: Props) {
  const n = Math.max(cumulative.length, pace.length, 1);
  const today =
    throughDay ??
    Math.min(Math.max(new Date().getUTCDate() - 1, 0), n - 1);
  const visibleCum = cumulative.slice(0, today + 1);
  const maxY = Math.max(...pace, ...visibleCum, 1);
  const padX = 4;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  function xy(i: number, value: number): { x: number; y: number } {
    const x = padX + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const y = padY + innerH - (value / maxY) * innerH;
    return { x, y };
  }

  function points(series: number[]): string {
    return series.map((v, i) => {
      const p = xy(i, v);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");
  }

  const paceLine = points(pace);
  const spendLine = points(visibleCum);
  const spentNow = visibleCum[visibleCum.length - 1] ?? 0;
  const paceNow = pace[today] ?? 0;
  const over = spentNow > paceNow;
  const spendColor = over ? colors.chartSpendLine : colors.accentBlue;

  // Area fill under spend line
  let areaD = "";
  if (visibleCum.length > 0) {
    const first = xy(0, visibleCum[0] ?? 0);
    const last = xy(visibleCum.length - 1, visibleCum[visibleCum.length - 1] ?? 0);
    const baseY = padY + innerH;
    areaD =
      `M ${first.x.toFixed(1)} ${baseY.toFixed(1)} ` +
      visibleCum
        .map((v, i) => {
          const p = xy(i, v);
          return `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(" ") +
      ` L ${last.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
  }

  const lastPt =
    visibleCum.length > 0
      ? xy(visibleCum.length - 1, visibleCum[visibleCum.length - 1] ?? 0)
      : null;

  return (
    <View style={styles.wrap}>
      {showLegend ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSolid, { backgroundColor: spendColor }]} />
            <Text style={styles.legendText}>Spending</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDashTrack}>
              <View style={styles.legendDash} />
              <View style={styles.legendDash} />
              <View style={styles.legendDash} />
            </View>
            <Text style={styles.legendText}>Budget</Text>
          </View>
        </View>
      ) : null}
      <View style={{ width, height, alignSelf: "center" }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {areaD ? (
            <path d={areaD} fill={spendColor} opacity={0.12} />
          ) : null}
          <polyline
            fill="none"
            stroke={colors.chartBudgetLine}
            strokeWidth="1.75"
            strokeDasharray="4 4"
            points={paceLine}
          />
          <polyline
            fill="none"
            stroke={spendColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={spendLine}
          />
          {lastPt ? (
            <circle
              cx={lastPt.x}
              cy={lastPt.y}
              r={4}
              fill={spendColor}
              stroke="#fff"
              strokeWidth={1.5}
            />
          ) : null}
        </svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "stretch" },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSolid: { width: 16, height: 2.5, borderRadius: 2 },
  legendDashTrack: { flexDirection: "row", gap: 2, alignItems: "center" },
  legendDash: {
    width: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.chartBudgetLine,
  },
  legendText: { ...type.footnote, color: colors.textSecondary, fontWeight: "500" },
});
