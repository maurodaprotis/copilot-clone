import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

type Props = {
  assets: number;
  debts: number;
  /** Inclusive point count for demo series chrome. */
  points?: number;
  width?: number;
  height?: number;
  /** Seed so range chips visibly change the sparkline. */
  rangeKey?: string;
};

/**
 * Copilot net-worth chrome: dual dashed assets (blue) / debts (orange) lines
 * ending in open circles + soft debt gradient (audit 10-dashboard + mobile mock).
 * Series is demo skin when no history API exists.
 */
export function NetWorthTrendChart({
  assets,
  debts,
  points = 14,
  width = 340,
  height = 72,
  rangeKey = "1W",
}: Props) {
  const n = Math.max(points, 2);
  const padX = 4;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const seed =
    rangeKey.split("").reduce((a, c) => a + c.charCodeAt(0), 0) +
    Math.round(assets) +
    Math.round(debts);

  function series(end: number, wobble: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const wave =
        Math.sin((i + seed * 0.17) * 0.55) * wobble * end * 0.04 +
        Math.cos((i + seed * 0.11) * 0.31) * wobble * end * 0.02;
      const ramp = end * (0.86 + 0.14 * t);
      out.push(Math.max(0, ramp + wave * (1 - t * 0.35)));
    }
    out[n - 1] = end;
    return out;
  }

  const assetSeries = series(Math.max(assets, 1), 1);
  const debtSeries = series(Math.max(debts, 1), 1.15);
  const maxY = Math.max(...assetSeries, ...debtSeries, 1) * 1.08;

  function xy(i: number, value: number): { x: number; y: number } {
    const x = padX + (i / (n - 1)) * innerW;
    const y = padY + innerH - (value / maxY) * innerH;
    return { x, y };
  }

  function poly(s: number[]): string {
    return s
      .map((v, i) => {
        const p = xy(i, v);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ");
  }

  const aLast = xy(n - 1, assetSeries[n - 1]!);
  const dLast = xy(n - 1, debtSeries[n - 1]!);
  const baseY = padY + innerH;

  // Soft orange wash under the last segment of debts (audit).
  const washX = Math.max(padX, dLast.x - 40);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="nwDebtWash" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={colors.debtOrangeDot} stopOpacity="0.28" />
            <stop offset="100%" stopColor={colors.debtOrangeDot} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x={washX}
          y={Math.min(dLast.y, aLast.y)}
          width={Math.max(8, width - washX - padX)}
          height={Math.max(8, baseY - Math.min(dLast.y, aLast.y))}
          fill="url(#nwDebtWash)"
        />
        <polyline
          fill="none"
          stroke={colors.assetBlueDot}
          strokeWidth="1.5"
          strokeDasharray="3 3"
          strokeLinecap="round"
          points={poly(assetSeries)}
        />
        <polyline
          fill="none"
          stroke={colors.debtOrangeDot}
          strokeWidth="1.5"
          strokeDasharray="3 3"
          strokeLinecap="round"
          points={poly(debtSeries)}
        />
        <circle
          cx={aLast.x}
          cy={aLast.y}
          r={4}
          fill="#fff"
          stroke={colors.assetBlueDot}
          strokeWidth={1.75}
        />
        <circle
          cx={dLast.x}
          cy={dLast.y}
          r={4}
          fill="#fff"
          stroke={colors.debtOrangeDot}
          strokeWidth={1.75}
        />
      </svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center" },
});
