import { StyleSheet, Text, View } from "react-native";
import { colors, type } from "../theme";

type Props = {
  cumulative: number[];
  pace: number[];
  /** Highlight through this day index (0-based). Defaults to today in month. */
  throughDay?: number;
  height?: number;
  width?: number;
};

/**
 * Simple SVG polyline chart: cumulative MTD spend vs budget pace.
 * Works on web + native via react-native-web SVG namespace.
 */
export function SpendingLineChart({
  cumulative,
  pace,
  throughDay,
  height = 160,
  width = 320,
}: Props) {
  const n = Math.max(cumulative.length, pace.length, 1);
  const today =
    throughDay ??
    Math.min(Math.max(new Date().getUTCDate() - 1, 0), n - 1);
  const visibleCum = cumulative.slice(0, today + 1);
  const maxY = Math.max(...pace, ...visibleCum, 1);
  const pad = 8;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  function point(i: number, value: number): string {
    const x = pad + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const y = pad + innerH - (value / maxY) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }

  const paceLine = pace.map((v, i) => point(i, v)).join(" ");
  const spendLine = visibleCum.map((v, i) => point(i, v)).join(" ");
  const spentNow = visibleCum[visibleCum.length - 1] ?? 0;
  const paceNow = pace[today] ?? 0;
  const over = spentNow > paceNow;

  return (
    <View style={styles.wrap}>
      <View style={{ width, height }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <polyline
            fill="none"
            stroke={colors.textTertiary}
            strokeWidth="2"
            strokeDasharray="4 4"
            points={paceLine}
          />
          <polyline
            fill="none"
            stroke={over ? colors.danger : colors.primary}
            strokeWidth="2.5"
            points={spendLine}
          />
        </svg>
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendItem}>
          <Text
            style={{
              color: over ? colors.danger : colors.primary,
              fontWeight: "700",
            }}
          >
            ●{" "}
          </Text>
          Spend MTD ${spentNow.toFixed(0)}
        </Text>
        <Text style={styles.legendItem}>
          <Text style={{ color: colors.textTertiary, fontWeight: "700" }}>
            ◌{" "}
          </Text>
          Budget pace ${paceNow.toFixed(0)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "stretch" },
  legend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  legendItem: { ...type.footnote, color: colors.text },
});
