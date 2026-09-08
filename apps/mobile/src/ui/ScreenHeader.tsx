import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "../theme";
import { useIsDesktopWeb } from "./useIsDesktopWeb";

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  large?: boolean;
  badge?: string | number;
};

export function ScreenHeader({
  title,
  subtitle,
  right,
  large,
  badge,
}: Props) {
  const desktop = useIsDesktopWeb();
  const { colors, type } = useTheme();
  const useLarge = large ?? !desktop;
  return (
    <View style={[styles.wrap, desktop && styles.wrapDense]}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <Text
            style={[
              useLarge ? type.largeTitle : type.title1,
              { color: colors.textPrimary },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {badge != null ? (
            <View style={[styles.badge, { backgroundColor: colors.accentBlueSoft }]}>
              <Text style={[styles.badgeText, { color: colors.accentBlue }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? (
        <Text style={[type.subhead, { marginTop: spacing.xs, color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  wrapDense: { marginBottom: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  right: { flexShrink: 0 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
