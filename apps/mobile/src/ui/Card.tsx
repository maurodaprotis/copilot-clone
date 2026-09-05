import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, layout, radius, shadow, spacing, type } from "../theme";

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
  const body = (
    <View style={[styles.card, padded && styles.padded, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerRight}>
            {badge != null ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
            {actionLabel && onAction ? (
              <Pressable onPress={onAction} hitSlop={8}>
                <Text style={styles.action}>{actionLabel}</Text>
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
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    ...shadow.card,
  },
  padded: { padding: layout.cardPadding },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { ...type.headline, fontSize: 15, letterSpacing: -0.1 },
  action: { ...type.footnote, color: colors.textSecondary, fontWeight: "600" },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
});

export const cardGap = spacing.cardGap;
