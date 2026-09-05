import { Children, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { spacing } from "../theme";
import { useIsDesktopWeb } from "./useIsDesktopWeb";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Web: 2-column card grid. Mobile: single column stack. */
export function DashboardGrid({ children, style }: Props) {
  const desktop = useIsDesktopWeb();
  const items = Children.toArray(children).filter(Boolean);

  if (!desktop) {
    return <View style={[styles.stack, style]}>{items}</View>;
  }

  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return (
    <View style={[styles.stack, style]}>
      {rows.map((row, idx) => (
        <View key={idx} style={styles.row}>
          {row.map((child, j) => (
            <View key={j} style={styles.col}>
              {child}
            </View>
          ))}
          {row.length === 1 ? <View style={styles.col} /> : null}
        </View>
      ))}
    </View>
  );
}

export function DashboardGridItem({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.cardGap },
  row: { flexDirection: "row", gap: spacing.cardGap, alignItems: "stretch" },
  col: { flex: 1, minWidth: 0 },
});
