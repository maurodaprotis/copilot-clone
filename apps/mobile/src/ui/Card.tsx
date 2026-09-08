import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { layout, radius, shadow, spacing, useTheme } from "../theme";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  onPress?: () => void;
  /** Optional count / pill in the card header (e.g. To Review "0"). */
  badge?: string | number;
};

export function Card({
  children,
  style,
  padded = true,
  title,
  actionLabel,
  onAction,
  onPress,
  badge,
}: Props) {
  const { colors, type } = useTheme();
  const body = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bgCard },
        shadow.card,
        padded && styles.padded,
        style,
      ]}
    >
      {title ? (
        <View style={styles.header}>
          <Text style={[type.headline, { fontSize: 15, letterSpacing: -0.1, color: colors.textPrimary }]}>
            {title}
          </Text>
          <View style={styles.headerRight}>
            {badge != null ? (
              <View style={[styles.badge, { backgroundColor: colors.bgMuted }]}>
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{badge}</Text>
              </View>
            ) : null}
            {actionLabel && onAction ? (
              <Pressable onPress={onAction} hitSlop={8}>
                <Text style={[type.footnote, { color: colors.textSecondary, fontWeight: "600" }]}>
                  {actionLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>
        {body}
      </Pressable>
    );
  }
  return body;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
  },
  padded: { padding: layout.cardPadding },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});

export const cardGap = spacing.cardGap;
