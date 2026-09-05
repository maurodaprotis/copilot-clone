import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";
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
  const useLarge = large ?? !desktop;
  return (
    <View style={[styles.wrap, desktop && styles.wrapDense]}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <Text style={useLarge ? type.largeTitle : type.title1} numberOfLines={1}>
            {title}
          </Text>
          {badge != null ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  wrapDense: { marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  right: { flexShrink: 0 },
  sub: { ...type.subhead, marginTop: spacing.xs, color: colors.textSecondary },
  badge: {
    backgroundColor: colors.accentBlueSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.accentBlue,
    fontSize: 13,
    fontWeight: "700",
  },
});
