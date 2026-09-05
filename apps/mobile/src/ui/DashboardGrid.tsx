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

  return (
    <View style={[styles.grid, style]}>
      {items.map((child, i) => (
        <View key={i} style={styles.item}>
          {child}
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
  const desktop = useIsDesktopWeb();
  return (
    <View style={[desktop ? styles.item : undefined, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.cardGap,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.cardGap,
    alignItems: "stretch",
  },
  item: {
    // RN-web: ~2 columns with gap
    width: "calc(50% - 6px)" as unknown as number,
    minWidth: 280,
    flexGrow: 1,
    flexShrink: 1,
  },
});
